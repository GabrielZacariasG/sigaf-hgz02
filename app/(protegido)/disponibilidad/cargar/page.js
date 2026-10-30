"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import { leerDispoIMKK022, guardarLoteDispo, totalesDispo, UI_HGZ2 } from "../../../../lib/dispo";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaTxt = (f) => (f ? new Date(f + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

// Carga del reporte FINAT "Disponibilidad Presupuestal" (IMKK022): uno o varios archivos a la vez.
// Cada archivo es un corte (su fecha sale de "Fecha Ejec:"). Se guarda la historia por cuenta y mes;
// el más reciente además deja el detalle completo (cuenta × centro de costo × mes) y la dispo por cuenta.
export default function CargarDispoPage() {
  const [lecturas, setLecturas] = useState([]); // [{archivo, fecha, cuentas, mensual, detalle, filasOtras, error}]
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [avance, setAvance] = useState("");

  const onFiles = async (e) => {
    setError(""); setOk(""); setLecturas([]);
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    const res = [];
    for (const file of files) {
      setAvance(`Leyendo ${file.name}…`);
      try { res.push({ archivo: file.name, ...(await leerDispoIMKK022(file)) }); }
      catch (err) { res.push({ archivo: file.name, error: "No se pudo leer: " + err.message }); }
    }
    setAvance("");
    // Un corte por fecha (si hay dos archivos del mismo día, se queda el último seleccionado)
    const porFecha = new Map(); const sinFecha = [];
    for (const r of res) { if (r.error || !r.fecha) sinFecha.push(r); else porFecha.set(r.fecha, r); }
    setLecturas([...[...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)), ...sinFecha]);
  };

  const validas = lecturas.filter((l) => !l.error && l.fecha);

  const guardar = async () => {
    setGuardando(true); setError(""); setOk("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sesión no iniciada."); setGuardando(false); return; }
    let hechos = 0, ultimo = null;
    try {
      ({ hechos, ultimo } = await guardarLoteDispo(supabase, validas, setAvance));
      setOk(`✅ ${hechos} corte(s) guardados${ultimo ? ` · el más reciente (${fechaTxt(ultimo.fecha)}) ya es la disponibilidad vigente` : " (eran fechas anteriores: solo se guardó su historia)"}.`);
    } catch (err) {
      setError(`No se pudieron guardar todos los cortes. Error: ${err.message}`);
    }
    setAvance(""); setGuardando(false);
  };

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "16px 18px" };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13 };
  const tdR = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        <Link href="/disponibilidad" style={{ color: "var(--verde)" }}>← Disponibilidad</Link> · <Link href="/cedula" style={{ color: "var(--verde)" }}>Cédula</Link>
      </div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Cargar disponibilidad (reporte FINAT IMKK022)</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 760 }}>
        Sube el reporte de disponibilidad del día (o <strong>varios a la vez</strong>, por ejemplo los guardados en
        CONTROLES\05. CARGA DISP). Se toma solo la unidad {UI_HGZ2} (HGZ 2) y la fecha de cada archivo.
        Se guarda la historia por cuenta y mes; el más reciente queda como disponibilidad vigente, con su detalle por centro de costo.
      </p>
      <p style={{ fontSize: 13, maxWidth: 760, background: "var(--verde-claro)", padding: "8px 12px", borderRadius: 8 }}>
        Tip: ahora puedes subir la dispo junto con el 1043, 4002, 4007, 1013 y los PDF de dictámenes en <Link href="/comprobantes" style={{ color: "var(--verde)", fontWeight: 600 }}>Cargar reportes</Link>.
      </p>

      <div style={{ ...card, marginTop: 12 }}>
        <input type="file" accept=".xls,.xlsx,.csv" multiple onChange={onFiles} disabled={guardando} />
        {avance && <span style={{ marginLeft: 10, fontSize: 13, color: "var(--texto-suave)" }}>{avance}</span>}
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}
      {ok && <p style={{ color: "var(--verde-oscuro, var(--verde))", fontSize: 14, marginTop: 12, fontWeight: 600 }}>{ok}</p>}

      {lecturas.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Vista previa — {validas.length} corte(s)</h2>
            <button className="boton" onClick={guardar} disabled={guardando || !validas.length}>
              {guardando ? "Guardando…" : `Guardar ${validas.length} corte(s)`}
            </button>
          </div>
          <div style={{ ...card, padding: 0, overflow: "hidden", marginTop: 10 }}>
            <div style={{ overflowX: "auto", maxHeight: 520 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>Fecha</th><th style={th}>Archivo</th>
                  <th style={{ ...th, textAlign: "right" }}>Cuentas</th>
                  <th style={{ ...th, textAlign: "right" }}>Presupuesto</th>
                  <th style={{ ...th, textAlign: "right" }}>Gasto</th>
                  <th style={{ ...th, textAlign: "right" }}>Comprometido</th>
                  <th style={{ ...th, textAlign: "right" }}>Precomprom.</th>
                  <th style={{ ...th, textAlign: "right" }}>Disponible</th>
                  <th style={th}>Nota</th>
                </tr></thead>
                <tbody>
                  {lecturas.map((l) => {
                    if (l.error || !l.fecha) return (
                      <tr key={l.archivo}><td style={td}>—</td><td style={td}>{l.archivo}</td><td colSpan={7} style={{ ...td, color: "var(--rojo)" }}>{l.error || "Sin fecha (Fecha Ejec:)"}</td></tr>
                    );
                    const t = totalesDispo(l.cuentas);
                    return (
                      <tr key={l.fecha}>
                        <td style={td}>{fechaTxt(l.fecha)}</td>
                        <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>{l.archivo}</td>
                        <td style={tdR}>{l.cuentas.length}</td>
                        <td style={tdR}>{money(t.presupuesto)}</td>
                        <td style={tdR}>{money(t.gasto)}</td>
                        <td style={tdR}>{money(t.comprometido)}</td>
                        <td style={tdR}>{money(t.precomprometido)}</td>
                        <td style={{ ...tdR, fontWeight: 600 }}>{money(t.disponible)}</td>
                        <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>{l.filasOtras ? `se ignoraron ${l.filasOtras.toLocaleString("es-MX")} renglones de otras unidades` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
