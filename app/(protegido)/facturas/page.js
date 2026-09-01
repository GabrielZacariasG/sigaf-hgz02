"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import {
  FLUJO_GENERAL, LABEL_GENERAL,
  FLUJO_FIRMAS, LABEL_FIRMAS,
  FLUJO_PEDIDO, LABEL_PEDIDO,
} from "../../../lib/estatus";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const moneyK = (n) => { const v = Number(n) || 0; return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}k` : money(v); };
const diasEntre = (desde) => Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 86400000));

function ejeInfo(hist, circuito, flujo, valor, alertasMap) {
  const propias = hist.filter((h) => h.circuito === circuito && h.estatus === valor);
  const entrada = propias.length ? propias.reduce((m, h) => (h.fecha > m ? h.fecha : m), propias[0].fecha) : null;
  const dias = entrada != null ? diasEntre(entrada) : null;
  const lim = alertasMap[`${circuito}:${valor}`];
  const estancada = lim != null && dias != null && dias > lim;
  return { dias, lim, estancada, idx: flujo.indexOf(valor), total: flujo.length - 1 };
}

const ESTATUS_COLOR = {
  capturada: "#6b7280", en_revision: "#b45309", enviada_ooad: "#7c3aed",
  en_tramite_ooad: "#2563eb", gasto_reflejado: "#15803d",
};

export default function FacturasListaPage() {
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [fProv, setFProv] = useState("");
  const [fContrato, setFContrato] = useState("");
  const [fEstatus, setFEstatus] = useState(null);
  const [fCapitulo, setFCapitulo] = useState(null);
  const [soloCR, setSoloCR] = useState(false);
  const [soloEstancadas, setSoloEstancadas] = useState(false);
  const [soloDiscrep, setSoloDiscrep] = useState(false);
  const [ocultarCompl, setOcultarCompl] = useState(false);
  const [agrupar, setAgrupar] = useState("none");
  const [abiertos, setAbiertos] = useState({});
  const [sel, setSel] = useState({});         // facturaId -> bool (para enviar al servicio)
  const [memo, setMemo] = useState(null);      // { grupos: [{ jefe, jefatura, filas, folio }] }
  const [enviando, setEnviando] = useState(false);
  const [provJefes, setProvJefes] = useState({}); // proveedor_id -> [{nombre, jefatura}]

  useEffect(() => {
    (async () => {
      const [jp, js] = await Promise.all([
        supabase.from("jefe_proveedor").select("proveedor_id, jefe_id"),
        supabase.from("jefes_servicio").select("id, nombre, jefatura"),
      ]);
      const jmap = {}; (js.data || []).forEach((j) => (jmap[j.id] = j));
      const m = {};
      (jp.data || []).forEach((r) => { const j = jmap[r.jefe_id]; if (j) (m[r.proveedor_id] ||= []).push({ nombre: j.nombre, jefatura: j.jefatura }); });
      setProvJefes(m);
    })();
  }, []);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      let todas = [], desde = 0, rAlertas, rHist;
      for (;;) {
        const [rFac, a, h] = await Promise.all([
          supabase.from("facturas").select(
            "id, folio_ingreso, folio_proveedor, importe_factura, validacion_ok, cr_contrarecibo, estatus_general, estatus_firmas, estatus_pedido_recepcion, contratos ( numero_interno ), proveedores ( razon_social ), capitulos ( nombre )"
          ).range(desde, desde + 999),
          desde === 0 ? supabase.from("alertas_config").select("circuito, estatus, dias_umbral") : Promise.resolve({ data: rAlertas }),
          desde === 0 ? supabase.from("factura_estatus_historial").select("factura_id, circuito, estatus, fecha") : Promise.resolve({ data: rHist }),
        ]);
        if (!activo) return;
        if (rFac.error) { setMensaje("No se pudieron cargar las facturas: " + rFac.error.message); setCargando(false); return; }
        if (desde === 0) { rAlertas = a.data; rHist = h.data; }
        todas = todas.concat(rFac.data || []);
        if (!rFac.data || rFac.data.length < 1000) break;
        desde += 1000;
      }
      const alertasMap = {};
      (rAlertas || []).forEach((a) => (alertasMap[`${a.circuito}:${a.estatus}`] = a.dias_umbral));
      const histPorFactura = {};
      (rHist || []).forEach((h) => (histPorFactura[h.factura_id] ||= []).push(h));
      const filas = todas.map((f) => {
        const hist = histPorFactura[f.id] || [];
        const gen = ejeInfo(hist, "general", FLUJO_GENERAL, f.estatus_general, alertasMap);
        const fir = ejeInfo(hist, "firmas", FLUJO_FIRMAS, f.estatus_firmas, alertasMap);
        const generaPR = ["Integrales", "Servicios Integrales"].includes(f.capitulos?.nombre);
        const ped = ejeInfo(hist, "pedido_recepcion", FLUJO_PEDIDO, f.estatus_pedido_recepcion, alertasMap);
        // Una factura ya reflejada (pagada) está COMPLETADA: no puede estar estancada.
        const completada = f.estatus_general === "gasto_reflejado";
        const estancada = !completada && (gen.estancada || fir.estancada || (generaPR && ped.estancada));
        return {
          ...f, capNom: f.capitulos?.nombre || "—", prov: f.proveedores?.razon_social || "—",
          contrato: f.contratos?.numero_interno || "—", tieneCR: !!String(f.cr_contrarecibo ?? "").trim(),
          gen, fir, ped, generaPR, estancada,
        };
      });
      setFacturas(filas);
      setCargando(false);
    }
    cargar();
    return () => { activo = false; };
  }, []);

  const resumen = useMemo(() => {
    const porEstatus = {}, porCapitulo = {};
    let estancadas = 0, montoTotal = 0, conCR = 0;
    for (const f of facturas) {
      const e = (porEstatus[f.estatus_general] ||= { n: 0, monto: 0 });
      e.n++; e.monto += Number(f.importe_factura) || 0;
      const c = (porCapitulo[f.capNom] ||= { n: 0, monto: 0, refl: 0 });
      c.n++; c.monto += Number(f.importe_factura) || 0;
      if (f.estatus_general === "gasto_reflejado") c.refl++;
      if (f.estancada) estancadas++;
      if (f.tieneCR) conCR++;
      montoTotal += Number(f.importe_factura) || 0;
    }
    return { porEstatus, porCapitulo, estancadas, montoTotal, conCR };
  }, [facturas]);

  const capitulos = useMemo(() => Object.keys(resumen.porCapitulo).sort(), [resumen]);
  const proveedores = useMemo(() => [...new Set(facturas.map((f) => f.prov))].sort(), [facturas]);
  const contratos = useMemo(() => [...new Set(facturas.map((f) => f.contrato))].sort(), [facturas]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const pv = fProv.trim().toLowerCase();
    const ct = fContrato.trim().toLowerCase();
    return facturas.filter((f) => {
      if (fEstatus && f.estatus_general !== fEstatus) return false;
      if (fCapitulo && f.capNom !== fCapitulo) return false;
      if (soloCR && !f.tieneCR) return false;
      if (soloEstancadas && !f.estancada) return false;
      if (soloDiscrep && f.validacion_ok !== false) return false;
      if (ocultarCompl && f.estatus_general === "gasto_reflejado") return false;
      if (pv && !f.prov.toLowerCase().includes(pv)) return false;
      if (ct && !f.contrato.toLowerCase().includes(ct)) return false;
      if (q) {
        const blob = `${f.folio_ingreso} ${f.folio_proveedor} ${f.prov} ${f.contrato} ${f.cr_contrarecibo ?? ""} ${f.importe_factura}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (a.estancada !== b.estancada ? (a.estancada ? -1 : 1)
      : (a.estatus_general === "gasto_reflejado") !== (b.estatus_general === "gasto_reflejado") ? (a.estatus_general === "gasto_reflejado" ? 1 : -1)
      : (b.gen.dias ?? -1) - (a.gen.dias ?? -1)));
  }, [facturas, busqueda, fProv, fContrato, fEstatus, fCapitulo, soloCR, soloEstancadas, soloDiscrep, ocultarCompl]);

  // Agrupación
  const grupos = useMemo(() => {
    if (agrupar === "none") return null;
    const key = agrupar === "prov" ? "prov" : agrupar === "contrato" ? "contrato" : "capNom";
    const g = {};
    for (const f of filtradas) { (g[f[key]] ||= { filas: [], monto: 0 }); g[f[key]].filas.push(f); g[f[key]].monto += Number(f.importe_factura) || 0; }
    return Object.entries(g).sort((a, b) => b[1].filas.length - a[1].filas.length);
  }, [filtradas, agrupar]);

  const hayFiltro = fEstatus || fCapitulo || busqueda || fProv || fContrato || soloCR || soloEstancadas || soloDiscrep || ocultarCompl;
  const montoFiltrado = useMemo(() => filtradas.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0), [filtradas]);
  const seleccionadas = useMemo(() => filtradas.filter((f) => sel[f.id]), [filtradas, sel]);
  const toggleSel = (id) => setSel((p) => ({ ...p, [id]: !p[id] }));

  const enviarServicio = () => {
    if (!seleccionadas.length) return;
    const g = new Map();
    for (const f of seleccionadas) {
      const jefes = provJefes[f.proveedor_id] || [];
      if (!jefes.length) {
        const k = "__sin__"; const grp = g.get(k) || { jefe: "Jefe(a) de Servicio correspondiente", jefatura: "(sin proveedor asignado)", filas: [] };
        grp.filas.push(f); g.set(k, grp);
      } else for (const j of jefes) {
        const grp = g.get(j.nombre) || { jefe: j.nombre, jefatura: j.jefatura, filas: [] };
        grp.filas.push(f); g.set(j.nombre, grp);
      }
    }
    const base = `MEMO-FIN-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const grupos = [...g.values()].map((x, i) => ({ ...x, folio: `${base}-${i + 1}` }));
    setMemo({ grupos });
  };
  const confirmarEnvio = async () => {
    setEnviando(true);
    try {
      const ids = [...new Set(memo.grupos.flatMap((gr) => gr.filas.map((f) => f.id)))];
      for (let i = 0; i < ids.length; i += 25) {
        const lote = ids.slice(i, i + 25);
        await Promise.all(lote.map((id) => supabase.from("facturas").update({ estatus_firmas: "envio_firmas_servicio" }).eq("id", id)));
      }
      setFacturas((prev) => prev.map((f) => (ids.includes(f.id) ? { ...f, estatus_firmas: "envio_firmas_servicio" } : f)));
      setSel({}); setMemo(null);
    } catch (e) { setMensaje("No se pudo enviar: " + e.message); }
    setEnviando(false);
  };

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  // ---- MEMORÁNDUM(s) de envío al servicio, uno por jefe (imprimible limpio) ----
  if (memo) {
    const linea = { display: "grid", gridTemplateColumns: "90px 1fr", gap: 4, fontSize: 13.5 };
    const mH = { textAlign: "left", fontSize: 11.5, padding: "6px 10px", border: "1px solid #444", background: "#f0f0f0", textTransform: "uppercase", letterSpacing: 0.3 };
    const mD = { padding: "6px 10px", border: "1px solid #bbb", fontSize: 12.5 };
    return (
      <div>
        <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="boton secundario" onClick={() => setMemo(null)}>← Volver</button>
          <button className="boton secundario" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
          <button className="boton" onClick={confirmarEnvio} disabled={enviando}>{enviando ? "Enviando…" : "Confirmar envío al servicio"}</button>
          <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>{memo.grupos.length} memo(s) · un jefe por hoja</span>
        </div>
        <div className="hoja">
          {memo.grupos.map((g, gi) => {
            const total = g.filas.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0);
            return (
              <div key={gi} style={{ background: "#fff", color: "#111", border: "1px solid var(--borde)", borderRadius: 6, padding: "44px 52px", maxWidth: 840, margin: "0 auto 18px", lineHeight: 1.5, breakAfter: "page" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "3px solid #7a1737", paddingBottom: 10 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 15 }}>IMSS · Departamento de Finanzas</div><div style={{ fontSize: 11, color: "#555" }}>Instituto Mexicano del Seguro Social · HGZ No. 2</div></div>
                  <div style={{ textAlign: "right", fontSize: 12 }}><div style={{ fontWeight: 700, letterSpacing: 1 }}>MEMORÁNDUM</div><div>{g.folio}</div></div>
                </div>
                <div style={{ marginTop: 22, display: "grid", gap: 5 }}>
                  <div style={linea}><span style={{ color: "#666" }}>Para:</span><span><strong>{g.jefe}</strong>{g.jefatura ? ` — Jefatura de ${g.jefatura}` : ""}</span></div>
                  <div style={linea}><span style={{ color: "#666" }}>De:</span><span><strong>Lic. Nayeli Alonso Orozco</strong> — Jefa del Departamento de Finanzas, HGZ No. 2</span></div>
                  <div style={linea}><span style={{ color: "#666" }}>Fecha:</span><span>Aguascalientes, Ags., a {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}.</span></div>
                  <div style={linea}><span style={{ color: "#666" }}>Asunto:</span><strong>Envío de facturas para validación del servicio</strong></div>
                </div>
                <p style={{ marginTop: 20, textAlign: "justify", fontSize: 14 }}>
                  Por este medio se remiten las siguientes facturas <strong>para su validación</strong>. Se solicita atentamente devolver, según sea el caso,
                  el <strong>oficio de cumplimiento o de incumplimiento</strong> dirigido al <strong>administrador del contrato</strong>.
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
                  <thead><tr><th style={mH}>Folio</th><th style={mH}>Proveedor</th><th style={mH}>Contrato</th><th style={mH}>Periodo</th><th style={{ ...mH, textAlign: "right" }}>Importe</th></tr></thead>
                  <tbody>
                    {g.filas.map((f) => (
                      <tr key={f.id}><td style={mD}>{f.folio_proveedor}</td><td style={mD}>{f.prov}</td><td style={mD}>{f.contrato}</td><td style={mD}>{f.periodo_inicio ?? "—"} → {f.periodo_fin ?? "—"}</td><td style={{ ...mD, textAlign: "right" }}>{money(f.importe_factura)}</td></tr>
                    ))}
                    <tr><td style={mD} colSpan={4}><strong>Total ({g.filas.length} factura{g.filas.length !== 1 ? "s" : ""})</strong></td><td style={{ ...mD, textAlign: "right", fontWeight: 700 }}>{money(total)}</td></tr>
                  </tbody>
                </table>
                <p style={{ marginTop: 26, fontWeight: 700 }}>ATENTAMENTE</p>
                <p style={{ fontSize: 12, fontStyle: "italic", color: "#555" }}>&ldquo;Seguridad y Solidaridad Social&rdquo;</p>
                <div style={{ marginTop: 40, textAlign: "center" }}>_________________________________________<br /><strong>Lic. Nayeli Alonso Orozco</strong><br />Jefa del Departamento de Finanzas · HGZ No. 2</div>
              </div>
            );
          })}
        </div>
        <style>{`@media print { body * { visibility: hidden !important; } .hoja, .hoja * { visibility: visible !important; } .hoja { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
      </div>
    );
  }

  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "9px 12px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "9px 12px", borderBottom: "1px solid var(--borde)", fontSize: 14, verticalAlign: "top" };
  const inp = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14 };
  const celdaCircuito = (eje, label) => (
    <div><div>{label}</div><div style={{ fontSize: 11, color: eje.estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: eje.estancada ? 700 : 400 }}>{eje.idx}/{eje.total}{eje.estancada && ` · ${eje.dias}d ⚠️`}</div></div>
  );
  const chipBtn = (activo, color) => ({
    cursor: "pointer", border: `1px solid ${activo ? (color || "var(--verde)") : "var(--borde)"}`,
    background: activo ? (color ? `color-mix(in srgb, ${color} 14%, transparent)` : "var(--verde-claro)") : "var(--blanco)",
    borderRadius: 10, padding: "8px 12px", minWidth: 118, textAlign: "left",
  });
  const filtroChip = (activo) => ({
    cursor: "pointer", fontSize: 12, padding: "6px 11px", borderRadius: 999,
    border: `1px solid ${activo ? "var(--verde)" : "var(--borde)"}`,
    background: activo ? "var(--verde-claro)" : "var(--blanco)", color: activo ? "var(--verde-oscuro)" : "var(--texto)",
  });

  const Tabla = ({ filas }) => (
    <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden", marginTop: 8 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...th, width: 30 }}></th>
            <th style={th}>Folio / CR</th><th style={th}>Proveedor</th><th style={th}>Contrato</th>
            <th style={th}>General</th><th style={th}>Firmas</th><th style={th}>Pedido-recep.</th>
            <th style={{ ...th, textAlign: "right" }}>Importe</th><th style={th}>Valid.</th>
          </tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} style={sel[f.id] ? { background: "var(--verde-claro)" } : f.estancada ? { background: "var(--rojo-claro)" } : f.estatus_general === "gasto_reflejado" ? { opacity: 0.72 } : {}}>
                <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={!!sel[f.id]} onChange={() => toggleSel(f.id)} /></td>
                <td style={td}>
                  <Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>{f.folio_ingreso}</Link>
                  <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}{f.tieneCR ? <span style={{ color: "var(--verde-oscuro)" }}> · CR {f.cr_contrarecibo}</span> : ""}</div>
                </td>
                <td style={{ ...td, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.prov}</td>
                <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.contrato}<div>{f.capNom}</div></td>
                <td style={td}>
                  <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "color-mix(in srgb, " + (ESTATUS_COLOR[f.estatus_general] || "#888") + " 16%, transparent)", color: ESTATUS_COLOR[f.estatus_general] || "#555", whiteSpace: "nowrap" }}>{LABEL_GENERAL[f.estatus_general] || f.estatus_general}</span>
                  <div style={{ fontSize: 11, color: f.gen.estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: f.gen.estancada ? 700 : 400, marginTop: 3 }}>{f.gen.dias == null ? "—" : `${f.gen.dias}d`}{f.gen.lim != null ? ` / ${f.gen.lim}` : ""}{f.gen.estancada && " ⚠️"}</div>
                </td>
                <td style={td}>{celdaCircuito(f.fir, LABEL_FIRMAS[f.estatus_firmas])}</td>
                <td style={td}>{f.generaPR ? celdaCircuito(f.ped, LABEL_PEDIDO[f.estatus_pedido_recepcion]) : <span style={{ color: "var(--texto-suave)", fontSize: 12 }}>no aplica</span>}</td>
                <td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td>
                <td style={td}>{f.validacion_ok === true ? <span style={{ color: "var(--verde-oscuro)" }}>✓</span> : f.validacion_ok === false ? <span style={{ color: "var(--rojo)" }}>✗</span> : <span style={{ color: "var(--texto-suave)" }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Seguimiento de facturas</h1>
        <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
          {facturas.length} facturas · {money(resumen.montoTotal)} · {resumen.conCR} con CR
          {resumen.estancadas > 0 && <span style={{ color: "var(--rojo)", fontWeight: 600 }}>{" · "}{resumen.estancadas} estancada(s)</span>}
        </div>
      </div>
      {mensaje && <p style={{ color: "var(--rojo)", fontSize: 13 }}>{mensaje}</p>}

      {/* Resumen por estatus */}
      <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 14, marginBottom: 4 }}>Por estatus (clic para filtrar)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FLUJO_GENERAL.map((e) => {
          const r = resumen.porEstatus[e] || { n: 0, monto: 0 };
          return (
            <button key={e} style={chipBtn(fEstatus === e, ESTATUS_COLOR[e])} onClick={() => setFEstatus(fEstatus === e ? null : e)}>
              <div style={{ fontSize: 12, color: ESTATUS_COLOR[e], fontWeight: 600 }}>{LABEL_GENERAL[e] || e}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{r.n}</div>
              <div style={{ fontSize: 11, color: "var(--texto-suave)" }}>{moneyK(r.monto)}</div>
            </button>
          );
        })}
      </div>

      {/* Resumen por capítulo */}
      <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 14, marginBottom: 4 }}>Por capítulo (clic para filtrar)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {capitulos.map((c) => {
          const r = resumen.porCapitulo[c];
          const pct = r.n ? Math.round((100 * r.refl) / r.n) : 0;
          return (
            <button key={c} style={chipBtn(fCapitulo === c)} onClick={() => setFCapitulo(fCapitulo === c ? null : c)}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{c}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{r.n} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--texto-suave)" }}>{moneyK(r.monto)}</span></div>
              <div style={{ height: 5, background: "var(--borde)", borderRadius: 3, marginTop: 4, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "var(--verde)" }} /></div>
              <div style={{ fontSize: 10, color: "var(--texto-suave)", marginTop: 2 }}>{pct}% reflejadas</div>
            </button>
          );
        })}
      </div>

      {/* Buscador + facetas */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar folio, CR, importe…" style={{ ...inp, flex: 2, minWidth: 200 }} />
        <input value={fProv} onChange={(e) => setFProv(e.target.value)} placeholder="Proveedor…" list="lst-prov" style={{ ...inp, flex: 1, minWidth: 160 }} />
        <datalist id="lst-prov">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
        <input value={fContrato} onChange={(e) => setFContrato(e.target.value)} placeholder="Contrato…" list="lst-cont" style={{ ...inp, flex: 1, minWidth: 150 }} />
        <datalist id="lst-cont">{contratos.map((c) => <option key={c} value={c} />)}</datalist>
      </div>

      {/* Chips de filtro rápido + agrupar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
        <button style={filtroChip(soloCR)} onClick={() => setSoloCR((v) => !v)}>Con contrarecibo ({resumen.conCR})</button>
        <button style={filtroChip(soloEstancadas)} onClick={() => setSoloEstancadas((v) => !v)}>Estancadas ({resumen.estancadas})</button>
        <button style={filtroChip(soloDiscrep)} onClick={() => setSoloDiscrep((v) => !v)}>Con discrepancia ✗</button>
        <button style={filtroChip(ocultarCompl)} onClick={() => setOcultarCompl((v) => !v)}>Ocultar completadas</button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--texto-suave)" }}>Agrupar por:</span>
        <select value={agrupar} onChange={(e) => { setAgrupar(e.target.value); setAbiertos({}); }} style={{ ...inp, padding: "7px 10px" }}>
          <option value="none">Ninguno</option>
          <option value="prov">Proveedor</option>
          <option value="contrato">Contrato</option>
          <option value="capNom">Capítulo</option>
        </select>
        {hayFiltro && <button className="boton secundario" onClick={() => { setFEstatus(null); setFCapitulo(null); setBusqueda(""); setFProv(""); setFContrato(""); setSoloCR(false); setSoloEstancadas(false); setSoloDiscrep(false); setOcultarCompl(false); }}>Limpiar</button>}
      </div>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{filtradas.length} factura(s) · {money(montoFiltrado)}</span>
        {seleccionadas.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>{seleccionadas.length} seleccionada(s)</span>
            <button className="boton secundario" onClick={() => setSel({})}>Quitar</button>
            <button className="boton" onClick={enviarServicio}>Enviar al servicio →</button>
          </div>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p style={{ color: "var(--texto-suave)", fontSize: 13, marginTop: 8 }}>Ninguna factura con estos filtros. <Link href="/facturas/nueva">Capturar una</Link>.</p>
      ) : grupos ? (
        <div style={{ marginTop: 8 }}>
          {grupos.map(([nombre, g]) => {
            const open = abiertos[nombre];
            return (
              <div key={nombre} style={{ marginTop: 8 }}>
                <button onClick={() => setAbiertos((p) => ({ ...p, [nombre]: !p[nombre] }))}
                  style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{open ? "▾" : "▸"} {nombre}</span>
                  <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>{g.filas.length} · {money(g.monto)}</span>
                </button>
                {open && <Tabla filas={g.filas} />}
              </div>
            );
          })}
        </div>
      ) : (
        <Tabla filas={filtradas} />
      )}

      <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 14 }}>
        Nada se borra: las completadas se atenúan pero siguen aquí (y buscables por CR). Renglones en rojo = algún eje supera su umbral.
      </p>
    </div>
  );
}
