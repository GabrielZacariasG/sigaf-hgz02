"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const hoy = () => new Date();
const diasHasta = (fecha) => fecha ? Math.round((new Date(fecha).getTime() - hoy().getTime()) / 86400000) : null;
const fechaMX = (d) => d ? new Date(d).toLocaleDateString("es-MX") : "—";

const inp = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14, width: "100%", boxSizing: "border-box" };
const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px" };
const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap" };
const td = { padding: "7px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13, verticalAlign: "top" };

const LABEL_GEN = { capturada: "Capturada", en_revision: "En revisión", enviada_ooad: "Enviada a OOAD", en_tramite_ooad: "En trámite OOAD", gasto_reflejado: "Gasto reflejado", devuelta_proveedor: "Devuelta al proveedor" };
function etapaDe(f) {
  if (f.estatus_general === "gasto_reflejado") return "Pagada";
  if (f.estatus_general === "devuelta_proveedor") return "Devuelta";
  if (["enviada_ooad", "en_tramite_ooad"].includes(f.estatus_general)) return "En OOAD";
  if (["envio_firmas_admin_contrato", "autorizada_admin_contrato"].includes(f.estatus_firmas)) return "En Adm. de Contrato";
  if (["envio_firmas_servicio", "autorizada_servicio"].includes(f.estatus_firmas)) return "En Servicio";
  return "En Finanzas";
}
const ETAPAS = ["En Finanzas", "En Servicio", "En Adm. de Contrato", "En OOAD", "Pagada", "Devuelta"];
function estadoVigencia(fin) {
  const d = diasHasta(fin);
  if (d == null) return "Sin fecha";
  if (d < 0) return "Vencido";
  if (d <= 30) return "Por vencer";
  return "Vigente";
}

export default function ReportesPage() {
  const [facturas, setFacturas] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [repKey, setRepKey] = useState("r1");
  const [filtros, setFiltros] = useState({ contrato: "", proveedor: "", capitulo: "", etapa: "", desde: "", hasta: "", folio: "", concepto: "", soloVencidos: false });
  const [res, setRes] = useState(null); // { columns, rows, totales, titulo }
  const [generando, setGenerando] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      let todas = [], desde = 0;
      for (;;) {
        const { data, error } = await supabase.from("facturas").select(
          "id, folio_ingreso, folio_proveedor, importe_factura, estatus_general, estatus_firmas, estatus_pedido_recepcion, validacion_ok, periodo_inicio, periodo_fin, mes_asignado, anio_asignado, created_at, contrato_id, proveedor_id, contratos ( numero_interno ), proveedores ( razon_social ), capitulos ( nombre )"
        ).range(desde, desde + 999);
        if (error) { setMsg("No se pudieron cargar facturas: " + error.message); break; }
        todas = todas.concat(data || []);
        if (!data || data.length < 1000) break;
        desde += 1000;
      }
      const rC = await supabase.from("contratos").select("id, numero_interno, administrador_contrato, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo, proveedor_id, proveedores ( razon_social ), partidas ( cuenta_finat, capitulos ( nombre ) )").order("numero_interno");
      setFacturas(todas.map((f) => ({
        ...f, prov: f.proveedores?.razon_social || "—", contrato: f.contratos?.numero_interno || "—",
        capNom: f.capitulos?.nombre || "—", etapa: etapaDe(f),
      })));
      setContratos((rC.data || []).map((c) => ({
        ...c, prov: c.proveedores?.razon_social || "—", capNom: c.partidas?.capitulos?.nombre || "—", cuenta: c.partidas?.cuenta_finat || "—",
      })));
      setCargando(false);
    })();
  }, []);

  const proveedores = useMemo(() => [...new Set([...facturas.map((f) => f.prov), ...contratos.map((c) => c.prov)])].filter((x) => x && x !== "—").sort(), [facturas, contratos]);
  const capitulos = useMemo(() => [...new Set([...facturas.map((f) => f.capNom), ...contratos.map((c) => c.capNom)])].filter((x) => x && x !== "—").sort(), [facturas, contratos]);
  const listaContratos = useMemo(() => [...new Set(contratos.map((c) => c.numero_interno))].sort(), [contratos]);

  const REPORTES = [
    { key: "r1", grupo: "Facturas", label: "Facturas por contrato + estatus", desc: "Listado de facturas con su etapa/estatus actual, importe y validación.", filtros: ["contrato", "proveedor", "capitulo", "etapa", "fechas"] },
    { key: "r2", grupo: "Facturas", label: "Detalle de servicios de una factura", desc: "Conceptos, cantidad, precio unitario e importe de una factura (requiere desglose capturado).", filtros: ["folio"] },
    { key: "r3", grupo: "Facturas", label: "Servicios de mayor impacto", desc: "Ranking de conceptos por importe y cantidad (facturas con desglose).", filtros: ["contrato", "capitulo", "fechas"] },
    { key: "r3b", grupo: "Facturas", label: "Consumo de un insumo/concepto", desc: "Cuánto se consumió de un concepto (ej. “jitomate”) en un periodo: en qué facturas y el total. Requiere desglose capturado.", filtros: ["concepto", "contrato", "capitulo", "fechas"] },
    { key: "r7", grupo: "Contratos", label: "Vigencias (semáforo)", desc: "Contratos vigentes / por vencer (≤30 días) / vencidos.", filtros: ["proveedor", "capitulo"] },
    { key: "r8", grupo: "Contratos", label: "Conciliación por contrato", desc: "Contratado vs ejercido vs saldo; pagado vs adeudo (pendiente). Ideal para conciliar con proveedor.", filtros: ["proveedor", "capitulo", "soloVencidos"] },
  ];
  const rep = REPORTES.find((r) => r.key === repKey);
  const setF = (k, v) => setFiltros((p) => ({ ...p, [k]: v }));

  // ---- Generadores de cada reporte ----
  const pasaFactura = (f) => {
    if (filtros.contrato && f.contrato !== filtros.contrato) return false;
    if (filtros.proveedor && f.prov !== filtros.proveedor) return false;
    if (filtros.capitulo && f.capNom !== filtros.capitulo) return false;
    if (filtros.etapa && f.etapa !== filtros.etapa) return false;
    if (filtros.desde && (f.periodo_inicio || "") < filtros.desde) return false;
    if (filtros.hasta && (f.periodo_inicio || "") > filtros.hasta) return false;
    return true;
  };
  const filtraFacturas = () => facturas.filter(pasaFactura);

  async function generar() {
    setGenerando(true); setMsg("");
    try {
      if (repKey === "r1") {
        const filas = filtraFacturas();
        const rows = filas.map((f) => ({
          folio_ingreso: f.folio_ingreso, folio_proveedor: f.folio_proveedor, prov: f.prov, contrato: f.contrato, capNom: f.capNom,
          periodo: `${f.periodo_inicio || "—"} → ${f.periodo_fin || "—"}`, importe: Number(f.importe_factura) || 0,
          estatus: LABEL_GEN[f.estatus_general] || f.estatus_general, etapa: f.etapa,
          valid: f.validacion_ok === true ? "OK" : f.validacion_ok === false ? "Discrepancia" : "—",
        }));
        setRes({
          titulo: "Facturas por contrato + estatus",
          columns: [
            { key: "folio_ingreso", label: "Folio ingreso" }, { key: "folio_proveedor", label: "Folio prov." },
            { key: "prov", label: "Proveedor" }, { key: "contrato", label: "Contrato" }, { key: "capNom", label: "Capítulo" },
            { key: "periodo", label: "Periodo" }, { key: "importe", label: "Importe", money: true, align: "right" },
            { key: "estatus", label: "Estatus" }, { key: "etapa", label: "Etapa" }, { key: "valid", label: "Validación" },
          ],
          rows, totales: { prov: `TOTAL (${rows.length})`, importe: rows.reduce((s, r) => s + r.importe, 0) },
        });
      } else if (repKey === "r2") {
        const q = filtros.folio.trim().toLowerCase();
        if (!q) { setMsg("Escribe el folio (ingreso o proveedor) de la factura."); setGenerando(false); return; }
        const f = facturas.find((x) => (x.folio_ingreso || "").toLowerCase() === q || (x.folio_proveedor || "").toLowerCase() === q)
          || facturas.find((x) => `${x.folio_ingreso} ${x.folio_proveedor}`.toLowerCase().includes(q));
        if (!f) { setMsg("No se encontró esa factura."); setGenerando(false); return; }
        const { data } = await supabase.from("factura_detalle").select("cantidad, contrato_servicios ( nombre_servicio, precio_unitario )").eq("factura_id", f.id);
        const rows = (data || []).map((d) => {
          const precio = Number(d.contrato_servicios?.precio_unitario) || 0;
          const cant = Number(d.cantidad) || 0;
          return { concepto: d.contrato_servicios?.nombre_servicio || "—", cantidad: cant, precio, importe: cant * precio };
        });
        setRes({
          titulo: `Detalle de servicios · ${f.folio_ingreso} (${f.prov})`,
          nota: rows.length === 0 ? "Esta factura no tiene desglose de servicios capturado." : "",
          columns: [
            { key: "concepto", label: "Concepto" }, { key: "cantidad", label: "Cantidad", align: "right" },
            { key: "precio", label: "Precio unit.", money: true, align: "right" }, { key: "importe", label: "Importe", money: true, align: "right" },
          ],
          rows, totales: { concepto: `TOTAL (${rows.length})`, importe: rows.reduce((s, r) => s + r.importe, 0) },
        });
      } else if (repKey === "r3") {
        // Detalle de todas las facturas (o filtradas) agrupado por concepto
        const idsFac = filtraFacturas().map((f) => f.id);
        if (idsFac.length === 0) { setMsg("No hay facturas con esos filtros."); setGenerando(false); return; }
        // Traer detalle por lotes de factura_id
        let det = [];
        for (let i = 0; i < idsFac.length; i += 300) {
          const lote = idsFac.slice(i, i + 300);
          const { data } = await supabase.from("factura_detalle").select("cantidad, factura_id, contrato_servicios ( nombre_servicio, precio_unitario )").in("factura_id", lote);
          det = det.concat(data || []);
        }
        const map = new Map();
        for (const d of det) {
          const nombre = d.contrato_servicios?.nombre_servicio || "—";
          const cant = Number(d.cantidad) || 0;
          const imp = cant * (Number(d.contrato_servicios?.precio_unitario) || 0);
          const g = map.get(nombre) || { concepto: nombre, cantidad: 0, importe: 0, veces: 0 };
          g.cantidad += cant; g.importe += imp; g.veces += 1; map.set(nombre, g);
        }
        const rows = [...map.values()].sort((a, b) => b.importe - a.importe);
        setRes({
          titulo: "Servicios de mayor impacto",
          nota: rows.length === 0 ? "No hay desglose capturado para las facturas filtradas." : "",
          columns: [
            { key: "concepto", label: "Concepto" }, { key: "veces", label: "Facturas", align: "right" },
            { key: "cantidad", label: "Cantidad total", align: "right" }, { key: "importe", label: "Importe total", money: true, align: "right" },
          ],
          rows, totales: { concepto: `TOTAL (${rows.length} conceptos)`, importe: rows.reduce((s, r) => s + r.importe, 0) },
        });
      } else if (repKey === "r3b") {
        const q = filtros.concepto.trim();
        if (!q) { setMsg("Escribe el concepto a consultar (ej. jitomate)."); setGenerando(false); return; }
        const { data: cs } = await supabase.from("contrato_servicios").select("id, nombre_servicio, precio_unitario").ilike("nombre_servicio", `%${q}%`);
        if (!cs?.length) { setRes({ titulo: `Consumo de "${q}"`, nota: "Ningún concepto coincide con ese texto.", columns: [{ key: "concepto", label: "Concepto" }], rows: [], totales: null }); setGenerando(false); return; }
        const info = Object.fromEntries(cs.map((c) => [c.id, { n: c.nombre_servicio, p: Number(c.precio_unitario) || 0 }]));
        const ids = cs.map((c) => c.id);
        let det = [];
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await supabase.from("factura_detalle").select("cantidad, factura_id, contrato_servicio_id").in("contrato_servicio_id", ids.slice(i, i + 200));
          det = det.concat(data || []);
        }
        const facById = new Map(facturas.map((f) => [f.id, f]));
        const rows = det.map((d) => {
          const f = facById.get(d.factura_id);
          if (!f || !pasaFactura(f)) return null;
          const it = info[d.contrato_servicio_id] || { n: "—", p: 0 };
          const cant = Number(d.cantidad) || 0;
          return { folio: f.folio_ingreso, folioProv: f.folio_proveedor, periodo: `${f.periodo_inicio || "—"} → ${f.periodo_fin || "—"}`, prov: f.prov, contrato: f.contrato, concepto: it.n, cantidad: cant, precio: it.p, importe: cant * it.p };
        }).filter(Boolean).sort((a, b) => (a.periodo < b.periodo ? -1 : 1));
        setRes({
          titulo: `Consumo de "${q}"`,
          nota: rows.length === 0 ? "No hay consumo capturado de ese concepto con esos filtros (recuerda que solo cuentan facturas con desglose)." : "",
          columns: [
            { key: "folio", label: "Folio ingreso" }, { key: "folioProv", label: "Folio prov." }, { key: "periodo", label: "Periodo" },
            { key: "prov", label: "Proveedor" }, { key: "contrato", label: "Contrato" }, { key: "concepto", label: "Concepto" },
            { key: "cantidad", label: "Cantidad", align: "right" }, { key: "precio", label: "Precio unit.", money: true, align: "right" }, { key: "importe", label: "Importe", money: true, align: "right" },
          ],
          rows,
          totales: { prov: `TOTAL (${rows.length} factura(s))`, cantidad: rows.reduce((s, r) => s + r.cantidad, 0), importe: rows.reduce((s, r) => s + r.importe, 0) },
        });
      } else if (repKey === "r7") {
        const rows = contratos
          .filter((c) => (!filtros.proveedor || c.prov === filtros.proveedor) && (!filtros.capitulo || c.capNom === filtros.capitulo))
          .map((c) => ({ contrato: c.numero_interno, prov: c.prov, capNom: c.capNom, admin: c.administrador_contrato || "—",
            inicio: fechaMX(c.vigencia_inicio), fin: fechaMX(c.vigencia_fin), dias: diasHasta(c.vigencia_fin), estado: estadoVigencia(c.vigencia_fin) }))
          .sort((a, b) => (a.dias ?? 1e9) - (b.dias ?? 1e9));
        const porEstado = ETAPAS; // reuse not needed
        const cuenta = (e) => rows.filter((r) => r.estado === e).length;
        setRes({
          titulo: "Vigencias de contratos (semáforo)",
          resumen: `Vigentes: ${cuenta("Vigente")} · Por vencer: ${cuenta("Por vencer")} · Vencidos: ${cuenta("Vencido")}`,
          columns: [
            { key: "contrato", label: "Contrato" }, { key: "prov", label: "Proveedor" }, { key: "capNom", label: "Capítulo" },
            { key: "admin", label: "Administrador" }, { key: "inicio", label: "Inicio" }, { key: "fin", label: "Fin" },
            { key: "dias", label: "Días restantes", align: "right" }, { key: "estado", label: "Estado" },
          ],
          rows, totales: null,
        });
      } else if (repKey === "r8") {
        // Agregar facturas por contrato
        const agg = new Map();
        for (const f of facturas) {
          const g = agg.get(f.contrato_id) || { ejercido: 0, pagado: 0, n: 0 };
          const imp = Number(f.importe_factura) || 0;
          g.ejercido += imp; g.n += 1;
          if (f.estatus_general === "gasto_reflejado") g.pagado += imp;
          agg.set(f.contrato_id, g);
        }
        const rows = contratos
          .filter((c) => (!filtros.proveedor || c.prov === filtros.proveedor) && (!filtros.capitulo || c.capNom === filtros.capitulo))
          .filter((c) => !filtros.soloVencidos || estadoVigencia(c.vigencia_fin) === "Vencido")
          .map((c) => {
            const a = agg.get(c.id) || { ejercido: 0, pagado: 0, n: 0 };
            const contratado = Number(c.monto_maximo) || 0;
            const adeudo = a.ejercido - a.pagado;
            return {
              contrato: c.numero_interno, prov: c.prov, estado: estadoVigencia(c.vigencia_fin), fin: fechaMX(c.vigencia_fin),
              contratado, facturas: a.n, ejercido: a.ejercido, pagado: a.pagado, adeudo, saldo: contratado - a.ejercido,
              cierre: (adeudo <= 0.5 && estadoVigencia(c.vigencia_fin) === "Vencido") ? "Cerrado" : adeudo > 0.5 ? "Con adeudo" : "Sin adeudo",
            };
          })
          .sort((a, b) => b.adeudo - a.adeudo);
        setRes({
          titulo: "Conciliación por contrato",
          columns: [
            { key: "contrato", label: "Contrato" }, { key: "prov", label: "Proveedor" }, { key: "estado", label: "Vigencia" }, { key: "fin", label: "Fin" },
            { key: "contratado", label: "Contratado (máx)", money: true, align: "right" }, { key: "facturas", label: "Facturas", align: "right" },
            { key: "ejercido", label: "Ejercido", money: true, align: "right" }, { key: "pagado", label: "Pagado", money: true, align: "right" },
            { key: "adeudo", label: "Adeudo (pend.)", money: true, align: "right" }, { key: "saldo", label: "Saldo contrato", money: true, align: "right" }, { key: "cierre", label: "Estado" },
          ],
          rows, totales: { contrato: `TOTAL (${rows.length})`, contratado: rows.reduce((s, r) => s + r.contratado, 0), ejercido: rows.reduce((s, r) => s + r.ejercido, 0), pagado: rows.reduce((s, r) => s + r.pagado, 0), adeudo: rows.reduce((s, r) => s + r.adeudo, 0) },
        });
      }
    } catch (e) { setMsg("Error al generar: " + e.message); }
    setGenerando(false);
  }

  async function exportExcel() {
    if (!res) return;
    const mod = await import("xlsx");
    const XLSX = mod.default || mod;
    const encabezado = res.columns.map((c) => c.label);
    const cuerpo = res.rows.map((r) => res.columns.map((c) => (c.money ? Number(r[c.key]) || 0 : r[c.key])));
    const aoa = [[res.titulo], [], encabezado, ...cuerpo];
    if (res.totales) aoa.push(res.columns.map((c) => res.totales[c.key] != null ? (c.money ? Number(res.totales[c.key]) : res.totales[c.key]) : ""));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = res.columns.map((c) => ({ wch: Math.max(12, c.label.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `${res.titulo.replace(/[^\w]+/g, "_").slice(0, 40)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  function exportPDF() { window.print(); }

  if (cargando) return <p style={{ padding: 8 }}>Cargando datos para reportes…</p>;

  const filtroInputs = {
    contrato: <div key="c"><label style={lbl}>Contrato</label><input list="rp-cont" style={inp} value={filtros.contrato} onChange={(e) => setF("contrato", e.target.value)} placeholder="Todos" /><datalist id="rp-cont">{listaContratos.map((c) => <option key={c} value={c} />)}</datalist></div>,
    proveedor: <div key="p"><label style={lbl}>Proveedor</label><input list="rp-prov" style={inp} value={filtros.proveedor} onChange={(e) => setF("proveedor", e.target.value)} placeholder="Todos" /><datalist id="rp-prov">{proveedores.map((c) => <option key={c} value={c} />)}</datalist></div>,
    capitulo: <div key="cap"><label style={lbl}>Capítulo</label><select style={inp} value={filtros.capitulo} onChange={(e) => setF("capitulo", e.target.value)}><option value="">Todos</option>{capitulos.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>,
    etapa: <div key="e"><label style={lbl}>Etapa</label><select style={inp} value={filtros.etapa} onChange={(e) => setF("etapa", e.target.value)}><option value="">Todas</option>{ETAPAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>,
    fechas: <div key="f" style={{ display: "flex", gap: 6 }}><div><label style={lbl}>Desde (periodo)</label><input type="date" style={inp} value={filtros.desde} onChange={(e) => setF("desde", e.target.value)} /></div><div><label style={lbl}>Hasta</label><input type="date" style={inp} value={filtros.hasta} onChange={(e) => setF("hasta", e.target.value)} /></div></div>,
    folio: <div key="fo"><label style={lbl}>Folio de la factura (ingreso o proveedor)</label><input style={inp} value={filtros.folio} onChange={(e) => setF("folio", e.target.value)} placeholder="Ej. HGZ2-INT-2026-000003" /></div>,
    concepto: <div key="co"><label style={lbl}>Concepto / insumo</label><input style={inp} value={filtros.concepto} onChange={(e) => setF("concepto", e.target.value)} placeholder="Ej. jitomate, gasa, oxígeno…" /></div>,
    soloVencidos: <label key="sv" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginTop: 18 }}><input type="checkbox" checked={filtros.soloVencidos} onChange={(e) => setF("soloVencidos", e.target.checked)} /> Solo contratos vencidos</label>,
  };

  return (
    <div>
      <div className="no-print" style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 className="no-print" style={{ fontSize: 22, margin: 0 }}>Reportes</h1>
      <p className="no-print" style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 4 }}>Elige un reporte, aplica filtros y descárgalo en Excel o PDF.</p>

      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* Catálogo de reportes */}
        <div className="no-print" style={{ ...card, width: 260, flexShrink: 0 }}>
          {["Facturas", "Contratos"].map((g) => (
            <div key={g} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--texto-suave)", marginBottom: 4 }}>{g}</div>
              {REPORTES.filter((r) => r.grupo === g).map((r) => (
                <button key={r.key} onClick={() => { setRepKey(r.key); setRes(null); setMsg(""); }}
                  style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 4, fontSize: 13,
                    border: `1px solid ${repKey === r.key ? "var(--verde)" : "var(--borde)"}`, background: repKey === r.key ? "var(--verde-claro)" : "var(--blanco)",
                    color: repKey === r.key ? "var(--verde-oscuro)" : "var(--texto)", borderRadius: 8, padding: "8px 10px", fontWeight: repKey === r.key ? 600 : 400 }}>
                  {r.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Panel derecho */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div className="no-print" style={{ ...card }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{rep.label}</div>
            <div style={{ fontSize: 12.5, color: "var(--texto-suave)", marginBottom: 10 }}>{rep.desc}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
              {rep.filtros.map((k) => filtroInputs[k])}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button className="boton" onClick={generar} disabled={generando}>{generando ? "Generando…" : "Generar reporte"}</button>
              {res && <button className="boton secundario" onClick={exportExcel}>⬇ Excel</button>}
              {res && <button className="boton secundario" onClick={exportPDF}>⬇ PDF</button>}
              {msg && <span style={{ fontSize: 12, color: "var(--rojo)" }}>{msg}</span>}
            </div>
          </div>

          {res && (
            <div id="reporte-print" style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{res.titulo}</div>
              <div style={{ fontSize: 12, color: "var(--texto-suave)", marginBottom: 8 }}>
                HGZ No. 02 · Generado {new Date().toLocaleString("es-MX")}{res.resumen ? " · " + res.resumen : ""}
              </div>
              {res.nota && <div style={{ background: "var(--ambar-claro)", color: "var(--ambar)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 8 }}>⚠️ {res.nota}</div>}
              <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{res.columns.map((c) => <th key={c.key} style={{ ...th, textAlign: c.align === "right" ? "right" : "left" }}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {res.rows.map((r, i) => (
                      <tr key={i}>{res.columns.map((c) => <td key={c.key} style={{ ...td, textAlign: c.align === "right" ? "right" : "left" }}>{c.money ? money(r[c.key]) : (r[c.key] ?? "—")}</td>)}</tr>
                    ))}
                    {res.rows.length === 0 && <tr><td style={td} colSpan={res.columns.length}>Sin resultados.</td></tr>}
                    {res.totales && (
                      <tr>{res.columns.map((c) => <td key={c.key} style={{ ...td, fontWeight: 700, borderTop: "2px solid #333", textAlign: c.align === "right" ? "right" : "left" }}>{res.totales[c.key] != null ? (c.money ? money(res.totales[c.key]) : res.totales[c.key]) : ""}</td>)}</tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 6 }}>{res.rows.length} renglón(es).</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: landscape; margin: 1cm; }
          body * { visibility: hidden !important; }
          #reporte-print, #reporte-print * { visibility: visible !important; }
          #reporte-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const lbl = { fontSize: 12, color: "var(--texto-suave)", display: "block", marginBottom: 2 };
