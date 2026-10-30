"use client";

// Selector de folios de subrogados para una factura (captura y detalle).
// Muestra los folios pendientes (devengo) del contrato; se palomean uno por uno y la suma se compara contra la factura.
import { useMemo, useState } from "react";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const MESES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const fecha = (f) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : "—");

export default function SelectorFolios({ folios, seleccion, onCambio, importeFactura, titulo = "Folios de subrogados que cobra esta factura" }) {
  const [mes, setMes] = useState("");
  const [busca, setBusca] = useState("");
  const meses = useMemo(() => [...new Set(folios.map((f) => f.mes).filter(Boolean))].sort((a, b) => a - b), [folios]);
  const q = busca.trim().toUpperCase();
  const visibles = folios.filter((f) => (!mes || f.mes === Number(mes)) && (!q || `${f.folio} ${f.paciente} ${f.estudio}`.toUpperCase().includes(q)));
  const suma = folios.filter((f) => seleccion.has(f.clave)).reduce((s, f) => s + (Number(f.importe) || 0), 0);
  const dif = Math.round(((Number(importeFactura) || 0) - suma) * 100) / 100;
  const cambia = (clave, si) => { const n = new Set(seleccion); si ? n.add(clave) : n.delete(clave); onCambio(n); };
  const todos = (si) => { const n = new Set(seleccion); for (const f of visibles) si ? n.add(f.clave) : n.delete(f.clave); onCambio(n); };
  const td = { fontSize: 12.5, padding: "4px 6px", borderBottom: "1px solid var(--borde)" };

  return (
    <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "10px 12px", margin: "10px 0" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <strong style={{ fontSize: 14 }}>{titulo}</strong>
        <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>{folios.length} pendientes (devengo) del contrato</span>
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ marginLeft: "auto", fontSize: 12.5, padding: "3px 6px" }}>
          <option value="">Todos los meses</option>{meses.map((m) => <option key={m} value={m}>{MESES[m]}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar folio, paciente, estudio…" style={{ fontSize: 12.5, padding: "3px 8px", minWidth: 200 }} />
      </div>
      <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid var(--borde)", borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ position: "sticky", top: 0, background: "#f3f4f6" }}>
            <th style={{ ...td, width: 28 }}><input type="checkbox" title="Todos los visibles" checked={visibles.length > 0 && visibles.every((f) => seleccion.has(f.clave))} onChange={(e) => todos(e.target.checked)} /></th>
            {["Folio", "Fecha", "Paciente", "Estudio", "Importe"].map((h) => <th key={h} style={{ ...td, textAlign: h === "Importe" ? "right" : "left", fontWeight: 600 }}>{h}</th>)}
          </tr></thead>
          <tbody>{visibles.map((f) => (
            <tr key={f.clave} onClick={() => cambia(f.clave, !seleccion.has(f.clave))} style={{ cursor: "pointer", background: seleccion.has(f.clave) ? "#e6f4ea" : undefined }}>
              <td style={td}><input type="checkbox" checked={seleccion.has(f.clave)} onChange={(e) => cambia(f.clave, e.target.checked)} onClick={(e) => e.stopPropagation()} /></td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{f.folio}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>{fecha(f.fecha)}</td>
              <td style={td}>{f.paciente}</td>
              <td style={td}>{f.estudio}</td>
              <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(f.importe)}</td>
            </tr>
          ))}
          {!visibles.length && <tr><td colSpan={6} style={{ ...td, color: "var(--texto-suave)" }}>Sin folios pendientes con ese filtro.</td></tr>}</tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 13.5 }}>
        <span>Seleccionados: <strong>{seleccion.size}</strong></span>
        <span>Suma de folios: <strong>{money(suma)}</strong></span>
        <span>Factura: <strong>{money(importeFactura)}</strong></span>
        {seleccion.size > 0 && (Math.abs(dif) <= 1
          ? <span style={{ color: "var(--verde)", fontWeight: 700 }}>✓ Cuadra con la factura</span>
          : <span style={{ color: "var(--rojo)", fontWeight: 700 }}>{dif > 0 ? `La factura cobra ${money(dif)} más que los folios` : `Los folios suman ${money(-dif)} más que la factura`}</span>)}
      </div>
    </div>
  );
}
