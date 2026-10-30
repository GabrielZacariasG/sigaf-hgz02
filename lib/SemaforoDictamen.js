"use client";

// Recuadro del semáforo de dictamen para una factura (captura y detalle). s = semáforo de lib/avisos.js.
const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const COLOR = { verde: ["#e6f4ea", "#1e7a3c", "#9fd3b0"], ambar: ["#fef3c7", "#92400e", "#f5d48a"], rojo: ["#fee2e2", "#b91c1c", "#f4b4b4"], validada: ["#e0ecff", "#1d4ed8", "#a9c4f5"], gris: ["#f4f4f4", "#555", "#ddd"] };
const ICONO = { verde: "🟢", ambar: "🟡", rojo: "🔴", validada: "🔵", gris: "⚪" };

export default function SemaforoDictamen({ s, disponible, resumen, titulo = "¿Hay dinero en el dictamen?", cargando }) {
  if (cargando) return <div style={{ fontSize: 13, color: "var(--texto-suave)", margin: "10px 0" }}>Revisando el dictamen del contrato…</div>;
  if (!s) return null;
  const [bg, fg, borde] = COLOR[s.nivel] || COLOR.gris;
  return (
    <div style={{ background: bg, border: `1px solid ${borde}`, borderRadius: 10, padding: "10px 12px", margin: "10px 0", fontSize: 13.5 }}>
      <div style={{ fontSize: 12, color: fg, opacity: 0.85, marginBottom: 2 }}>{titulo}{s.dictamen ? ` · ${s.esPasivo ? "dictamen de pasivo" : "dictamen"} ${s.dictamen}` : ""}</div>
      <div style={{ color: fg, fontWeight: 700 }}>{ICONO[s.nivel]} {s.t}</div>
      {s.dictamen && disponible != null && (
        <div style={{ fontSize: 12.5, color: "#333", marginTop: 4 }}>
          Disponible del HGZ 2 en el dictamen: <strong>{money(disponible)}</strong>
          {resumen?.faltante > 0.5 && <> · al contrato le faltan <strong>{money(resumen.faltante)}</strong> para todo lo pendiente</>}
          {resumen?.otras?.length > 0 && <> · otras unidades: {resumen.otras.map(([ui, v]) => `UI ${ui} ${money(v)}`).join(", ")}</>}
        </div>
      )}
      {s.error && <div style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 4, fontWeight: 600 }}>Su CR está en error de presupuesto en FINAT.</div>}
    </div>
  );
}
