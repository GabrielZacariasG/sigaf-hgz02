"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

// Misma lógica de etapa que Seguimiento (mantener en sincronía).
function etapaDe(f) {
  if (f.estatus_general === "gasto_reflejado") return "pagada";
  if (f.estatus_general === "devuelta_proveedor") return "devuelta";
  if (["enviada_ooad", "en_tramite_ooad"].includes(f.estatus_general)) return "ooad";
  if (["envio_firmas_admin_contrato", "autorizada_admin_contrato"].includes(f.estatus_firmas)) return "adm_contrato";
  if (["envio_firmas_servicio", "autorizada_servicio"].includes(f.estatus_firmas)) return "servicio";
  return "finanzas";
}
const ETAPAS = [
  { key: "finanzas", label: "En Finanzas", sub: "captura / revisión", color: "#b45309" },
  { key: "servicio", label: "En Servicio", sub: "validación del servicio", color: "#0e7490" },
  { key: "adm_contrato", label: "En Adm. de Contrato", sub: "firma del administrador", color: "#7c3aed" },
  { key: "ooad", label: "En OOAD", sub: "trámite de pago", color: "#2563eb" },
  { key: "pagada", label: "Pagadas", sub: "gasto reflejado", color: "#15803d" },
];

export default function AdminPanel() {
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      let todas = [], desde = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("facturas")
          .select("id, folio_ingreso, folio_proveedor, importe_factura, estatus_general, estatus_firmas, estatus_pedido_recepcion, anulada, capitulos ( nombre ), proveedores ( razon_social ), partidas ( cuenta_finat, cuenta_prei )")
          .eq("anulada", false)
          .range(desde, desde + 999);
        if (error) break;
        todas = todas.concat(data || []);
        if (!data || data.length < 1000) break;
        desde += 1000;
      }
      setFacturas(todas.map((f) => ({
        ...f, etapa: etapaDe(f),
        cap: f.capitulos?.nombre || "—",
        prov: f.proveedores?.razon_social || "—",
        cuenta: f.partidas?.cuenta_finat || f.partidas?.cuenta_prei || "—",
      })));
      setCargando(false);
    })();
  }, []);

  const agg = useMemo(() => {
    const porEtapa = {}, porCap = {};
    let total = 0, pagado = 0, tramite = 0, devuelta = 0, nTotal = 0, nPagado = 0, nTramite = 0;
    for (const f of facturas) {
      const imp = Number(f.importe_factura) || 0;
      const e = f.etapa;
      (porEtapa[e] = porEtapa[e] || { n: 0, monto: 0 }); porEtapa[e].n++; porEtapa[e].monto += imp;
      const c = (porCap[f.cap] = porCap[f.cap] || { n: 0, monto: 0, pagado: 0, tramite: 0, devuelta: 0 });
      c.n++; c.monto += imp;
      if (e === "pagada") { pagado += imp; nPagado++; c.pagado += imp; }
      else if (e === "devuelta") { devuelta += imp; c.devuelta += imp; }
      else { tramite += imp; nTramite++; c.tramite += imp; }
      total += imp; nTotal++;
    }
    const caps = Object.entries(porCap).map(([cap, v]) => ({ cap, ...v })).sort((a, b) => b.monto - a.monto);
    return { porEtapa, caps, total, pagado, tramite, devuelta, nTotal, nPagado, nTramite };
  }, [facturas]);

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return facturas.filter((f) => `${f.folio_ingreso} ${f.folio_proveedor} ${f.prov} ${f.cuenta}`.toLowerCase().includes(t)).slice(0, 40);
  }, [q, facturas]);

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px" };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13.5, verticalAlign: "middle" };
  const etapaLabel = Object.fromEntries(ETAPAS.map((e) => [e.key, e.label]));
  const etapaColor = Object.fromEntries(ETAPAS.map((e) => [e.key, e.color]));

  if (cargando) return <p style={{ padding: 8 }}>Cargando panel…</p>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Panel del Subdirector Administrativo</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 4 }}>Estado de la facturación (solo consulta). {agg.nTotal.toLocaleString("es-MX")} factura(s) activas.</p>

      {/* Totales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginTop: 12 }}>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Facturado (activo)</div><div style={{ fontSize: 22, fontWeight: 800 }}>{money(agg.total)}</div><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{agg.nTotal} factura(s)</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Pagado (gasto reflejado)</div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--verde-oscuro)" }}>{money(agg.pagado)}</div><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{agg.nPagado} · {pct(agg.pagado, agg.total)}% del total</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>En trámite (por pagar)</div><div style={{ fontSize: 22, fontWeight: 800, color: "#2563eb" }}>{money(agg.tramite)}</div><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{agg.nTramite} · {pct(agg.tramite, agg.total)}% del total</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Devueltas al proveedor</div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--ambar)" }}>{money(agg.devuelta)}</div></div>
      </div>

      {/* Pipeline por etapa */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>¿Dónde está detenida la facturación? — por etapa del proceso</div>
        <div style={{ display: "grid", gap: 8 }}>
          {ETAPAS.map((e) => {
            const v = agg.porEtapa[e.key] || { n: 0, monto: 0 };
            const p = pct(v.monto, agg.total);
            return (
              <div key={e.key} style={{ display: "grid", gridTemplateColumns: "180px 1fr 150px", gap: 10, alignItems: "center" }}>
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{e.label}</div><div style={{ fontSize: 11, color: "var(--texto-suave)" }}>{e.sub} · {v.n}</div></div>
                <div style={{ background: "var(--fondo, #f0f2f1)", borderRadius: 6, height: 22, position: "relative", overflow: "hidden" }}>
                  <div style={{ background: e.color, height: "100%", width: `${p}%`, minWidth: v.monto > 0 ? 3 : 0, transition: "width .3s" }} />
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}><span style={{ fontWeight: 700 }}>{money(v.monto)}</span> <span style={{ fontSize: 11, color: "var(--texto-suave)" }}>{p}%</span></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Por capítulo */}
      <div style={{ ...card, marginTop: 14, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700 }}>Por capítulo</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Capítulo</th><th style={{ ...th, textAlign: "right" }}>Facturas</th>
              <th style={{ ...th, textAlign: "right" }}>Total</th><th style={{ ...th, textAlign: "right" }}>Pagado</th>
              <th style={{ ...th, textAlign: "right" }}>En trámite</th><th style={{ ...th, textAlign: "right" }}>Devueltas</th>
            </tr></thead>
            <tbody>
              {agg.caps.map((c) => (
                <tr key={c.cap}>
                  <td style={{ ...td, fontWeight: 600 }}>{c.cap}</td>
                  <td style={{ ...td, textAlign: "right" }}>{c.n}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(c.monto)}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--verde-oscuro)" }}>{money(c.pagado)}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#2563eb" }}>{money(c.tramite)}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.devuelta > 0 ? "var(--ambar)" : "var(--texto-suave)" }}>{money(c.devuelta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buscador */}
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Consultar una factura o proveedor</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Folio de ingreso, folio de proveedor, proveedor o cuenta…"
          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14 }} />
        {q.trim() && (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            {resultados.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--texto-suave)" }}>Sin coincidencias.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>Folio</th><th style={th}>Proveedor</th><th style={th}>Cuenta</th>
                  <th style={th}>Etapa</th><th style={{ ...th, textAlign: "right" }}>Importe</th><th style={th}></th>
                </tr></thead>
                <tbody>
                  {resultados.map((f) => (
                    <tr key={f.id}>
                      <td style={{ ...td, fontWeight: 600 }}>{f.folio_ingreso}<div style={{ fontSize: 11, color: "var(--texto-suave)", fontWeight: 400 }}>{f.folio_proveedor}</div></td>
                      <td style={{ ...td, fontSize: 12 }}>{f.prov}</td>
                      <td style={{ ...td, fontSize: 12 }}>{f.cuenta}</td>
                      <td style={td}><span style={{ fontSize: 12, fontWeight: 700, color: etapaColor[f.etapa] || "var(--texto)" }}>{etapaLabel[f.etapa] || f.etapa}</span></td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(f.importe_factura)}</td>
                      <td style={td}><Link href={`/facturas/${f.id}`} style={{ fontSize: 12, color: "var(--verde)" }}>Ver →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
