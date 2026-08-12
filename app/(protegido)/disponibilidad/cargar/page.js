"use client";

import { useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const PERIODO = "2026";

// Columnas del reporte FINAT "Disponibilidad Presupuestal" (IMKK022):
// A=Cuenta, G=Presupuesto, H=Gasto, I=Comprometido, J=Precomprometido, K=Disponible
export default function CargarDispoPage() {
  const [filas, setFilas] = useState([]);
  const [nombreArch, setNombreArch] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState("");

  const onFile = async (e) => {
    setError(""); setOk(""); setFilas([]);
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArch(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      // localizar la fila de encabezado (contiene "Cuenta")
      let hdr = -1;
      for (let r = 0; r < Math.min(grid.length, 30); r++) {
        if ((grid[r] || []).some((c) => String(c).trim().toLowerCase() === "cuenta")) { hdr = r; break; }
      }
      if (hdr < 0) { setError("No encontré la fila de encabezado con 'Cuenta'. ¿Es el reporte de disponibilidad?"); return; }

      const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };
      const agg = {};
      for (let r = hdr + 1; r < grid.length; r++) {
        const row = grid[r] || [];
        const cta = String(row[0] ?? "").trim();
        if (!/^\d{6,}$/.test(cta)) continue; // solo cuentas contables válidas
        const a = (agg[cta] ||= { cuenta: cta, presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 });
        a.presupuesto += num(row[6]); a.gasto += num(row[7]); a.comprometido += num(row[8]);
        a.precomprometido += num(row[9]); a.disponible += num(row[10]);
      }
      const arr = Object.values(agg).sort((x, y) => y.presupuesto - x.presupuesto);
      if (!arr.length) { setError("No se encontraron filas de cuentas en el archivo."); return; }
      setFilas(arr);
    } catch (err) {
      setError("No se pudo leer el archivo: " + err.message);
    }
  };

  const guardar = async () => {
    setGuardando(true); setError(""); setOk("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sesión no iniciada."); setGuardando(false); return; }
    const payload = filas.map((f) => ({
      cuenta_prei: f.cuenta, periodo: PERIODO,
      presupuesto: f.presupuesto, gasto: f.gasto, comprometido: f.comprometido,
      precomprometido: f.precomprometido, disponible: f.disponible, actualizado_at: new Date().toISOString(),
    }));
    const { error: e } = await supabase.from("disponibilidad_presupuestal").upsert(payload, { onConflict: "cuenta_prei,periodo" });
    if (e) { setError("No se pudo guardar: " + e.message); setGuardando(false); return; }
    setOk(`Disponibilidad actualizada: ${payload.length} cuenta(s) del reporte, ejercicio ${PERIODO}.`);
    setGuardando(false);
  };

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "16px 18px" };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13 };

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        <Link href="/disponibilidad" style={{ color: "var(--verde)" }}>← Disponibilidad</Link>
      </div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Cargar disponibilidad (reporte FINAT / dispo)</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 720 }}>
        Descarga el reporte de disponibilidad presupuestal de FINAT (formato PeopleSoft IMKK022) y súbelo aquí.
        Se agrega por cuenta contable y actualiza <strong>todas las cuentas de una vez</strong> para el ejercicio {PERIODO}.
        Nada se calcula a mano: el archivo es la fuente.
      </p>

      <div style={{ ...card, marginTop: 12 }}>
        <input type="file" accept=".xls,.xlsx,.csv" onChange={onFile} />
        {nombreArch && <span style={{ marginLeft: 10, fontSize: 13, color: "var(--texto-suave)" }}>{nombreArch}</span>}
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}
      {ok && <p style={{ color: "var(--verde-oscuro, var(--verde))", fontSize: 14, marginTop: 12, fontWeight: 600 }}>{ok}</p>}

      {filas.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Vista previa — {filas.length} cuentas detectadas</h2>
            <button className="boton" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : `Guardar ${filas.length} cuentas`}
            </button>
          </div>
          <div style={{ ...card, padding: 0, overflow: "hidden", marginTop: 10 }}>
            <div style={{ overflowX: "auto", maxHeight: 460 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>Cuenta</th>
                  <th style={{ ...th, textAlign: "right" }}>Presupuesto</th>
                  <th style={{ ...th, textAlign: "right" }}>Gasto</th>
                  <th style={{ ...th, textAlign: "right" }}>Comprometido</th>
                  <th style={{ ...th, textAlign: "right" }}>Precomprom.</th>
                  <th style={{ ...th, textAlign: "right" }}>Disponible</th>
                </tr></thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.cuenta}>
                      <td style={td}>{f.cuenta}</td>
                      <td style={{ ...td, textAlign: "right" }}>{money(f.presupuesto)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{money(f.gasto)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{money(f.comprometido)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{money(f.precomprometido)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{money(f.disponible)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 10 }}>
            Solo las cuentas que además tienen facturas capturadas en SIGAF mostrarán su tablero completo; el resto queda
            guardado para cuando se carguen sus facturas.
          </p>
        </>
      )}
    </div>
  );
}
