"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { cargarTraslados, clasificar, scaceContraFacturas, CUENTAN, NOMBRE_CIUDAD } from "../../../lib/traslados";
import { agruparComprobantes, cruzar } from "../../../lib/nap";
import ConciliacionProveedor, { descargarConciliacionWord } from "../../../lib/ConciliacionProveedor";
import { leerReporteCE, cruzarCE } from "../../../lib/cruceCompraEmergente";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const hoy = () => new Date();
const diasHasta = (fecha) => fecha ? Math.round((new Date(fecha).getTime() - hoy().getTime()) / 86400000) : null;
const fechaMX = (d) => d ? new Date(d).toLocaleDateString("es-MX") : "—";

const MES_NOM = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");
const fISO = (s) => (s ? fechaMX(s + "T00:00:00") : "—");
// Informes de traslados (SCACE): todos por FECHA DEL VIAJE; sin NSS ni nombres
function informeTraslados(key, t, { desde, hasta }) {
  const enRango = (f) => (!desde || f.fecha_viaje >= desde) && (!hasta || f.fecha_viaje <= hasta);
  const todos = t.clasificados.filter(enRango), viajes = todos.filter((f) => CUENTAN.has(f.estado));
  const fechas = viajes.map((f) => f.fecha_viaje).sort();
  const rango = fechas.length ? `viajes del ${fISO(fechas[0])} al ${fISO(fechas[fechas.length - 1])}` : "sin viajes en el rango";
  const tot = (lista) => ({ folios: lista.length, boletos: r2(lista.reduce((s, f) => s + (f.boletos || 0), 0)), importe: r2(lista.reduce((s, f) => s + f.valor, 0)) });
  const nota = "Fuente: SCACE \"Gastos TP por Unidad\" cargado en SIGAF, por fecha del viaje. Sin fondo fijo ni folios sin importe. Los posibles repetidos (mismo paciente, mismo día) sí cuentan. Importe = boletos × precio del contrato con IVA.";
  const suma = (rows, k) => r2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  if (key === "t1") {
    const g = {}; for (const f of todos) (g[f.fecha_viaje.slice(0, 7)] ||= []).push(f);
    const rows = Object.keys(g).sort().map((k) => {
      const l = g[k], v = l.filter((f) => CUENTAN.has(f.estado)), s = (e) => r2(l.filter((f) => f.estado === e).reduce((a, f) => a + f.valor, 0));
      const ff = l.filter((f) => f.estado === "fondo_fijo"), rep = v.filter((f) => f.repetido);
      return { mes: `${MES_NOM[Number(k.slice(5))]} ${k.slice(0, 4)}`, ...tot(v), devengo: s("devengo"), facturado: s("facturado"), pagado: s("pagado"),
        acomp: v.filter((f) => f.acompanante).length, ff: ff.length, ffImp: r2(ff.reduce((a, f) => a + (Number(f.importe_emitido) || 0), 0)), rep: rep.length, repImp: r2(rep.reduce((a, f) => a + f.valor, 0)) };
    });
    return { titulo: "Gasto de traslados por mes", resumen: rango, nota, columns: [
      { key: "mes", label: "Mes del viaje" }, { key: "folios", label: "Folios", align: "right" }, { key: "boletos", label: "Boletos", align: "right" },
      { key: "importe", label: "Importe", money: true, align: "right" }, { key: "devengo", label: "Devengo (sin factura)", money: true, align: "right" },
      { key: "facturado", label: "Facturado sin pagar", money: true, align: "right" }, { key: "pagado", label: "Pagado", money: true, align: "right" },
      { key: "acomp", label: "Con acompañante", align: "right" }, { key: "ff", label: "Fondo fijo (folios)", align: "right" }, { key: "ffImp", label: "Fondo fijo", money: true, align: "right" },
      { key: "rep", label: "De ellos, posibles repetidos", align: "right" }, { key: "repImp", label: "Repetidos ($, incluidos)", money: true, align: "right" },
    ], rows, totales: { mes: "TOTAL", ...tot(viajes), ...Object.fromEntries(["devengo", "facturado", "pagado", "acomp", "ff", "ffImp", "rep", "repImp"].map((k) => [k, suma(rows, k)])) } };
  }
  if (key === "t2" || key === "t4") {
    const llave = key === "t2" ? (f) => `${NOMBRE_CIUDAD[f.ciudad]}|${f.unidad_receptora}` : (f) => f.especialidad || "(sin especialidad)";
    const g = {}; for (const f of viajes) (g[llave(f)] ||= []).push(f);
    const T = tot(viajes);
    const rows = Object.entries(g).map(([k, l]) => {
      const x = tot(l), ciudades = {}; for (const f of l) ciudades[NOMBRE_CIUDAD[f.ciudad]] = (ciudades[NOMBRE_CIUDAD[f.ciudad]] || 0) + 1;
      const base = key === "t2" ? { ciudad: k.split("|")[0], hospital: k.split("|")[1] } : { especialidad: k, destinos: Object.entries(ciudades).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ") };
      return { ...base, ...x, peso: pct(x.importe, T.importe), acomp: l.filter((f) => f.acompanante).length };
    }).sort((a, b) => (key === "t2" ? a.ciudad.localeCompare(b.ciudad) || b.importe - a.importe : b.importe - a.importe));
    const cols = key === "t2" ? [{ key: "ciudad", label: "Ciudad" }, { key: "hospital", label: "Hospital destino" }] : [{ key: "especialidad", label: "Especialidad" }, { key: "destinos", label: "Destinos (folios)" }];
    return { titulo: key === "t2" ? "Traslados por destino" : "Traslados por especialidad", resumen: rango, nota, columns: [...cols,
      { key: "folios", label: "Folios", align: "right" }, { key: "boletos", label: "Boletos", align: "right" }, { key: "importe", label: "Importe", money: true, align: "right" },
      { key: "peso", label: "% del importe", align: "right" }, { key: "acomp", label: "Con acompañante", align: "right" }],
      rows, totales: { [cols[0].key]: "TOTAL", ...T, peso: "100%", acomp: viajes.filter((f) => f.acompanante).length } };
  }
  if (key === "t3") {
    const g = {}; for (const f of viajes) (g[`${f.fecha_viaje.slice(0, 7)}|${f.ciudad}`] ||= []).push(f);
    const rows = Object.entries(g).sort(([a], [b]) => a.localeCompare(b)).map(([k, l]) => {
      const con = l.filter((f) => f.acompanante);
      return { mes: `${MES_NOM[Number(k.slice(5, 7))]} ${k.slice(0, 4)}`, ciudad: NOMBRE_CIUDAD[k.split("|")[1]], viajes: l.length, con: con.length, pct: pct(con.length, l.length),
        boletosA: r2(con.reduce((s, f) => s + f.boletosAcomp, 0)), importeA: r2(con.reduce((s, f) => s + (f.boletos ? (f.valor * f.boletosAcomp) / f.boletos : 0), 0)), sinNombre: con.filter((f) => !f.con_acompanante).length };
    });
    const viajesT = rows.reduce((s, r) => s + r.viajes, 0), conT = rows.reduce((s, r) => s + r.con, 0);
    return { titulo: "Acompañantes", resumen: rango, nota: "Con acompañante = la columna \"Acompañante\" del SCACE trae dato o el folio lleva más de un boleto (1.5 o 2). \"Sin nombre capturado\" = se cobró boleto de acompañante pero el SCACE no trae su nombre.", columns: [
      { key: "mes", label: "Mes del viaje" }, { key: "ciudad", label: "Ciudad" }, { key: "viajes", label: "Viajes", align: "right" }, { key: "con", label: "Con acompañante", align: "right" },
      { key: "pct", label: "%", align: "right" }, { key: "boletosA", label: "Boletos de acompañante", align: "right" }, { key: "importeA", label: "Costo acompañantes", money: true, align: "right" },
      { key: "sinNombre", label: "Sin nombre capturado", align: "right" },
    ], rows, totales: { mes: "TOTAL", viajes: viajesT, con: conT, pct: pct(conT, viajesT), boletosA: suma(rows, "boletosA"), importeA: suma(rows, "importeA"), sinNombre: suma(rows, "sinNombre") } };
  }
  if (key === "t5") {
    const rows = scaceContraFacturas(t, t.clasificados, { desde, hasta }).map((x) => ({ factura: x.factura.folio_proveedor, periodo: `${fISO(x.factura.periodo_inicio)} al ${fISO(x.factura.periodo_fin)}`, contrato: x.contrato,
      ciudad: NOMBRE_CIUDAD[x.ciudad], emitidos: x.emitidos, facturados: x.facturados, diferencia: x.diferencia, importeDif: x.importeDif, repetidos: x.repetidos || "", lectura: x.lectura }));
    return { titulo: "SCACE contra factura", resumen: `${new Set(rows.map((r) => r.factura)).size} facturas con detalle de viajes`, nota: "Solo facturas con detalle de viajes y periodo capturados. Boletos SCACE = folios (sin fondo fijo; los posibles repetidos incluidos y señalados aparte) con fecha de viaje dentro del periodo de la factura. Las facturas sin detalle (p. ej. viajes de otra unidad pagados por el HGZ 2) no entran. Si no se ha cargado el SCACE de ese periodo, todo sale como \"cobrado de más\".", columns: [
      { key: "factura", label: "Factura" }, { key: "periodo", label: "Periodo" }, { key: "contrato", label: "Contrato" }, { key: "ciudad", label: "Ciudad" },
      { key: "emitidos", label: "Boletos SCACE", align: "right" }, { key: "facturados", label: "Boletos facturados", align: "right" }, { key: "diferencia", label: "Diferencia", align: "right" },
      { key: "importeDif", label: "Importe de la diferencia", money: true, align: "right" }, { key: "repetidos", label: "De ellos, posibles repetidos", align: "right" }, { key: "lectura", label: "Lectura" },
    ], rows, totales: { factura: "TOTAL", emitidos: suma(rows, "emitidos"), facturados: suma(rows, "facturados"), diferencia: suma(rows, "diferencia"), importeDif: suma(rows, "importeDif") } };
  }
  return null;
}

const inp = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14, width: "100%", boxSizing: "border-box" };
const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px" };
const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap" };
const td = { padding: "7px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13, verticalAlign: "top" };

// Tabla de un reporte con varias secciones (R12). Renglones con _rojo = no han llegado a SIGAF.
function TablaRep({ s }) {
  const celda = (c, v) => (c.money ? (v === "" || v == null ? "—" : money(v)) : (v === "" || v == null ? "—" : v));
  return (
    <>
      <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{s.columns.map((c) => <th key={c.key} style={{ ...th, textAlign: c.align === "right" ? "right" : "left" }}>{c.label}</th>)}</tr></thead>
          <tbody>
            {s.rows.map((r, i) => (
              <tr key={i} style={r._rojo ? { background: "#fde8e8" } : undefined}>
                {s.columns.map((c, j) => <td key={c.key} style={{ ...td, minWidth: j === 0 && (c.key === "cuenta" || c.key === "tipo") ? 240 : undefined, whiteSpace: c.money || c.key === "estatus" || c.key === "etapa" ? "nowrap" : undefined, textAlign: c.align === "right" ? "right" : "left", color: r._rojo && c.key === "enSigaf" ? "var(--rojo)" : undefined, fontWeight: r._rojo && c.key === "enSigaf" ? 700 : undefined }}>{celda(c, r[c.key])}</td>)}
              </tr>
            ))}
            {s.rows.length === 0 && <tr><td style={td} colSpan={s.columns.length}>Nada que señalar.</td></tr>}
            {s.totales && (
              <tr>{s.columns.map((c) => <td key={c.key} style={{ ...td, fontWeight: 700, borderTop: "2px solid #333", textAlign: c.align === "right" ? "right" : "left" }}>{s.totales[c.key] != null ? (c.money ? money(s.totales[c.key]) : s.totales[c.key]) : ""}</td>)}</tr>
            )}
          </tbody>
        </table>
      </div>
      {s.nota && <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 6 }}>{s.nota}</div>}
    </>
  );
}

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
// Situación descriptiva (dónde va realmente la factura), para la conciliación.
function situacionDe(f) {
  if (f.estatus_general === "gasto_reflejado") return "Pagada";
  if (f.estatus_general === "devuelta_proveedor") return "Devuelta al proveedor";
  if (f.estatus_general === "enviada_ooad" || f.estatus_general === "en_tramite_ooad") return "En trámite de pago (OOAD)";
  if (f.estatus_firmas === "autorizada_admin_contrato") return "Autorizada por el administrador del contrato";
  if (f.estatus_firmas === "envio_firmas_admin_contrato") return "En firma del administrador del contrato";
  if (f.estatus_firmas === "autorizada_servicio") return "Validada por el servicio";
  if (f.estatus_firmas === "envio_firmas_servicio") return "En validación del servicio";
  return "En revisión en Finanzas";
}
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
  const [filtros, setFiltros] = useState({ contrato: "", proveedor: "", capitulo: "", etapa: "", desde: "", hasta: "", folio: "", concepto: "", soloVencidos: false, detalleCE: false });
  const [res, setRes] = useState(null); // { columns, rows, totales, titulo }
  const [generando, setGenerando] = useState(false);
  const [msg, setMsg] = useState("");
  const [servLista, setServLista] = useState([]);      // conceptos del contrato elegido (para R3b)
  const [servSel, setServSel] = useState(() => new Set());
  const [buscaConcepto, setBuscaConcepto] = useState("");
  const [folioOpen, setFolioOpen] = useState(false); // dropdown de sugerencias de folio (R2)
  const [trasCache, setTrasCache] = useState(null); // folios del SCACE ya clasificados (informes de traslados)
  const [docInst, setDocInst] = useState(null);     // documento institucional de conciliación (membrete)
  const [ceArchivo, setCeArchivo] = useState(null); // reporte de solicitudes de compra emergente (R12)

  useEffect(() => {
    (async () => {
      let todas = [], desde = 0;
      for (;;) {
        const { data, error } = await supabase.from("facturas").select(
          "id, folio_ingreso, folio_proveedor, importe_factura, estatus_general, estatus_firmas, estatus_pedido_recepcion, validacion_ok, periodo_inicio, periodo_fin, mes_asignado, anio_asignado, created_at, fecha_pago, contrato_id, proveedor_id, orden_compra, cr_contrarecibo, contratos ( numero_interno ), proveedores ( razon_social ), capitulos ( nombre )"
        ).eq("anulada", false).range(desde, desde + 999);
        if (error) { setMsg("No se pudieron cargar facturas: " + error.message); break; }
        todas = todas.concat(data || []);
        if (!data || data.length < 1000) break;
        desde += 1000;
      }
      const rC = await supabase.from("contratos").select("id, numero_interno, numero_alterno, administrador_contrato, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo, proveedor_id, proveedores ( razon_social ), partidas ( cuenta_finat, capitulos ( nombre ) )").order("numero_interno");
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

  // Al elegir contrato en R3b, cargar sus conceptos para poder seleccionarlos.
  useEffect(() => {
    if (repKey !== "r3b" || !filtros.contrato) { setServLista([]); setServSel(new Set()); return; }
    const c = contratos.find((x) => x.numero_interno === filtros.contrato);
    if (!c) { setServLista([]); setServSel(new Set()); return; }
    let vivo = true;
    (async () => {
      const { data } = await supabase.from("contrato_servicios").select("id, nombre_servicio, precio_unitario").eq("contrato_id", c.id).order("orden", { ascending: true, nullsFirst: false }).order("nombre_servicio");
      if (!vivo) return;
      setServLista(data || []); setServSel(new Set());
    })();
    return () => { vivo = false; };
  }, [repKey, filtros.contrato, contratos]);

  const proveedores = useMemo(() => [...new Set([...facturas.map((f) => f.prov), ...contratos.map((c) => c.prov)])].filter((x) => x && x !== "—").sort(), [facturas, contratos]);
  const capitulos = useMemo(() => [...new Set([...facturas.map((f) => f.capNom), ...contratos.map((c) => c.capNom)])].filter((x) => x && x !== "—").sort(), [facturas, contratos]);
  const listaContratos = useMemo(() => [...new Set(contratos.map((c) => c.numero_interno))].sort(), [contratos]);

  const REPORTES = [
    { key: "r1", grupo: "Facturas", label: "Facturas por contrato + estatus", desc: "Listado de facturas con su etapa/estatus actual, importe y validación.", filtros: ["contrato", "proveedor", "capitulo", "etapa", "fechas"] },
    { key: "r2", grupo: "Facturas", label: "Detalle de servicios de una factura", desc: "Conceptos, cantidad, precio unitario e importe de una factura (requiere desglose capturado).", filtros: ["folio"] },
    { key: "r3", grupo: "Facturas", label: "Servicios de mayor impacto", desc: "Ranking de conceptos por importe y cantidad (facturas con desglose).", filtros: ["contrato", "capitulo", "fechas"] },
    { key: "r3b", grupo: "Facturas", label: "Consumo por conceptos (elige del contrato)", desc: "Elige contrato → marca los conceptos que quieras → te dice en qué facturas salen y cuánto. Sin contrato, puedes buscar por texto. Requiere desglose capturado.", filtros: ["proveedor", "contrato", "fechas"] },
    { key: "r9", grupo: "Facturas", label: "Compra Emergente sin CR", desc: "Facturas de Compra Emergente que aún NO tienen contra-recibo (CR), agrupadas por cuenta: cuántas son y cuánto importe. Son las que todavía no reflejan gasto.", filtros: ["proveedor", "capitulo", "fechas", "detalleCE"] },
    { key: "r12", grupo: "Facturas", label: "Cruce vs compras emergentes", desc: "Sube el reporte de Solicitudes de compra emergente que pasa el administrador (SAI): SIGAF lo cruza con sus facturas de Compra Emergente y la última dispo cargada. Te dice qué ya llegó a SIGAF, en qué etapa va, qué falta, y por cuenta cuánto falta generar de OC.", filtros: ["archivoCE"] },
    { key: "r10", grupo: "Facturas", label: "Pagadas en FINAT sin factura en SIGAF", desc: "Comprobantes del 1043 que FINAT marca PAGADOS (del HGZ 2, en cuentas que se llevan factura por factura) y que SIGAF no tiene capturados. Sale de lo ya cargado en \"Cargar reportes\".", filtros: ["fechas"] },
    { key: "r7", grupo: "Contratos", label: "Vigencias (semáforo)", desc: "Contratos vigentes / por vencer (≤30 días) / vencidos.", filtros: ["proveedor", "capitulo"] },
    { key: "r8", grupo: "Contratos", label: "Conciliación por contrato", desc: "Contratado vs ejercido vs saldo; pagado vs adeudo (pendiente). Ideal para conciliar con proveedor.", filtros: ["proveedor", "capitulo", "soloVencidos"] },
    { key: "r11", grupo: "Contratos", label: "Acto conciliatorio con proveedor", desc: "Elige el contrato → te arroja el acta de conciliación lista: importe total, pagado y adeudo, la facturación pagada (y la pendiente si la hay), y el documento institucional con membrete, asistentes y firmas, imprimible a PDF y descargable en Word.", filtros: ["proveedor", "contrato"] },
    { key: "t1", grupo: "Traslados", label: "Gasto de traslados por mes", desc: "Viajes del SCACE por mes del viaje: folios, boletos, importe, cuánto es devengo, facturado y pagado, acompañantes, fondo fijo y posibles repetidos.", filtros: ["fechas"] },
    { key: "t2", grupo: "Traslados", label: "Traslados por destino", desc: "A qué ciudad y hospital van los pacientes: folios, boletos, importe y su peso en el total.", filtros: ["fechas"] },
    { key: "t3", grupo: "Traslados", label: "Acompañantes", desc: "Viajes con acompañante por mes y ciudad, y cuánto cuestan los boletos de acompañante.", filtros: ["fechas"] },
    { key: "t4", grupo: "Traslados", label: "Traslados por especialidad", desc: "Qué servicios mandan más pacientes y a dónde.", filtros: ["fechas"] },
    { key: "t5", grupo: "Traslados", label: "SCACE contra factura", desc: "Por factura de Autobuses y destino: boletos emitidos en el SCACE contra los facturados. Más emitidos = posible \"no viajó\"; más facturados = pedir aclaración.", filtros: ["fechas"] },
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
      if (repKey.startsWith("t")) {
        let t = trasCache;
        if (!t) { const d = await cargarTraslados(); t = { ...d, clasificados: clasificar(d) }; setTrasCache(t); }
        if (!t.folios.length) setMsg("Todavía no hay folios del SCACE en SIGAF: súbelos en Cargar reportes.");
        setRes(informeTraslados(repKey, t, filtros));
      } else if (repKey === "r1") {
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
        let info, ids, subtitulo;
        if (filtros.contrato && servLista.length) {
          // Modo guiado: conceptos seleccionados del contrato
          const sel = servLista.filter((s) => servSel.has(s.id));
          if (!sel.length) { setMsg("Marca al menos un concepto del contrato."); setGenerando(false); return; }
          info = Object.fromEntries(sel.map((c) => [c.id, { n: c.nombre_servicio, p: Number(c.precio_unitario) || 0 }]));
          ids = sel.map((c) => c.id);
          subtitulo = `Contrato ${filtros.contrato} · ${sel.length} concepto(s)`;
        } else {
          // Modo texto (alternativa)
          const q = filtros.concepto.trim();
          if (!q) { setMsg("Elige un contrato y marca conceptos, o escribe un concepto en el buscador de abajo."); setGenerando(false); return; }
          const { data: cs } = await supabase.from("contrato_servicios").select("id, nombre_servicio, precio_unitario").ilike("nombre_servicio", `%${q}%`);
          if (!cs?.length) { setRes({ titulo: `Consumo de "${q}"`, nota: "Ningún concepto coincide con ese texto.", columns: [{ key: "concepto", label: "Concepto" }], rows: [], totales: null }); setGenerando(false); return; }
          info = Object.fromEntries(cs.map((c) => [c.id, { n: c.nombre_servicio, p: Number(c.precio_unitario) || 0 }]));
          ids = cs.map((c) => c.id);
          subtitulo = `Búsqueda: "${q}"`;
        }
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
          titulo: `Consumo por concepto — ${subtitulo}`,
          nota: rows.length === 0 ? "No hay consumo capturado de esos conceptos con estos filtros (recuerda que solo cuentan facturas con desglose)." : "",
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
      } else if (repKey === "r9") {
        // Compra Emergente (marco CE-) SIN contra-recibo (CR).
        const sinCR = (f) => !String(f.cr_contrarecibo ?? "").trim();
        const base = facturas.filter((f) =>
          (f.contrato || "").startsWith("CE-") && sinCR(f)
          && (!filtros.proveedor || f.prov === filtros.proveedor)
          && (!filtros.capitulo || f.capNom === filtros.capitulo)
          && (!filtros.desde || (f.periodo_inicio || f.created_at?.slice(0, 10) || "") >= filtros.desde)
          && (!filtros.hasta || (f.periodo_inicio || f.created_at?.slice(0, 10) || "") <= filtros.hasta)
        );
        if (filtros.detalleCE) {
          const rows = base
            .map((f) => ({ cuenta: (f.contrato || "").replace("CE-", ""), oc: f.orden_compra || "—", folio: f.folio_ingreso || "—", folioProv: f.folio_proveedor || "—",
              prov: f.prov, etapa: f.etapa, fecha: fechaMX(f.periodo_inicio || f.created_at), importe: Number(f.importe_factura) || 0 }))
            .sort((a, b) => (a.cuenta === b.cuenta ? b.importe - a.importe : a.cuenta.localeCompare(b.cuenta)));
          setRes({
            titulo: "Compra Emergente sin CR — detalle por factura",
            resumen: `${rows.length} factura(s) sin contra-recibo`,
            nota: rows.length === 0 ? "No hay facturas de Compra Emergente sin CR con estos filtros." : "Sin CR = aún no tiene contra-recibo capturado (todavía no refleja gasto).",
            columns: [
              { key: "cuenta", label: "Cuenta" }, { key: "oc", label: "OC" }, { key: "folio", label: "Folio ingreso" }, { key: "folioProv", label: "Folio prov." },
              { key: "prov", label: "Proveedor" }, { key: "etapa", label: "Etapa" }, { key: "fecha", label: "Fecha" }, { key: "importe", label: "Importe", money: true, align: "right" },
            ],
            rows, totales: { prov: `TOTAL (${rows.length})`, importe: rows.reduce((s, r) => s + r.importe, 0) },
          });
        } else {
          const g = new Map();
          for (const f of base) {
            const cuenta = (f.contrato || "").replace("CE-", "");
            const x = g.get(cuenta) || { cuenta, capNom: f.capNom, facturas: 0, importe: 0 };
            x.facturas += 1; x.importe += Number(f.importe_factura) || 0; g.set(cuenta, x);
          }
          const rows = [...g.values()].sort((a, b) => b.importe - a.importe);
          setRes({
            titulo: "Compra Emergente sin CR — por cuenta",
            resumen: `${base.length} factura(s) en ${rows.length} cuenta(s)`,
            nota: rows.length === 0 ? "No hay facturas de Compra Emergente sin CR con estos filtros." : "Sin CR = aún no tiene contra-recibo capturado (todavía no refleja gasto). Marca “Ver detalle por factura” para el desglose.",
            columns: [
              { key: "cuenta", label: "Cuenta" }, { key: "capNom", label: "Capítulo" },
              { key: "facturas", label: "Facturas sin CR", align: "right" }, { key: "importe", label: "Importe", money: true, align: "right" },
            ],
            rows, totales: { cuenta: `TOTAL (${rows.length} cuentas)`, facturas: rows.reduce((s, r) => s + r.facturas, 0), importe: rows.reduce((s, r) => s + r.importe, 0) },
          });
        }
      } else if (repKey === "r12") {
        if (!ceArchivo) { setMsg("Primero elige el archivo de Solicitudes de compra emergente."); setGenerando(false); return; }
        const mod = await import("xlsx"); const XLSX = mod.default || mod;
        const reporte = leerReporteCE(XLSX, new Uint8Array(await ceArchivo.arrayBuffer()));
        if (reporte.error) { setMsg(reporte.error); setGenerando(false); return; }
        // Facturas de Compra Emergente (sin anuladas), con su cuenta
        let fce = [];
        for (let d = 0; ; d += 1000) {
          const { data, error } = await supabase.from("facturas")
            .select("id, folio_ingreso, folio_proveedor, orden_compra, importe_factura, estatus_general, estatus_firmas, cr_contrarecibo, created_at, proveedores ( razon_social ), partidas ( cuenta_finat, nombre ), capitulos!inner ( nombre )")
            .eq("capitulos.nombre", "Compra Emergente").eq("anulada", false).order("id").range(d, d + 999);
          if (error) throw new Error("facturas de Compra Emergente: " + error.message);
          fce = fce.concat(data || []);
          if (!data || data.length < 1000) break;
        }
        const facturasCE = fce.map((f) => ({ id: f.id, folio_ingreso: f.folio_ingreso, folio_proveedor: f.folio_proveedor, orden_compra: f.orden_compra, importe: f.importe_factura,
          estatus_general: f.estatus_general, estatus_firmas: f.estatus_firmas, cr: f.cr_contrarecibo, cuenta: f.partidas?.cuenta_finat || "", proveedor: f.proveedores?.razon_social || "", created_at: f.created_at }));
        // Nombres de las cuentas del capítulo Compra Emergente
        const { data: pts, error: eP } = await supabase.from("partidas").select("cuenta_finat, nombre, capitulos!inner ( nombre )").eq("capitulos.nombre", "Compra Emergente");
        if (eP) throw new Error("partidas: " + eP.message);
        const nombres = Object.fromEntries((pts || []).filter((p) => p.cuenta_finat).map((p) => [p.cuenta_finat, p.nombre]));
        // Última dispo cargada (HGZ 2, por cuenta)
        const { data: ult, error: eU } = await supabase.from("disponibilidad_diaria").select("fecha").order("fecha", { ascending: false }).limit(1);
        if (eU) throw new Error("dispo: " + eU.message);
        const fechaDispo = ult?.[0]?.fecha || "";
        const dispo = { fecha: fechaDispo, cuentas: {} };
        if (fechaDispo) {
          const { data: dd, error: eD } = await supabase.from("disponibilidad_diaria").select("cuenta_finat, presupuesto, gasto, disponible").eq("fecha", fechaDispo);
          if (eD) throw new Error("dispo: " + eD.message);
          for (const x of dd || []) dispo.cuentas[x.cuenta_finat] = { presupuesto: Number(x.presupuesto) || 0, gasto: Number(x.gasto) || 0, disponible: Number(x.disponible) || 0 };
        }
        const x = cruzarCE({ reporte, facturas: facturasCE, dispo, nombres });
        const sumaK = (l, k) => Math.round(l.reduce((s, r) => s + (Number(r[k]) || 0), 0) * 100) / 100;
        const M = (key, label) => ({ key, label, money: true, align: "right" });
        const avisos = [];
        if (x.meta.otraUnidad) avisos.push(`${x.meta.otraUnidad} renglón(es) de otra unidad no se tomaron`);
        if (x.meta.sinFolio) avisos.push(`${x.meta.sinFolio} renglón(es) sin número de folio no se tomaron`);
        if (!fechaDispo) avisos.push("no hay dispo cargada: el presupuesto sale en ceros");
        setRes({
          titulo: "Cruce vs compras emergentes",
          resumen: `Reporte del administrador del ${fISO(x.meta.fechaReporte)} ${x.meta.horaReporte || ""} · dispo del ${fISO(fechaDispo)} · ${x.meta.facturasCE} facturas de Compra Emergente en SIGAF`,
          nota: avisos.length ? avisos.join(" · ") + "." : "",
          tarjetas: x.tarjetas,
          secciones: [
            { id: "ppto", titulo: "Presupuesto asignado vs OC: en qué cuentas falta generar OC",
              nota: "OC en camino = lo del reporte que no tiene CR (no ha llegado a SIGAF, en firmas, en OOAD o devuelta) + lo que está en SIGAF sin CR y no viene en el reporte. Las devueltas ya refacturadas no cuentan. Por generar OC = Disponible − OC en camino.",
              columns: [{ key: "cuenta", label: "Cuenta" }, M("presupuesto", "Presupuesto 2026"), M("gasto", "Gastado"), M("disponible", "Disponible hoy"), M("caminoReporte", "En camino (del reporte)"), M("caminoFuera", "En SIGAF sin CR fuera del reporte"), M("camino", "OC en camino"), M("porGenerar", "Por generar OC"), { key: "estatus", label: "Estatus" }],
              rows: x.ppto, totales: { cuenta: "TOTAL", ...Object.fromEntries(["presupuesto", "gasto", "disponible", "caminoReporte", "caminoFuera", "camino", "porGenerar"].map((k) => [k, sumaK(x.ppto, k)])) } },
            { id: "cuenta", titulo: "Por cuenta: cuánto del reporte ya está en SIGAF y cuánto falta",
              columns: [{ key: "cuenta", label: "Cuenta" }, M("falta", "Falta en SIGAF"), M("ya", "Ya en SIGAF"), M("total", "Total")],
              rows: x.porCuenta, totales: { cuenta: "TOTAL", falta: sumaK(x.porCuenta, "falta"), ya: sumaK(x.porCuenta, "ya"), total: sumaK(x.porCuenta, "total") } },
            { id: "etapa", titulo: "En qué etapa van las compras del reporte",
              columns: [{ key: "etapa", label: "Etapa en SIGAF" }, { key: "folios", label: "Folios", align: "right" }, M("monto", "Monto"), { key: "pct", label: "% del monto", align: "right" }],
              rows: x.porEtapa, totales: { etapa: "TOTAL", folios: sumaK(x.porEtapa, "folios"), monto: sumaK(x.porEtapa, "monto"), pct: "100%" } },
            { id: "nollegan", titulo: "Compras que NO han llegado a SIGAF, por proveedor",
              columns: [{ key: "proveedor", label: "Proveedor" }, { key: "cuentas", label: "Cuenta(s)" }, { key: "folios", label: "Folios", align: "right" }, M("monto", "Monto")],
              rows: x.noLleganProv, totales: { proveedor: "TOTAL", folios: sumaK(x.noLleganProv, "folios"), monto: sumaK(x.noLleganProv, "monto") } },
            { id: "revisar", titulo: "Para revisar", hoja: "Para revisar",
              nota: "SIGAF solo lo señala, no corrige nada. Importe distinto: diferencia = SIGAF − reporte.",
              columns: [{ key: "tipo", label: "Qué pasa" }, { key: "folio", label: "Folio reporte" }, { key: "sigaf", label: "Folio SIGAF" }, { key: "detalle", label: "Detalle" }, M("importe", "Importe")],
              rows: x.revisar },
            { id: "cruce", titulo: "Cruce completo", plegada: true, hoja: "Cruce completo",
              nota: "Los que no han llegado a SIGAF van en rojo. En el Excel trae filtro en cada columna.",
              columns: [{ key: "folio", label: "Folio solicitud" }, { key: "alta", label: "No. alta" }, { key: "oc", label: "OC portal" }, { key: "fechaFolio", label: "Fecha folio" }, { key: "mes", label: "Mes" },
                { key: "partida", label: "Partida" }, { key: "concepto", label: "Cuenta y concepto" }, { key: "proveedor", label: "Proveedor" }, { key: "articulo", label: "Artículo" }, { key: "factura", label: "Factura" },
                M("total", "Total reporte"), { key: "enSigaf", label: "En SIGAF" }, { key: "folioSigaf", label: "Folio SIGAF" }, { key: "etapa", label: "Etapa SIGAF" }, { key: "cr", label: "CR" }, M("importeSigaf", "Importe SIGAF")],
              rows: x.cruce, totales: { folio: `TOTAL (${x.cruce.length})`, total: sumaK(x.cruce, "total") } },
          ],
        });
      } else if (repKey === "r10") {
        // Comprobantes del 1043 (lo que FINAT marca PAGADO) que SIGAF no tiene como factura.
        let comps = [], d0 = 0;
        for (;;) {
          const { data, error } = await supabase.from("comprobantes_ooad")
            .select("cbte, tipo, no_proveedor, proveedor, factura_txt, importe, estado_entrada, estado_pago, fecha_emision, fecha_prog_pago, pedido, recepcion, ui, cuenta, importe_cuenta")
            .range(d0, d0 + 999);
          if (error) throw error;
          comps = comps.concat(data || []);
          if (!data || data.length < 1000) break;
          d0 += 1000;
        }
        if (!comps.length) { setMsg("No hay comprobantes del 1043 cargados. Súbelos en \"Cargar reportes\"."); setGenerando(false); return; }
        const { data: bloques } = await supabase.from("cedula_bloques").select("cuenta_finat, modo");
        const porFactura = new Set((bloques || []).filter((x) => x.modo === "facturas").map((x) => x.cuenta_finat));
        const cr = cruzar(agruparComprobantes(comps), facturas);
        const faltan = cr.faltanEnSigaf.map((x) => x.c).filter((c) => c.pagado
          && !String(c.lineas[0]?.tipo || "").startsWith("JRNL")
          && (!porFactura.size || c.cuentasHGZ2.some((cta) => porFactura.has(cta))));
        const rows = faltan
          .filter((c) => (!filtros.desde || (c.fecha_prog_pago || "") >= filtros.desde) && (!filtros.hasta || (c.fecha_prog_pago || "") <= filtros.hasta))
          .map((c) => ({ cbte: c.cbte, proveedor: c.proveedor, factura_txt: c.factura_txt || "—",
            cuenta: c.cuentasHGZ2.join(", ") || "—", fecha_pago: fISO(c.fecha_prog_pago),
            importe: Number(c.impHGZ2 || c.importe) || 0 }))
          .sort((a, b) => b.importe - a.importe);
        setRes({
          titulo: "Pagadas en FINAT sin factura en SIGAF",
          resumen: `${rows.length} comprobante(s) pagado(s) que SIGAF no tiene`,
          nota: rows.length === 0
            ? "No hay comprobantes pagados sin factura (con lo cargado del 1043). Si falta, sube el 1043 más reciente en \"Cargar reportes\"."
            : "Son del último 1043 cargado, del HGZ 2 y de cuentas que se llevan factura por factura. Las que SÍ están en SIGAF pero con folio/importe distinto aparecen en \"Cargar reportes → Por confirmar\", no aquí.",
          columns: [
            { key: "cbte", label: "Comprobante (CR)" }, { key: "proveedor", label: "Proveedor (FINAT)" },
            { key: "factura_txt", label: "Factura" }, { key: "cuenta", label: "Cuenta HGZ 2" },
            { key: "fecha_pago", label: "Fecha prog. pago" }, { key: "importe", label: "Importe HGZ 2", money: true, align: "right" },
          ],
          rows, totales: { proveedor: `TOTAL (${rows.length})`, importe: rows.reduce((s, r) => s + r.importe, 0) },
        });
      } else if (repKey === "r11") {
        // Acto conciliatorio: un contrato, o TODOS los del proveedor (una sola acta).
        let ctos = [];
        if (filtros.contrato) {
          const c = contratos.find((x) => x.numero_interno === filtros.contrato) || contratos.find((x) => x.numero_alterno === filtros.contrato);
          if (c) ctos = [c];
        } else if (filtros.proveedor) {
          ctos = contratos.filter((x) => x.prov === filtros.proveedor);
        }
        if (!ctos.length) { setMsg(filtros.proveedor || filtros.contrato ? "No encontré contratos con esos filtros." : "Elige un proveedor o un contrato a conciliar."); setGenerando(false); return; }
        const idset = new Set(ctos.map((c) => c.id));
        const suyas = facturas.filter((f) => idset.has(f.contrato_id));
        if (!suyas.length) { setMsg("Esos contratos no tienen facturas capturadas."); setGenerando(false); return; }
        const numDe = (c) => c.numero_alterno || c.numero_interno;
        const ctoDe = (f) => ctos.find((x) => x.id === f.contrato_id);
        const porFecha = (a, b) => String(a.periodo_inicio || a.created_at || "").localeCompare(String(b.periodo_inicio || b.created_at || ""));
        const sum = (arr) => arr.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0);
        const aFila = (f) => { const c = ctoDe(f); return { contrato: c ? numDe(c) : "—", folio: f.folio_proveedor || f.folio_ingreso || "—", fecha: f.periodo_inicio || f.created_at, importe: Number(f.importe_factura) || 0, cr: f.cr_contrarecibo || "", situacion: situacionDe(f) }; };
        const pagadasF = suyas.filter((f) => f.estatus_general === "gasto_reflejado").sort(porFecha);
        const pendientesF = suyas.filter((f) => f.estatus_general !== "gasto_reflejado").sort(porFecha);
        const total = sum(suyas), pagado = sum(pagadasF), adeudo = Math.round((total - pagado) * 100) / 100;
        const contratosDatos = ctos.map((c) => { const fs = suyas.filter((f) => f.contrato_id === c.id); const t = sum(fs); const p = sum(fs.filter((f) => f.estatus_general === "gasto_reflejado")); return { num: numDe(c), sai: c.numero_interno || "", administrador: c.administrador_contrato || "", total: t, pagado: p, adeudo: Math.round((t - p) * 100) / 100 }; });
        const rows = suyas.slice().sort(porFecha).map((f) => { const c = ctoDe(f); return { contrato: c ? numDe(c) : "—", folio: f.folio_proveedor || "—", fecha: f.periodo_inicio ? fISO(f.periodo_inicio) : "—", importe: Number(f.importe_factura) || 0, cr: f.cr_contrarecibo || "—", fpago: f.fecha_pago ? fISO(f.fecha_pago) : "—", situacion: situacionDe(f) }; });
        const prov = ctos[0].prov;
        setRes({
          titulo: ctos.length === 1 ? `Acto conciliatorio · Contrato ${contratosDatos[0].num}` : `Acto conciliatorio · ${prov} (${ctos.length} contratos)`,
          resumen: `${prov} · Total ${money(total)} · Pagado ${money(pagado)} · Adeudo ${money(adeudo)}`,
          nota: "Revisa los datos y genera el documento institucional (con membrete y firmas). El representante legal y las horas se capturan al generar el acta.",
          columns: [
            { key: "contrato", label: "Contrato" }, { key: "folio", label: "Folio factura" }, { key: "fecha", label: "Fecha" }, { key: "importe", label: "Importe", money: true, align: "right" },
            { key: "cr", label: "Contra recibo" }, { key: "fpago", label: "Fecha pago" }, { key: "situacion", label: "Situación" },
          ],
          rows, totales: { contrato: `TOTAL (${rows.length})`, importe: total },
          acta: { proveedor: prov, contratos: contratosDatos, total, pagado, adeudo, pagadas: pagadasF.map(aFila), pendientes: pendientesF.map(aFila) },
        });
      }
    } catch (e) { setMsg("Error al generar: " + e.message); }
    setGenerando(false);
  }

  async function exportExcel() {
    if (!res) return;
    const mod = await import("xlsx");
    const XLSX = mod.default || mod;
    if (res.secciones) {
      // Reporte con varias tablas (R12): "Dinamicas" con todas las tablas apiladas + una pestaña por cada tabla grande
      const valor = (c, v) => (c.money ? (v === "" || v == null ? "" : Number(v) || 0) : v ?? "");
      const bloque = (s) => {
        const aoa = [[s.titulo], s.columns.map((c) => c.label), ...s.rows.map((r) => s.columns.map((c) => valor(c, r[c.key])))];
        if (s.totales) aoa.push(s.columns.map((c) => (s.totales[c.key] != null ? valor(c, s.totales[c.key]) : "")));
        if (s.nota) aoa.push([s.nota]);
        return aoa;
      };
      const wb = XLSX.utils.book_new();
      const din = [[res.titulo], [res.resumen || ""], []];
      if (res.tarjetas) { din.push(res.tarjetas.map((t) => t.label)); din.push(res.tarjetas.map((t) => Number(t.valor) || 0)); din.push(res.tarjetas.map((t) => t.sub)); din.push([]); }
      for (const s of res.secciones.filter((s) => !s.hoja)) { din.push(...bloque(s), []); }
      const wsD = XLSX.utils.aoa_to_sheet(din);
      wsD["!cols"] = [{ wch: 48 }, ...Array(8).fill({ wch: 18 })];
      XLSX.utils.book_append_sheet(wb, wsD, "Dinamicas");
      for (const s of res.secciones.filter((s) => s.hoja)) {
        const aoa = bloque(s).slice(1); // sin el título: encabezado en la fila 1 para que funcione el filtro
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!cols"] = s.columns.map((c) => ({ wch: Math.min(45, Math.max(10, c.label.length + 2)) }));
        ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, s.rows.length), c: s.columns.length - 1 } }) };
        XLSX.utils.book_append_sheet(wb, ws, s.hoja);
      }
      XLSX.writeFile(wb, `${res.titulo.replace(/[^\w]+/g, "_").slice(0, 40)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      return;
    }
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

  if (docInst) return (
    <div>
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <button className="boton secundario" onClick={() => setDocInst(null)}>← Volver</button>
        <div><label style={lbl}>Representante legal del proveedor</label><input style={{ ...inp, width: 260 }} value={docInst.representante} onChange={(e) => setDocInst((p) => ({ ...p, representante: e.target.value }))} placeholder="Quien firma por el proveedor" /></div>
        <div><label style={lbl}>Hora inicio</label><input style={{ ...inp, width: 90 }} value={docInst.horaInicio} onChange={(e) => setDocInst((p) => ({ ...p, horaInicio: e.target.value }))} /></div>
        <div><label style={lbl}>Hora fin</label><input style={{ ...inp, width: 90 }} value={docInst.horaFin} onChange={(e) => setDocInst((p) => ({ ...p, horaFin: e.target.value }))} /></div>
        <button className="boton secundario" onClick={() => window.print()}>⬇ Imprimir / Guardar PDF</button>
        <button className="boton secundario" onClick={() => descargarConciliacionWord(docInst).catch((e) => setMsg("No se pudo generar el Word: " + e.message))}>⬇ Descargar Word</button>
        {msg && <span style={{ fontSize: 12, color: "var(--rojo)" }}>{msg}</span>}
      </div>
      <ConciliacionProveedor datos={docInst} />
    </div>
  );

  const filtroInputs = {
    contrato: <div key="c"><label style={lbl}>Contrato{filtros.proveedor ? " (del proveedor elegido)" : ""}</label><input list="rp-cont" style={inp} value={filtros.contrato} onChange={(e) => setF("contrato", e.target.value)} placeholder={filtros.proveedor ? "Uno solo → se toma solo" : "Todos"} /><datalist id="rp-cont">{(filtros.proveedor ? [...new Set(contratos.filter((c) => c.prov === filtros.proveedor).map((c) => c.numero_interno))].sort() : listaContratos).map((c) => <option key={c} value={c} />)}</datalist></div>,
    proveedor: <div key="p"><label style={lbl}>Proveedor</label><input list="rp-prov" style={inp} value={filtros.proveedor} onChange={(e) => setF("proveedor", e.target.value)} placeholder="Todos" /><datalist id="rp-prov">{proveedores.map((c) => <option key={c} value={c} />)}</datalist></div>,
    capitulo: <div key="cap"><label style={lbl}>Capítulo</label><select style={inp} value={filtros.capitulo} onChange={(e) => setF("capitulo", e.target.value)}><option value="">Todos</option>{capitulos.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>,
    etapa: <div key="e"><label style={lbl}>Etapa</label><select style={inp} value={filtros.etapa} onChange={(e) => setF("etapa", e.target.value)}><option value="">Todas</option>{ETAPAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>,
    fechas: <div key="f" style={{ display: "flex", gap: 6 }}><div><label style={lbl}>Desde (periodo)</label><input type="date" style={inp} value={filtros.desde} onChange={(e) => setF("desde", e.target.value)} /></div><div><label style={lbl}>Hasta</label><input type="date" style={inp} value={filtros.hasta} onChange={(e) => setF("hasta", e.target.value)} /></div></div>,
    folio: (
      <div key="fo" style={{ position: "relative" }}>
        <label style={lbl}>Folio de la factura (escribe y elige de la lista)</label>
        <input
          style={inp}
          value={filtros.folio}
          autoComplete="off"
          onChange={(e) => { setF("folio", e.target.value); setFolioOpen(true); }}
          onFocus={() => setFolioOpen(true)}
          onBlur={() => setTimeout(() => setFolioOpen(false), 150)}
          placeholder="Folio de ingreso, folio del proveedor o proveedor…"
        />
        {folioOpen && (() => {
          const q = (filtros.folio || "").trim().toLowerCase();
          const lista = (q
            ? facturas.filter((f) => `${f.folio_ingreso || ""} ${f.folio_proveedor || ""} ${f.prov || ""}`.toLowerCase().includes(q))
            : facturas
          ).slice(0, 40);
          return (
            <div style={{ position: "absolute", zIndex: 30, left: 0, right: 0, top: "calc(100% + 2px)", background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,.12)", maxHeight: 300, overflowY: "auto" }}>
              {lista.length === 0 ? (
                <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--texto-suave)" }}>Sin coincidencias.</div>
              ) : lista.map((f) => (
                <div
                  key={f.id}
                  onMouseDown={(e) => { e.preventDefault(); setF("folio", f.folio_ingreso || f.folio_proveedor || ""); setFolioOpen(false); }}
                  style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid var(--borde)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fondo)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--blanco)")}
                >
                  <div style={{ fontWeight: 600 }}>{f.folio_ingreso || "(sin folio ingreso)"}</div>
                  <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.prov} · Folio prov. {f.folio_proveedor || "—"}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    ),
    concepto: <div key="co"><label style={lbl}>Concepto / insumo</label><input style={inp} value={filtros.concepto} onChange={(e) => setF("concepto", e.target.value)} placeholder="Ej. jitomate, gasa, oxígeno…" /></div>,
    soloVencidos: <label key="sv" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginTop: 18 }}><input type="checkbox" checked={filtros.soloVencidos} onChange={(e) => setF("soloVencidos", e.target.checked)} /> Solo contratos vencidos</label>,
    archivoCE: <div key="ace" style={{ gridColumn: "1 / -1" }}><label style={lbl}>Archivo de Solicitudes de compra emergente (el que pasa el administrador, .xlsx del SAI)</label><input type="file" accept=".xlsx,.xls" style={inp} onChange={(e) => { setCeArchivo(e.target.files?.[0] || null); setRes(null); setMsg(""); }} />{ceArchivo && <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 4 }}>Elegido: {ceArchivo.name}</div>}</div>,
    detalleCE: <label key="dce" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginTop: 18 }}><input type="checkbox" checked={filtros.detalleCE} onChange={(e) => setF("detalleCE", e.target.checked)} /> Ver detalle por factura</label>,
  };

  return (
    <div>
      <div className="no-print" style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 className="no-print" style={{ fontSize: 22, margin: 0 }}>Reportes</h1>
      <p className="no-print" style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 4 }}>Elige un reporte, aplica filtros y descárgalo en Excel o PDF.</p>

      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* Catálogo de reportes */}
        <div className="no-print" style={{ ...card, width: 260, flexShrink: 0 }}>
          {["Facturas", "Contratos", "Traslados"].map((g) => (
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

            {/* R3b: selector de conceptos del contrato (o búsqueda por texto) */}
            {repKey === "r3b" && (
              <div style={{ marginTop: 12 }}>
                {filtros.contrato && servLista.length > 0 ? (
                  <div style={{ border: "1px solid var(--borde)", borderRadius: 8, padding: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>Conceptos del contrato ({servLista.length})</strong>
                      <input value={buscaConcepto} onChange={(e) => setBuscaConcepto(e.target.value)} placeholder="Filtrar conceptos…" style={{ ...inp, width: 200 }} />
                      <button className="boton secundario" style={{ fontSize: 12 }} onClick={() => setServSel(new Set(servLista.map((s) => s.id)))}>Todos</button>
                      <button className="boton secundario" style={{ fontSize: 12 }} onClick={() => setServSel(new Set())}>Ninguno</button>
                      <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>{servSel.size} seleccionado(s)</span>
                    </div>
                    <div style={{ maxHeight: 240, overflowY: "auto", display: "grid", gap: 2 }}>
                      {servLista.filter((s) => s.nombre_servicio.toLowerCase().includes(buscaConcepto.trim().toLowerCase())).map((s) => (
                        <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "3px 4px" }}>
                          <input type="checkbox" checked={servSel.has(s.id)} onChange={(e) => setServSel((prev) => { const n = new Set(prev); e.target.checked ? n.add(s.id) : n.delete(s.id); return n; })} />
                          <span style={{ flex: 1 }}>{s.nombre_servicio}</span>
                          <span style={{ color: "var(--texto-suave)", fontSize: 12 }}>{money(s.precio_unitario)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={lbl}>O busca por texto (sin elegir contrato)</label>
                    <input style={{ ...inp, maxWidth: 360 }} value={filtros.concepto} onChange={(e) => setF("concepto", e.target.value)} placeholder="Ej. jitomate, gasa, oxígeno…" />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button className="boton" onClick={generar} disabled={generando}>{generando ? "Generando…" : "Generar reporte"}</button>
              {res && <button className="boton secundario" onClick={exportExcel}>⬇ Excel</button>}
              {res && <button className="boton secundario" onClick={exportPDF}>⬇ PDF</button>}
              {res && repKey === "r11" && res.acta && <button className="boton" onClick={() => setDocInst({ ...res.acta, fecha: new Date().toLocaleDateString("en-CA"), representante: "", horaInicio: "08:00", horaFin: "09:00" })}>📄 Generar acta institucional (PDF / Word)</button>}
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
              {res.tarjetas && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
                  {res.tarjetas.map((t) => (
                    <div key={t.label} style={{ ...card, borderTop: `4px solid ${t.alerta ? "var(--rojo)" : "var(--verde)"}` }}>
                      <div style={{ fontSize: 12, color: "var(--texto-suave)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: t.alerta ? "var(--rojo)" : "var(--texto)" }}>{money(t.valor)}</div>
                      <div style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{t.sub}</div>
                    </div>
                  ))}
                </div>
              )}
              {res.secciones && res.secciones.map((s) => s.plegada ? (
                <details key={s.id} style={{ marginBottom: 16 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>{s.titulo} ({s.rows.length})</summary>
                  <TablaRep s={s} />
                </details>
              ) : (
                <div key={s.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>{s.titulo}</div>
                  <TablaRep s={s} />
                </div>
              ))}
              {!res.secciones && <>
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
              </>}
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
