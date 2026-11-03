"use client";
// Estilos y piezas que comparten las pestañas de Fondo fijo.
export const et = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--texto-suave)", marginBottom: 3 };
export const inp = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14, background: "var(--blanco)", color: "var(--texto)" };
export const tarjeta = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 12, padding: 14 };
export const rejilla = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10 });
export const dos = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14, alignItems: "start" };
export const th = { textAlign: "left", padding: "6px 8px", borderBottom: "2px solid var(--borde)", fontSize: 12, color: "var(--texto-suave)", whiteSpace: "nowrap" };
export const td = { padding: "6px 8px", borderBottom: "1px solid var(--borde)", fontSize: 13, verticalAlign: "top" };
export const titulo = { fontSize: 12, fontWeight: 700, color: "var(--texto-suave)", marginBottom: 8 };
export const pestana = (a) => ({ padding: "8px 14px", borderRadius: 8, border: `1px solid ${a ? "var(--verde-oscuro)" : "var(--borde)"}`, background: a ? "var(--verde-oscuro)" : "var(--blanco)", color: a ? "#fff" : "var(--texto)", fontWeight: 600, fontSize: 14, cursor: "pointer" });
export const chico = { padding: "5px 10px", fontSize: 13, whiteSpace: "nowrap" };

export function Avisos({ lista, verbo = "No deja guardar" }) {
  return <>{lista.map((a) => <div key={a.t} style={{ background: a.nivel === "bloquea" ? "var(--rojo-claro)" : "#fef3c7", color: a.nivel === "bloquea" ? "var(--rojo)" : "#92400e", borderRadius: 8, padding: "7px 10px", fontSize: 13, marginBottom: 6 }}><strong>{a.nivel === "bloquea" ? `${verbo}:` : "Aviso:"}</strong> {a.t}</div>)}</>;
}
export function Mensaje({ msg }) {
  if (!msg) return null;
  return <div style={{ background: msg.error ? "var(--rojo-claro)" : "var(--verde-claro)", color: msg.error ? "var(--rojo)" : "var(--verde-oscuro)", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontWeight: 600, margin: "8px 0" }}>{msg.t}</div>;
}
export const fCorta = (iso) => { const [a, m, d] = String(iso || "").split("-"); return a && m && d ? `${d}/${m}/${a}` : "—"; };
