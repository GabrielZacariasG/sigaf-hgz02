"use client";

// Bandeja de avisos (30/10/2026): lo que hay que hacer hoy, armado con los datos que ya tiene SIGAF
// (facturas, firmas, pedido-recepción, CR del 1043 y saldos de dictamen del IMKK036). Solo consulta.
import { useEffect, useState } from "react";
import Link from "next/link";
import { cargarAvisos } from "../../../lib/avisos";
import { LABEL_GENERAL, LABEL_FIRMAS } from "../../../lib/estatus";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const COLOR = { verde: ["#e6f4ea", "#1e7a3c"], ambar: ["#fef3c7", "#92400e"], rojo: ["#fee2e2", "#b91c1c"], validada: ["#e0ecff", "#1d4ed8"], gris: ["#f1f1f1", "#555"] };

function Semaforo({ s }) {
  if (!s) return <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>Sin contrato</span>;
  const [bg, fg] = COLOR[s.nivel] || COLOR.gris;
  return <span title={s.dictamen ? `Dictamen ${s.dictamen}` : ""} style={{ display: "inline-block", fontSize: 12, padding: "2px 8px", borderRadius: 99, background: bg, color: fg, fontWeight: 600 }}>{s.t}</span>;
}

export default function AvisosPage() {
  const [a, setA] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { cargarAvisos().then(setA).catch((e) => setError("No se pudieron cargar los avisos: " + e.message)); }, []);

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "12px 14px", marginTop: 14 };
  const th = { textAlign: "left", fontSize: 12, padding: "6px 8px", borderBottom: "1px solid var(--borde)", color: "var(--texto-suave)", whiteSpace: "nowrap" };
  const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid var(--borde)", verticalAlign: "top" };
  const tdN = { ...td, textAlign: "right", whiteSpace: "nowrap" };
  const LinkF = ({ f }) => <Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>{f.folio_ingreso}</Link>;
  const Titulo = ({ id, color, n, t, sub }) => (
    <div id={id} style={{ display: "flex", alignItems: "baseline", gap: 10, borderLeft: `5px solid ${color}`, paddingLeft: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 22, fontWeight: 700 }}>{n}</span><strong>{t}</strong>{sub && <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{sub}</span>}
    </div>
  );

  if (error) return <p style={{ color: "var(--rojo)" }}>{error}</p>;
  if (!a) return <p>Armando la bandeja de avisos…</p>;

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Bandeja de avisos</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 950, margin: "4px 0 0" }}>
        Qué hacer hoy con lo que ya sabe SIGAF: facturas listas para OOAD, pedido-recepción recibido, y si el dictamen del contrato alcanza
        (con los saldos del IMKK036 cargados en <Link href="/dictamenes" style={{ color: "var(--verde)" }}>Dictámenes</Link> y los CR del 1043 en <Link href="/comprobantes" style={{ color: "var(--verde)" }}>Comprobantes</Link>).
      </p>

      {/* 1. Dictámenes que no alcanzan */}
      <div style={card}>
        <Titulo id="dictamen" color="var(--rojo)" n={a.resumen.length} t="Contratos donde el dictamen no alcanza o hay CR en error" sub="pide el oficio o la ampliación ANTES de mandar las facturas" />
        {a.resumen.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Contrato", "Dictamen", "Disponible HGZ 2", "Faltan", "Qué hacer", "Facturas afectadas"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{a.resumen.map((r) => (
              <tr key={r.contrato.id + "|" + r.dictamen}>
                <td style={td}><strong>{r.contrato.numero_interno}</strong><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{r.contrato.proveedores?.razon_social}</div></td>
                <td style={td}>{r.dictamen}{r.esPasivo && <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>dictamen de pasivo</div>}</td>
                <td style={tdN}>{money(r.disponible)}</td>
                <td style={{ ...tdN, color: "var(--rojo)", fontWeight: 700 }}>{r.faltante ? money(r.faltante) : ""}</td>
                <td style={{ ...td, fontWeight: 600, color: r.accion === "oficio" ? "#92400e" : "var(--rojo)" }}>
                  {r.accion === "oficio" ? `Oficio de apoyo de UI ${r.otras[0][0]} (tiene ${money(r.otras[0][1])})`
                    : r.accion === "ampliacion" ? `Ampliación de dictamen${r.otrasDisp ? ` (otras unidades solo tienen ${money(r.otrasDisp)})` : ""}`
                    : "Pedir revalidación de los CR en error"}
                </td>
                <td style={td}>{r.facturas.map((f) => <div key={f.id}><LinkF f={f} /> · {f.folio_proveedor} · {money(f.importe_factura)}{f.cr_contrarecibo ? ` · CR ${f.cr_contrarecibo}` : " · sin CR"}{a.sem.get(f.id)?.error ? <strong style={{ color: "var(--rojo)" }}> · error de presupuesto</strong> : ""}</div>)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p style={{ fontSize: 13, margin: 0 }}>Todos los contratos con dictamen cargado alcanzan para lo pendiente.</p>}
      </div>

      {/* 2. Pedido-recepción recibido */}
      <div style={card}>
        <Titulo id="pr" color="#2b6cb0" n={a.conPR.length} t="Facturas con pedido-recepción ya generado y sin mandar a OOAD" sub={a.cuentas.prNuevos ? `${a.cuentas.prNuevos} recibido(s) en los últimos 7 días` : ""} />
        {a.conPR.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Factura", "Proveedor", "Importe", "Pedido / recepción", "¿Lista para OOAD?", "Dictamen"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{a.conPR.map(({ f, lista, dias, nuevo, sem }) => (
              <tr key={f.id} style={{ background: nuevo ? "#f0f7ff" : undefined }}>
                <td style={td}><LinkF f={f} />{nuevo && <span style={{ marginLeft: 6, fontSize: 11, color: "#2b6cb0", fontWeight: 700 }}>NUEVO</span>}<div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}</div></td>
                <td style={td}>{f.proveedores?.razon_social}</td>
                <td style={tdN}>{money(f.importe_factura)}</td>
                <td style={td}>{[f.numero_pedido && `Ped. ${f.numero_pedido}`, f.numero_recepcion && `Rec. ${f.numero_recepcion}`].filter(Boolean).join(" · ") || "—"}{dias != null && <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>hace {dias} día(s)</div>}</td>
                <td style={{ ...td, fontWeight: 600, color: lista ? "var(--verde)" : "#92400e" }}>{lista ? "Sí: ya puedes mandarla a OOAD" : `Faltan firmas (${LABEL_FIRMAS[f.estatus_firmas] || f.estatus_firmas})`}</td>
                <td style={td}><Semaforo s={sem} /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p style={{ fontSize: 13, margin: 0 }}>No hay facturas con pedido-recepción pendientes de mandar.</p>}
      </div>

      {/* 3. Listas para OOAD */}
      <div style={card}>
        <Titulo id="ooad" color="var(--verde)" n={a.listasOOAD.length} t="Listas para mandar a OOAD (firmas y pedido-recepción completos)" sub={a.cuentas.listasSinDinero ? `${a.cuentas.listasSinDinero} sin dinero en el dictamen: resuélvelo antes de mandarlas` : ""} />
        {a.listasOOAD.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Factura", "Proveedor", "Importe", "Estatus", "Dictamen"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{a.listasOOAD.slice().sort((x, y) => (["rojo", "ambar"].includes(y.sem?.nivel)) - (["rojo", "ambar"].includes(x.sem?.nivel))).map(({ f, sem }) => (
              <tr key={f.id}>
                <td style={td}><LinkF f={f} /><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}</div></td>
                <td style={td}>{f.proveedores?.razon_social}</td>
                <td style={tdN}>{money(f.importe_factura)}</td>
                <td style={td}>{LABEL_GENERAL[f.estatus_general] || f.estatus_general}</td>
                <td style={td}><Semaforo s={sem} /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p style={{ fontSize: 13, margin: 0 }}>No hay facturas listas para OOAD.</p>}
      </div>

      {/* 4. CR en error */}
      {a.enError.length > 0 && (
        <div style={card}>
          <Titulo id="error" color="var(--rojo)" n={a.enError.length} t="CR con error de presupuesto en FINAT" sub="se quedan atorados hasta que haya dinero y OOAD los revalide" />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Factura", "Proveedor", "Importe", "CR", "Dictamen"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{a.enError.map((f) => (
              <tr key={f.id}><td style={td}><LinkF f={f} /></td><td style={td}>{f.proveedores?.razon_social}</td><td style={tdN}>{money(f.importe_factura)}</td><td style={td}>{f.cr_contrarecibo}</td><td style={td}><Semaforo s={a.sem.get(f.id)} /></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
