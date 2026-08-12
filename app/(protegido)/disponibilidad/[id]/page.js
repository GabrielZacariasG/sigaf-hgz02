"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { LABEL_GENERAL, LABEL_FIRMAS, LABEL_PEDIDO } from "../../../../lib/estatus";

const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const MESES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesAnio = (m, a) => (m && a ? `${MESES[m]} ${a}` : "—");

export default function DetalleCuentaPage() {
  const { id } = useParams();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [partida, setPartida] = useState(null);
  const [disp, setDisp] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [devengo, setDevengo] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Sesión no iniciada."); setCargando(false); return; }

      const rP = await supabase.from("partidas").select("id, cuenta_finat, nombre").eq("id", id).maybeSingle();
      if (rP.error || !rP.data) { setError("No se encontró la cuenta."); setCargando(false); return; }
      setPartida(rP.data);
      const cuenta = rP.data.cuenta_finat;

      const [rF, rD, rDev] = await Promise.all([
        supabase.from("facturas").select(
          "id, folio_ingreso, folio_proveedor, importe_factura, es_pasivo, mes_presupuestal, anio_presupuestal, tipo_entrega, num_pacientes, cr_contrarecibo, periodo_inicio, periodo_fin, estatus_general, estatus_firmas, estatus_pedido_recepcion, contratos ( numero_interno, vigencia_inicio, vigencia_fin )"
        ).eq("partida_id", id),
        cuenta ? supabase.from("disponibilidad_presupuestal").select("*").eq("cuenta_prei", cuenta).eq("periodo", "2026").maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("ajustes_devengo").select("importe, contratos!inner(partida_id)").eq("contratos.partida_id", id),
      ]);

      if (rF.error) { setError("No se pudieron leer las facturas: " + rF.error.message); setCargando(false); return; }
      setFacturas(rF.data || []);
      setDisp(rD.data || null);
      setDevengo((rDev.data || []).reduce((a, x) => a + Number(x.importe || 0), 0));
      setCargando(false);
    })();
  }, [id]);

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  const gastoFacturas = facturas.reduce((a, f) => a + Number(f.importe_factura || 0), 0);
  const gastoTotal = gastoFacturas + devengo;
  const pasivo = facturas.filter((f) => f.es_pasivo).reduce((a, f) => a + Number(f.importe_factura || 0), 0);
  const gasto2026 = gastoTotal - pasivo;
  const reflejado = facturas.filter((f) => f.cr_contrarecibo).reduce((a, f) => a + Number(f.importe_factura || 0), 0);
  const finat = disp ? Number(disp.gasto || 0) : null;
  const enTramite = gastoTotal - reflejado;
  const facturaSinCr = facturas.filter((f) => !f.cr_contrarecibo).reduce((a, f) => a + Number(f.importe_factura || 0), 0);

  const porContrato = {};
  for (const f of facturas) {
    const num = f.contratos?.numero_interno || "—";
    const c = (porContrato[num] ||= { num, vig_ini: f.contratos?.vigencia_inicio, vig_fin: f.contratos?.vigencia_fin, n: 0, gasto: 0, reflejado: 0 });
    c.n++; c.gasto += Number(f.importe_factura || 0);
    if (f.cr_contrarecibo) c.reflejado += Number(f.importe_factura || 0);
  }
  const contratos = Object.values(porContrato).sort((a, b) => b.gasto - a.gasto);
  const sinReflejar = facturas.filter((f) => !f.cr_contrarecibo);

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "16px 18px" };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13, verticalAlign: "top" };
  const badge = (txt, bg, col) => <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: bg, color: col, whiteSpace: "nowrap" }}>{txt}</span>;

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        <Link href="/disponibilidad" style={{ color: "var(--verde)" }}>← Todas las cuentas</Link>
      </div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Disponibilidad presupuestal</h1>
      <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
        Cuenta {partida?.cuenta_finat || "—"} · {partida?.nombre} · ejercicio 2026
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 16 }}>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Presupuesto 2026</div><div style={{ fontSize: 21, fontWeight: 700 }}>{disp ? money(disp.presupuesto) : "—"}</div>{disp && <div style={{ fontSize: 11, color: "var(--texto-suave)", marginTop: 4 }}>Disponible: {money(disp.disponible)}</div>}</div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Gasto total (con devengo)</div><div style={{ fontSize: 21, fontWeight: 700 }}>{money(gastoTotal)}</div><div style={{ fontSize: 11, color: "var(--texto-suave)", marginTop: 4 }}>{facturas.length} facturas + devengo</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Pasivo (periodo anterior)</div><div style={{ fontSize: 21, fontWeight: 700, color: "#B45309" }}>{money(pasivo)}</div><div style={{ fontSize: 11, color: "var(--texto-suave)", marginTop: 4 }}>{facturas.filter(f => f.es_pasivo).length} facturas</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Gasto ejercicio 2026</div><div style={{ fontSize: 21, fontWeight: 700 }}>{money(gasto2026)}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Devengado</div><div style={{ fontSize: 21, fontWeight: 700 }}>{money(devengo)}</div><div style={{ fontSize: 11, color: "var(--texto-suave)", marginTop: 4 }}>no es factura</div></div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 26, marginBottom: 8 }}>Desglose por contrato</h2>
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Contrato</th><th style={th}>Vigencia</th><th style={{ ...th, textAlign: "right" }}>Facturas</th><th style={{ ...th, textAlign: "right" }}>Gasto</th><th style={{ ...th, textAlign: "right" }}>Reflejado (FINAT)</th><th style={{ ...th, textAlign: "right" }}>En trámite</th></tr></thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.num}>
                  <td style={td}>{c.num}</td>
                  <td style={td}>{c.vig_ini ? `${c.vig_ini} → ${c.vig_fin}` : "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{c.n}</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(c.gasto)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(c.reflejado)}</td>
                  <td style={{ ...td, textAlign: "right", color: c.gasto - c.reflejado > 0 ? "var(--rojo)" : "inherit" }}>{money(c.gasto - c.reflejado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 26, marginBottom: 8 }}>Conciliación contra FINAT (dispo)</h2>
      <div style={{ ...card, maxWidth: 580 }}>
        <Row k="Gasto según SIGAF (con devengo)" v={money(gastoTotal)} />
        <Row k="Gasto según FINAT (dispo)" v={finat != null ? money(finat) : "—"} />
        <Row k="Diferencia (en trámite)" v={money(finat != null ? gastoTotal - finat : enTramite)} bold col="var(--rojo)" />
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--texto-suave)" }}>Explicación de la diferencia:</div>
        <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12 }}>
          {sinReflejar.map((f) => (<li key={f.id}>Factura {f.folio_proveedor} sin contra recibo: {money(f.importe_factura)}</li>))}
          {devengo > 0 && <li>Devengo (no es factura): {money(devengo)}</li>}
        </ul>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 26, marginBottom: 8 }}>Detalle de facturas ({facturas.length})</h2>
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Folio prov.</th><th style={{ ...th, textAlign: "right" }}>Importe</th><th style={th}>Entrega</th>
              <th style={{ ...th, textAlign: "right" }}>Pac.</th><th style={th}>Periodo servicio</th><th style={th}>Mes presup.</th>
              <th style={th}>Pasivo</th><th style={th}>General</th><th style={th}>Firmas</th><th style={th}>Pedido-recep.</th><th style={th}>CR</th>
            </tr></thead>
            <tbody>
              {facturas.slice().sort((a, b) => (a.periodo_fin || "").localeCompare(b.periodo_fin || "")).map((f) => (
                <tr key={f.id} style={!f.cr_contrarecibo ? { background: "#fef2f2" } : {}}>
                  <td style={td}>{f.folio_proveedor}</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td>
                  <td style={td}>{f.tipo_entrega === "FARMACIA" ? badge("Farmacia", "#eef2ff", "#3730a3") : (f.tipo_entrega || "—")}</td>
                  <td style={{ ...td, textAlign: "right" }}>{f.num_pacientes ?? "—"}</td>
                  <td style={td}>{f.periodo_inicio}{f.periodo_fin && f.periodo_fin !== f.periodo_inicio ? ` → ${f.periodo_fin}` : ""}</td>
                  <td style={td}>{mesAnio(f.mes_presupuestal, f.anio_presupuestal)}</td>
                  <td style={td}>{f.es_pasivo ? badge("Pasivo", "#fffbeb", "#B45309") : "—"}</td>
                  <td style={td}>{LABEL_GENERAL[f.estatus_general] || f.estatus_general}</td>
                  <td style={td}>{LABEL_FIRMAS[f.estatus_firmas] || f.estatus_firmas}</td>
                  <td style={td}>{LABEL_PEDIDO[f.estatus_pedido_recepcion] || f.estatus_pedido_recepcion}</td>
                  <td style={td}>{f.cr_contrarecibo || <span style={{ color: "var(--rojo)" }}>sin CR</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 12 }}>
        Renglones en rojo: facturas sin contra recibo (aún no reflejadas en FINAT). Todos los totales se calculan con <code>SUM()</code> sobre las filas mostradas, sin rangos fijos.
      </p>
    </div>
  );
}

function Row({ k, v, bold, col }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--borde)" }}>
      <span style={{ fontSize: 13 }}>{k}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: col || "inherit" }}>{v}</span>
    </div>
  );
}
