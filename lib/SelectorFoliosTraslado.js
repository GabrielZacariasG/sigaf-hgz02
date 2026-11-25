"use client";

// Selector de folios de traslado (autobuses) para una factura — igual que subrogados pero con los datos del SCACE
// (viaje, destino, boletos, importe emitido). Se palomean uno por uno y la suma se compara contra la factura.
// La clave de selección es el FOLIO (llave primaria de traslados_folios).
import { useMemo, useState } from "react";
import { NOMBRE_CIUDAD } from "./traslados";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fecha = (f) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : "—");

export default function SelectorFoliosTraslado({ folios, seleccion, onCambio, importeFactura, titulo = "Folios de traslado (SCACE) que cobra esta factura", bloqueado = false }) {
  const [ciudad, setCiudad] = useState("");
  const [busca, setBusca] = useState("");
  const ciudades = useMemo(() => [...new Set(folios.map((f) => f.ciudad).filter(Boolean))].sort(), [folios]);
  const q = busca.trim().toUpperCase();
  const visibles = folios.filter((f) => (!ciudad || f.ciudad === ciudad) && (!q || `${f.folio} ${f.unidad_receptora} ${f.especialidad}`.toUpperCase().includes(q)));
  const suma = folios.filter((f) => seleccion.has(f.folio)).reduce((s, f) => s + (Number(f.importe_emitido) || 0), 0);
  const dif = Math.round(((Number(importeFactura) || 0) - suma) * 100) / 100;
  const cambia = (folio, si) => { if (bloqueado) return; const n = new Set(seleccion); si ? n.add(folio) : n.delete(folio); onCambio(n); };
  const todos = (si) => { if (bloqueado) return; const n = new Set(seleccion); for (const f of visibles) si ? n.add(f.folio) : n.delete(f.folio); onCambio(n); };
  const td = { fontSize: 12.5, padding: "4px 6px", borderBottom: "1px solid var(--borde)" };

  return (
    <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "10px 12px", margin: "10px 0" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <strong style={{ fontSize: 14 }}>{titulo}</strong>
        {bloqueado && <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, padding: "2px 8px" }}>🔒 Factura pagada — folios atrapados (solo lectura)</span>}
        <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>{folios.length} viajes en devengo del contrato</span>
        <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={{ marginLeft: "auto", fontSize: 12.5, padding: "3px 6px" }}>
          <option value="">Todos los destinos</option>{ciudades.map((c) => <option key={c} value={c}>{NOMBRE_CIUDAD[c] || c}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar folio, unidad, especialidad…" style={{ fontSize: 12.5, padding: "3px 8px", minWidth: 200 }} />
      </div>
      <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid var(--borde)", borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ position: "sticky", top: 0, background: "#f3f4f6" }}>
            <th style={{ ...td, width: 28 }}><input type="checkbox" disabled={bloqueado} title="Todos los visibles" checked={visibles.length > 0 && visibles.every((f) => seleccion.has(f.folio))} onChange={(e) => todos(e.target.checked)} /></th>
            {["Folio", "Viaje", "Destino", "Boletos", "Importe"].map((h) => <th key={h} style={{ ...td, textAlign: h === "Importe" || h === "Boletos" ? "right" : "left", fontWeight: 600 }}>{h}</th>)}
          </tr></thead>
          <tbody>{visibles.map((f) => (
            <tr key={f.folio} onClick={() => cambia(f.folio, !seleccion.has(f.folio))} style={{ cursor: bloqueado ? "default" : "pointer", background: seleccion.has(f.folio) ? "#e6f4ea" : undefined }}>
              <td style={td}><input type="checkbox" disabled={bloqueado} checked={seleccion.has(f.folio)} onChange={(e) => cambia(f.folio, e.target.checked)} onClick={(e) => e.stopPropagation()} /></td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{f.folio}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{fecha(f.fecha_viaje)}</td>
              <td style={td}>{NOMBRE_CIUDAD[f.ciudad] || f.ciudad || "—"}{f.unidad_receptora ? ` · ${f.unidad_receptora}` : ""}</td>
              <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{f.boletos ?? "—"}</td>
              <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(f.importe_emitido)}</td>
            </tr>
          ))}
          {!visibles.length && <tr><td colSpan={6} style={{ ...td, color: "var(--texto-suave)" }}>Sin viajes en devengo con ese filtro.</td></tr>}</tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 13.5 }}>
        <span>Seleccionados: <strong>{seleccion.size}</strong></span>
        <span>Suma emitida: <strong>{money(suma)}</strong></span>
        <span>Factura: <strong>{money(importeFactura)}</strong></span>
        {seleccion.size > 0 && (Math.abs(dif) <= 1
          ? <span style={{ color: "var(--verde)", fontWeight: 700 }}>✓ Cuadra con la factura</span>
          : <span style={{ color: "var(--texto-suave)" }}>{dif > 0 ? `La factura cobra ${money(dif)} más que lo emitido` : `Lo emitido suma ${money(-dif)} más que la factura`} · solo informativo, no impide guardar</span>)}
      </div>
    </div>
  );
}
