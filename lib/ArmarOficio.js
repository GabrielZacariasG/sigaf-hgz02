"use client";

// Lista completa de un contrato para armar su oficio de apoyo: saldo del dictamen, facturas ya marcadas con la
// combinación que más aprovecha el dinero, y las que quedan fuera. Gabriel puede cambiar la selección.
import { useMemo, useState } from "react";
import Link from "next/link";
import { repartir } from "./avisos";
import { descargarOficio } from "./oficioApoyo";
import { periodoTxt, pasivosPrimero } from "./estatus";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const suma = (fs) => fs.reduce((t, f) => t + (Number(f.importe_factura) || 0), 0);

export default function ArmarOficio({ r, ppto, dondeVa }) {
  const sugeridas = useMemo(() => new Set(r.sugeridas), [r.sugeridas]);
  const [marcadas, setMarcadas] = useState(() => new Set(r.sugeridas));
  const [error, setError] = useState("");
  // Las de pasivo hasta arriba; luego las sugeridas y las que quedan fuera, en el orden en que van a pedir dinero
  const lista = useMemo(() => pasivosPrimero([...r.lista].sort((a, b) => sugeridas.has(b.id) - sugeridas.has(a.id))), [r.lista, sugeridas]);
  const elegidas = r.lista.filter((f) => marcadas.has(f.id));
  const fuera = r.lista.filter((f) => !marcadas.has(f.id));
  const rep = repartir(elegidas, r.fondos);
  const recurso = r.fondos.reduce((t, x) => t + x.disponible, 0);
  const usado = suma(elegidas);
  const seExcede = usado - recurso > 0.5;
  const enError = (f) => ppto(f) === "E";
  const fueraError = fuera.filter(enError);
  const apoyoPorUi = {};
  for (const f of elegidas) for (const [ui, v] of rep.porFactura.get(f.id).apoyo) apoyoPorUi[ui] = (apoyoPorUi[ui] || 0) + v;
  const conApoyo = elegidas.filter((f) => rep.porFactura.get(f.id).apoyo.length > 0);
  const esSugerencia = marcadas.size === sugeridas.size && [...marcadas].every((id) => sugeridas.has(id));
  const cambiar = (id) => setMarcadas((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const generar = () => {
    setError("");
    descargarOficio(conApoyo.map((f) => ({ f, s: { contrato: r.contrato, lineas: rep.porFactura.get(f.id).lineas } })))
      .catch((e) => setError("No se pudo generar el oficio: " + e.message));
  };

  const th = { textAlign: "left", fontSize: 12, padding: "6px 8px", borderBottom: "1px solid var(--borde)", color: "var(--texto-suave)", whiteSpace: "nowrap" };
  const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid var(--borde)", verticalAlign: "top" };
  const dato = { border: "1px solid var(--borde)", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, flex: "1 1 150px" };
  const fuerte = { display: "block", fontSize: 16, fontWeight: 700 };

  return (
    <div id={`of-${r.contrato.numero_interno}`} style={{ borderTop: "1px solid var(--borde)", padding: "12px 0", scrollMarginTop: 70 }}>
      <div style={{ fontSize: 14 }}><strong>{r.contrato.numero_interno} · {r.contrato.proveedores?.razon_social}</strong> <span style={{ color: "var(--texto-suave)", fontSize: 12.5 }}>· dictamen {r.dictamen}{r.esPasivo ? " (pasivo)" : ""}</span></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0" }}>
        <div style={{ ...dato, borderLeft: "5px solid var(--verde)" }}>Saldo del dictamen HGZ 2 (disponible acumulado)<span style={fuerte}>{money(r.disponible)}</span></div>
        <div style={dato}>Otras unidades<span style={fuerte}>{money(r.otrasDisp)}</span>{r.otras.map(([ui, v]) => `UI ${ui} ${money(v)}`).join(" · ")}</div>
        <div style={dato}>Marcadas: {elegidas.length} de {r.lista.length}<span style={{ ...fuerte, color: seExcede ? "var(--rojo)" : undefined }}>{money(usado)}</span>{seExcede ? `Te pasas por ${money(usado - recurso)}` : `Quedan sin usar ${money(recurso - usado)}`}</div>
        <div style={dato}>Apoyo a pedir<span style={fuerte}>{money(Object.values(apoyoPorUi).reduce((t, v) => t + v, 0))}</span>{Object.entries(apoyoPorUi).map(([ui, v]) => `UI ${ui} ${money(v)}`).join(" · ") || "Sin apoyo"}</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Va", "Factura", "Periodo", "Importe", "Dónde va", "CR", "De dónde sale el dinero"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{lista.map((f) => {
          const va = marcadas.has(f.id); const d = rep.porFactura.get(f.id);
          return (
            <tr key={f.id} style={{ background: va ? undefined : "#fdf3f3" }}>
              <td style={td}><input type="checkbox" checked={va} onChange={() => cambiar(f.id)} aria-label={`Incluir factura ${f.folio_proveedor}`} /></td>
              <td style={td}><Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>{f.folio_ingreso}</Link><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}</div></td>
              <td style={{ ...td, fontSize: 12.5 }}>{periodoTxt(f)}{f.es_pasivo && <div style={{ fontWeight: 700 }}>PASIVO</div>}</td>
              <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(f.importe_factura)}</td>
              <td style={td}>{dondeVa(f)}</td>
              <td style={td}>{f.cr_contrarecibo || "—"}{enError(f) && <div style={{ color: "var(--rojo)", fontWeight: 600, fontSize: 12 }}>error de presupuesto</div>}</td>
              <td style={{ ...td, fontSize: 12.5 }}>
                {!va ? <span style={{ color: "var(--rojo)", fontWeight: 600 }}>No se contempla: {enError(f) ? "seguirá en error" : "se queda sin dinero"}</span>
                  : d.falta > 0 ? <span style={{ color: "var(--rojo)", fontWeight: 600 }}>No alcanza: faltan {money(d.falta)}</span>
                  : !d.apoyo.length ? `HGZ 2 ${money(d.usaHg)}: no necesita apoyo`
                  : <>{d.usaHg > 0 && `HGZ 2 ${money(d.usaHg)} + `}{d.apoyo.map(([ui, v]) => `UI ${ui} ${money(v)}`).join(" + ")}</>}
              </td>
            </tr>
          );
        })}</tbody>
      </table>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 8 }}>
        <button type="button" onClick={generar} disabled={seExcede || !conApoyo.length}
          style={{ background: seExcede || !conApoyo.length ? "#a0aec0" : "var(--verde)", color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: seExcede || !conApoyo.length ? "not-allowed" : "pointer" }}>
          Generar oficio (Word){conApoyo.length ? ` · ${conApoyo.length} factura(s)` : ""}
        </button>
        {!esSugerencia && <button type="button" onClick={() => setMarcadas(new Set(r.sugeridas))} style={{ background: "none", border: "1px solid var(--borde)", borderRadius: 7, padding: "5px 11px", fontSize: 12.5, cursor: "pointer" }}>Regresar a la sugerencia</button>}
        <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>
          {seExcede ? "Quita facturas para poder generar el oficio." : !conApoyo.length ? (elegidas.length ? "Las marcadas alcanzan con el saldo del HGZ 2: no necesitan oficio." : "Con este saldo no alcanza para ninguna factura completa.") : esSugerencia ? "Esta es la combinación que más aprovecha el dinero." : "Selección cambiada a mano."}
        </span>
      </div>
      {fuera.length > 0 && <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--rojo)" }}>Fuera de este oficio: {fuera.length} factura(s) por {money(suma(fuera))}{fueraError.length ? `, ${fueraError.length} con CR que seguirá en error` : ""}: {fuera.map((f) => f.folio_proveedor).join(", ")}. Para estas sigue la ampliación de dictamen.</p>}
      {error && <p style={{ color: "var(--rojo)", fontSize: 13, margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
