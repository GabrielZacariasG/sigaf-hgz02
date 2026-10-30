"use client";

// Tabla de revisión de PDF IMKK036 antes de guardar (Dictámenes y Cargar reportes).
import { ANIO } from "./contratos";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaTxt = (f) => (f ? new Date(String(f).slice(0, 10) + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const ACCION = { nuevo: ["Nuevo", "var(--verde)"], actualiza: ["Se actualiza", "var(--verde)"], viejo: ["Más viejo que el cargado: se ignora", "#d69e2e"], repetido: ["Repetido: se usa el más reciente", "var(--texto-suave)"], error: ["No se puede cargar", "var(--rojo)"] };

export default function RevisionDictamenes({ items }) {
  const th = { textAlign: "left", fontSize: 12, padding: "6px 8px", borderBottom: "1px solid var(--borde)", color: "var(--texto-suave)", whiteSpace: "nowrap" };
  const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid var(--borde)", verticalAlign: "top" };
  const tdN = { ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{["Archivo", "Dictamen", "Contrato", "Qué pasa", "Corte", "Disponible HGZ 2", "Enlace del contrato"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>{items.map((r, i) => (
        <tr key={i}>
          <td style={{ ...td, fontSize: 12 }}>{r.archivo}</td>
          <td style={td}>{r.dictamen || "—"}{r.origen ? ` (${r.origen})` : ""}</td>
          <td style={td}>{(r.cs || []).map((c) => c.numero_interno + (c.ligaPasivo ? " (pasivo)" : "")).join(", ") || (r.ok ? <span style={{ color: "var(--texto-suave)" }}>sin contrato en SIGAF</span> : "")}</td>
          <td style={{ ...td, color: ACCION[r.accion][1], fontWeight: 600 }}>{ACCION[r.accion][0]}{r.problema ? <div style={{ fontWeight: 400, fontSize: 12 }}>{r.problema}</div> : null}</td>
          <td style={td}>{r.actual?.corte && r.accion !== "nuevo" ? `${fechaTxt(r.actual.corte)} → ` : ""}{fechaTxt(r.corte)}</td>
          <td style={tdN}>{r.hgNuevo ? <>{r.hgAntes ? `${money(r.hgAntes.disponible)} → ` : ""}<strong>{money(r.hgNuevo.disponible)}</strong></> : ""}</td>
          <td style={{ ...td, fontSize: 12 }}>
            {r.igualar ? (r.igualar.nuevoMaximo != null ? `Sin máximo: se toma ${money(r.igualar.nuevoMaximo)} del dictamen`
              : Math.abs(r.igualar.enlaceAntes - r.igualar.enlaceNuevo) > 0.5 ? `${money(r.igualar.enlaceAntes)} → ${money(r.igualar.enlaceNuevo)} (ajuste ${money(r.igualar.ajuste)})` : "Ya es igual a FINAT")
              : r.hgNuevo ? <span style={{ color: "var(--texto-suave)" }}>{(r.cs || []).some((c) => c.ligaPasivo) ? "Dictamen de pasivo: no cambia el enlace" : (r.cs || []).length > 1 ? "Dictamen en varios contratos: no se iguala" : Number(String(r.dictamen).slice(-4)) !== ANIO ? "Dictamen de otro año: no cambia el enlace" : "—"}</span> : ""}
          </td>
        </tr>
      ))}</tbody>
    </table>
  );
}
