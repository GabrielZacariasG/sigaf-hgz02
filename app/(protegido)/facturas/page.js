"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [oficio, setOficio] = useState(null);  // { tipo:'pago'|'devolucion', docs:[{ prov?, filas, folio, motivo? }] }
  const [enviando, setEnviando] = useState(false);
  const [provJefes, setProvJefes] = useState({}); // proveedor_id -> [{nombre, jefatura}]
  const [deepHecho, setDeepHecho] = useState(false); // enlace ?accion=memo|pago&id= (desde el detalle)
  const [deepOrigenId, setDeepOrigenId] = useState(null); // factura de la que vino el enlace, para "Volver" al detalle
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const [jp, js, pr] = await Promise.all([
        supabase.from("jefe_proveedor").select("proveedor_id, jefe_id"),
        supabase.from("jefes_servicio").select("id, nombre, jefatura, cargo"),
        supabase.from("proveedores").select("id, razon_social"),
      ]);
      const jmap = {}; (js.data || []).forEach((j) => (jmap[j.id] = j));
      const pmap = {}; (pr.data || []).forEach((p) => (pmap[p.id] = p.razon_social));
      const nk = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, ""); // clave por nombre (robusta a duplicados)
      const m = {}; // razonNormalizada -> [{nombre, jefatura}]
      (jp.data || []).forEach((r) => {
        const j = jmap[r.jefe_id]; const rz = pmap[r.proveedor_id];
        if (!j || !rz) return;
        const k = nk(rz);
        const arr = (m[k] ||= []);
        if (!arr.some((x) => x.nombre === j.nombre)) arr.push({ nombre: [j.cargo, j.nombre].filter(Boolean).join(" "), jefatura: j.jefatura });
      });
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
            "id, folio_ingreso, folio_proveedor, importe_factura, validacion_ok, cr_contrarecibo, estatus_general, estatus_firmas, estatus_pedido_recepcion, periodo_inicio, periodo_fin, contratos ( numero_interno ), proveedores ( razon_social ), capitulos ( nombre ), partidas ( cuenta_prei, cuenta_finat )"
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
          pp: f.partidas?.cuenta_finat || f.partidas?.cuenta_prei || "—",
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

  const enviarServicio = async (lista) => {
    const items = lista && lista.length ? lista : seleccionadas;
    if (!items.length) return;
    const g = new Map();
    const nk = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    for (const f of items) {
      const jefes = provJefes[nk(f.prov)] || [];
      if (!jefes.length) {
        const k = "__sin__"; const grp = g.get(k) || { jefe: "Jefe(a) de Servicio correspondiente", jefatura: "(sin proveedor asignado)", filas: [] };
        grp.filas.push(f); g.set(k, grp);
      } else for (const j of jefes) {
        const grp = g.get(j.nombre) || { jefe: j.nombre, jefatura: j.jefatura, filas: [] };
        grp.filas.push(f); g.set(j.nombre, grp);
      }
    }
    const anio = new Date().getFullYear();
    let consec = await proximoConsec("envio_servicio", anio);
    const grupos = [...g.values()].map((x) => { const c = consec++; return { ...x, tipoDb: "envio_servicio", anio, consecutivo: c, folio: fmtFolio("envio_servicio", c, anio) }; });
    setMemo({ grupos });
  };
  const confirmarEnvio = async () => {
    setEnviando(true);
    try {
      for (const gr of memo.grupos) {
        await supabase.from("oficios").insert({
          tipo: "envio_servicio", folio: gr.folio, anio: gr.anio, consecutivo: gr.consecutivo,
          destinatario: gr.jefe, total: gr.filas.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0),
          factura_ids: gr.filas.map((f) => f.id),
        });
      }
      const ids = [...new Set(memo.grupos.flatMap((gr) => gr.filas.map((f) => f.id)))];
      for (let i = 0; i < ids.length; i += 25) {
        const lote = ids.slice(i, i + 25);
        await Promise.all(lote.map((id) => supabase.from("facturas").update({ estatus_firmas: "envio_firmas_servicio" }).eq("id", id)));
      }
      setFacturas((prev) => prev.map((f) => (ids.includes(f.id) ? { ...f, estatus_firmas: "envio_firmas_servicio" } : f)));
      const d = deepOrigenId;
      setSel({}); setMemo(null);
      if (d) router.push(`/facturas/${d}`);
    } catch (e) { setMensaje("No se pudo enviar: " + e.message); }
    setEnviando(false);
  };

  // ---- Oficios (envío a pago OOAD / devolución / envío a servicio), firma de la jefa ----
  // Folio automático: SIGAF-EP-0001/2026, SIGAF-DP-0001/2026, SIGAF-ES-0001/2026
  const OFICIO_COD = { envio_pago: "EP", devolucion: "DP", envio_servicio: "ES" };
  const fmtFolio = (tipoDb, consec, anio) =>
    `SIGAF-${OFICIO_COD[tipoDb]}-${String(consec).padStart(4, "0")}/${anio}`;
  const proximoConsec = async (tipoDb, anio) => {
    const { data } = await supabase.from("oficios").select("consecutivo").eq("tipo", tipoDb).eq("anio", anio).order("consecutivo", { ascending: false }).limit(1);
    return (data?.[0]?.consecutivo || 0) + 1;
  };
  const enviarOOAD = async (lista) => {
    const items = lista && lista.length ? lista : seleccionadas;
    if (!items.length) return;
    const anio = new Date().getFullYear();
    const consec = await proximoConsec("envio_pago", anio);
    setOficio({ tipo: "pago", docs: [{ filas: [...items], tipoDb: "envio_pago", anio, consecutivo: consec, folio: fmtFolio("envio_pago", consec, anio) }] });
  };
  const devolverProveedor = async () => {
    if (!seleccionadas.length) return;
    const g = new Map();
    for (const f of seleccionadas) { const grp = g.get(f.prov) || { prov: f.prov, filas: [] }; grp.filas.push(f); g.set(f.prov, grp); }
    const anio = new Date().getFullYear();
    let consec = await proximoConsec("devolucion", anio);
    const docs = [...g.values()].map((x) => { const c = consec++; return { ...x, tipoDb: "devolucion", anio, consecutivo: c, folio: fmtFolio("devolucion", c, anio), motivo: "" }; });
    setOficio({ tipo: "devolucion", docs });
  };

  // Enlace desde el detalle de una factura: /facturas?accion=memo|pago&id=<facturaId>
  // Abre el oficio (memo al servicio / envío a pago) SOLO de esa factura.
  useEffect(() => {
    if (deepHecho || cargando || !facturas.length) return;
    const q = new URLSearchParams(window.location.search);
    const accion = q.get("accion");
    const id = q.get("id");
    if (!accion || !id) return;
    // El memo agrupa por jefe (provJefes): esperar a que cargue ese catálogo.
    if (accion === "memo" && Object.keys(provJefes).length === 0) return;
    const f = facturas.find((x) => x.id === id);
    setDeepHecho(true);
    if (!f) { setMensaje("No se encontró la factura del enlace."); return; }
    setDeepOrigenId(id);
    if (accion === "memo") enviarServicio([f]);
    else if (accion === "pago") enviarOOAD([f]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, facturas, provJefes, deepHecho]);
  const setDoc = (i, campo, val) => setOficio((o) => ({ ...o, docs: o.docs.map((d, idx) => (idx === i ? { ...d, [campo]: val } : d)) }));
  const confirmarOficio = async () => {
    setEnviando(true);
    try {
      const patchBase = oficio.tipo === "pago"
        ? { estatus_general: "en_tramite_ooad" }
        : { estatus_general: "devuelta_proveedor", fecha_devolucion: new Date().toISOString() };
      for (const d of oficio.docs) {
        const totalDoc = d.filas.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0);
        const dest = oficio.tipo === "pago" ? "Mtra. Farlyn Isabel Hernández Arias (Depto. Presupuesto, Contabilidad y Erogaciones)" : d.prov;
        await supabase.from("oficios").insert({ tipo: d.tipoDb, folio: d.folio, anio: d.anio, consecutivo: d.consecutivo, destinatario: dest, total: totalDoc, factura_ids: d.filas.map((f) => f.id), motivo: d.motivo || null });
        const ids = d.filas.map((f) => f.id);
        const patch = oficio.tipo === "devolucion" ? { ...patchBase, motivo_devolucion: d.motivo || null } : patchBase;
        for (let i = 0; i < ids.length; i += 25) {
          const lote = ids.slice(i, i + 25);
          await Promise.all(lote.map((id) => supabase.from("facturas").update(patch).eq("id", id)));
        }
      }
      const allIds = new Set(oficio.docs.flatMap((d) => d.filas.map((f) => f.id)));
      setFacturas((prev) => prev.map((f) => (allIds.has(f.id) ? { ...f, estatus_general: patchBase.estatus_general } : f)));
      setSel({}); setOficio(null);
    } catch (e) { setMensaje("No se pudo aplicar: " + e.message); }
    setEnviando(false);
  };

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  // ---- OFICIO(s) en hoja membretada (envío a pago / devolución) ----
  if (oficio) {
    const esPago = oficio.tipo === "pago";
    const hoy = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const fFact = (f) => (f.periodo_fin ? new Date(f.periodo_fin + "T00:00:00").toLocaleDateString("es-MX") : "—");
    const inp = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14 };
    const oTh = { fontSize: 11, textAlign: "left", padding: "5px 7px", border: "1px solid #333", background: "#f2f2f2", fontWeight: 700 };
    const oTd = { fontSize: 11, padding: "4px 7px", border: "1px solid #333" };
    return (
      <div>
        <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="boton secundario" onClick={() => { const d = deepOrigenId; setOficio(null); if (d) router.push(`/facturas/${d}`); }}>← Volver{deepOrigenId ? " a la factura" : ""}</button>
          <button className="boton secundario" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
          <button className="boton" onClick={confirmarOficio} disabled={enviando}>
            {enviando ? "Aplicando…" : esPago ? "Confirmar envío a OOAD" : "Confirmar devolución"}
          </button>
          <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>{oficio.docs.length} oficio(s) · hoja membretada</span>
        </div>
        {/* Controles editables (no se imprimen) */}
        <div className="no-print" style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          {oficio.docs.map((d, i) => (
            <div key={i} style={{ border: "1px solid var(--borde)", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Oficio {i + 1}{d.prov ? ` · ${d.prov}` : ""} ({d.filas.length} factura{d.filas.length !== 1 ? "s" : ""})</div>
              <div style={{ fontSize: 12 }}>No. de oficio (automático): <strong>{d.folio}</strong></div>
              {!esPago && (
                <label style={{ fontSize: 12 }}>Causa de la devolución:
                  <textarea value={d.motivo} onChange={(e) => setDoc(i, "motivo", e.target.value)} rows={2} placeholder="Ej. La factura 21100 cobra 42 jamón y 19 pechuga, debiendo ser 47 jamón y 14 pechuga…" style={{ ...inp, width: "100%", display: "block", marginTop: 4 }} />
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="hoja">
          {/* oficio de pago/devolución — membrete por hoja (thead/tfoot); varios docs = salto entre ellos */}
          <div className="doc-hoja">
          <table className="wrap">
            <thead><tr><td className="thc"><img src="/mem-encabezado.png" alt="" className="mem-h" /></td></tr></thead>
            <tfoot><tr><td className="tfc"><img src="/mem-pie.png" alt="" className="mem-f" /></td></tr></tfoot>
            <tbody><tr><td className="cuerpo">
          {oficio.docs.map((d, di) => {
            const total = d.filas.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0);
            // Servicio(s) que validaron (jefatura ligada al proveedor de cada factura)
            const nkr = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
            const servicios = [...new Set(d.filas.flatMap((f) => (provJefes[nkr(f.prov)] || []).map((j) => j.jefatura)).filter(Boolean))];
            const servicioTxt = servicios.length === 1
              ? `el Servicio de ${servicios[0]}`
              : servicios.length > 1
                ? `los servicios de ${servicios.slice(0, -1).join(", ")} y ${servicios[servicios.length - 1]}`
                : "el servicio correspondiente";
            return (
              <div key={di}>
                {di > 0 && <div className="salto" />}
                  {/* Encabezado institucional (arriba a la izquierda) — formato unificado */}
                  <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, color: "#222" }}>
                    ÓRGANO DE OPERACIÓN ADMINISTRATIVA DESCONCENTRADA ESTATAL EN AGUASCALIENTES<br />
                    HOSPITAL GENERAL DE ZONA NO. 2
                  </div>
                  {/* Of. N° y fecha — arriba a la derecha */}
                  <div style={{ textAlign: "right", marginTop: 16, fontSize: 13.5, lineHeight: 1.7 }}>
                    <div>Of. N° <strong>{d.folio}</strong></div>
                    <div>Aguascalientes, Ags., a {hoy}</div>
                  </div>
                  {/* Destinatario en bloque */}
                  <div style={{ marginTop: 8, fontSize: 14 }}>
                    <div style={{ fontWeight: 700 }}>{esPago ? "Mtra. Farlyn Isabel Hernández Arias" : d.prov}</div>
                    <div>{esPago ? "Departamento de Presupuesto, Contabilidad y Erogaciones" : "Estimado proveedor"}</div>
                    <div style={{ marginTop: 16 }}>Presente</div>
                  </div>
                  <p style={{ marginTop: 18, fontSize: 12.5, textAlign: "justify", lineHeight: 1.55 }}>
                    {esPago
                      ? <>Por medio del presente envío a usted, facturas <strong>validadas por {servicioTxt}</strong>, para trámite de pago, mismas que a continuación se relacionan:</>
                      : "Por medio del presente se devuelven a usted las siguientes facturas para su corrección, mismas que a continuación se relacionan:"}
                  </p>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
                    <thead><tr><th style={oTh}>Cuenta (P.P.)</th><th style={oTh}>Contrato</th><th style={oTh}>Fecha Fact.</th><th style={oTh}>Folio</th><th style={{ ...oTh, textAlign: "right" }}>Importe</th><th style={oTh}>Proveedor</th></tr></thead>
                    <tbody>
                      {d.filas.map((f) => (
                        <tr key={f.id}><td style={oTd}>{f.pp}</td><td style={oTd}>{f.contrato}</td><td style={oTd}>{fFact(f)}</td><td style={oTd}>{f.folio_proveedor}</td><td style={{ ...oTd, textAlign: "right" }}>{money(f.importe_factura)}</td><td style={oTd}>{f.prov}</td></tr>
                      ))}
                      <tr><td style={{ ...oTd, fontWeight: 700 }} colSpan={4}>Total ({d.filas.length})</td><td style={{ ...oTd, textAlign: "right", fontWeight: 700 }}>{money(total)}</td><td style={oTd}></td></tr>
                    </tbody>
                  </table>
                  {!esPago && (
                    <p style={{ marginTop: 14, fontSize: 12.5, textAlign: "justify", lineHeight: 1.55 }}><strong>Motivo de la devolución:</strong> {d.motivo || "____________________________________________"}</p>
                  )}
                  <p style={{ marginTop: 14, fontSize: 12.5, textAlign: "justify", lineHeight: 1.55 }}>
                    Lo anterior para su trámite correspondiente, sin otro particular de momento, me despido enviando un cordial saludo.
                  </p>
                  <div style={{ marginTop: 40, textAlign: "left" }}>
                    <div style={{ fontWeight: 700, letterSpacing: 3 }}>ATENTAMENTE</div>
                    <div style={{ fontStyle: "italic", fontSize: 12, color: "#444" }}>&ldquo;SEGURIDAD Y SOLIDARIDAD SOCIAL&rdquo;</div>
                    <div style={{ marginTop: 56 }}>
                      <strong>L.A. Nayeli Alonso Orozco</strong><br />
                      <span style={{ fontSize: 12.5 }}>Jefa del Departamento de Finanzas del HGZ No. 02</span>
                    </div>
                    <div style={{ marginTop: 18, fontSize: 12 }}>c.c.p. Expediente</div>
                    <div style={{ marginTop: 14, fontSize: 10.5, color: "#666", lineHeight: 1.4 }}>
                      Revisó: L.A.E. Gabriel Alejandro Zacarías Girón<br />
                      Jefe de la Oficina de Presupuesto · HGZ No. 02
                    </div>
                  </div>
              </div>
            );
          })}
            </td></tr></tbody>
          </table>
          </div>
        </div>
        <style>{`
          /* Membrete que se repite por hoja: encabezado en <thead>, pie en <tfoot>. Sin alturas forzadas. */
          .doc-hoja { background:#fff; color:#111; box-sizing:border-box; width:21.6cm; min-height:27.9cm; margin:0 auto 20px; padding:0.5cm 1.2cm; border:1px solid var(--borde); border-radius:4px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          .wrap { width:100%; border-collapse:collapse; }
          .mem-h, .mem-f { display:block; width:100%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          .thc, .tfc { padding:0; }
          .cuerpo { vertical-align:top; padding:0.25cm 0.8cm; color:#111; }
          .cuerpo table tr { break-inside:avoid; }
          .of-datos { margin-top:14px; font-size:12.5px; line-height:1.6; }
          .of-datos > div { padding:2px 0; }
          .salto { break-before: page; page-break-before: always; height: 0; overflow: hidden; }
          @page { size: letter; margin: 0.5cm 1.2cm; }
          @media print {
            body * { visibility: hidden !important; }
            .hoja, .hoja * { visibility: visible !important; }
            .no-print { display:none !important; }
            .doc-hoja { border:none !important; margin:0 !important; border-radius:0 !important; width:100%; min-height:0 !important; padding:0 !important; }
            thead { display:table-header-group; }
            tfoot { display:table-footer-group; }
          }
        `}</style>
      </div>
    );
  }


  // ---- MEMORÁNDUM(s) de envío al servicio, uno por jefe (hoja carta, limpio) ----
  if (memo) {
    const mH = { textAlign: "left", fontSize: 12, padding: "8px 12px", borderBottom: "2px solid #333", textTransform: "uppercase", letterSpacing: 0.4, color: "#333" };
    const mD = { padding: "8px 12px", borderBottom: "1px solid #ddd", fontSize: 13 };
    return (
      <div>
        <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <button className="boton secundario" onClick={() => { const d = deepOrigenId; setMemo(null); if (d) router.push(`/facturas/${d}`); }}>← Volver{deepOrigenId ? " a la factura" : ""}</button>
          <button className="boton secundario" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
          <button className="boton" onClick={confirmarEnvio} disabled={enviando}>{enviando ? "Enviando…" : "Confirmar envío al servicio"}</button>
          <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>{memo.grupos.length} memo(s) · un jefe por hoja carta</span>
        </div>
        <div className="hoja">
          <div className="doc-hoja">
          <table className="wrap">
            <thead><tr><td className="thc"><img src="/mem-encabezado.png" alt="" className="mem-h" /></td></tr></thead>
            <tfoot><tr><td className="tfc"><img src="/mem-pie.png" alt="" className="mem-f" /></td></tr></tfoot>
            <tbody><tr><td className="cuerpo">
          {memo.grupos.map((g, gi) => {
            const total = g.filas.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0);
            return (
              <div key={gi}>
                {gi > 0 && <div className="salto" />}
                  {/* Encabezado institucional (arriba a la izquierda) — formato unificado */}
                  <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, color: "#222" }}>
                    ÓRGANO DE OPERACIÓN ADMINISTRATIVA DESCONCENTRADA ESTATAL EN AGUASCALIENTES<br />
                    HOSPITAL GENERAL DE ZONA NO. 2
                  </div>
                  {/* Memorándum N° y fecha — arriba a la derecha */}
                  <div style={{ textAlign: "right", marginTop: 16, fontSize: 13.5, lineHeight: 1.7 }}>
                    <div>Memorándum N° <strong>{g.folio}</strong></div>
                    <div>Aguascalientes, Ags., a {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}.</div>
                  </div>
                  {/* Destinatario en bloque */}
                  <div style={{ marginTop: 8, fontSize: 14 }}>
                    <div style={{ fontWeight: 700 }}>{g.jefe}</div>
                    <div>{g.jefatura ? `Jefatura de ${g.jefatura}` : "Jefe(a) de Servicio"}</div>
                    <div style={{ marginTop: 16 }}>Presente</div>
                  </div>
                  <p style={{ marginTop: 30, textAlign: "justify", fontSize: 15, lineHeight: 1.7 }}>
                    Por este medio se remiten las siguientes facturas <strong>para su validación</strong>. Se solicita atentamente devolver, según sea el caso,
                    el <strong>oficio de cumplimiento o de incumplimiento</strong> dirigido al <strong>administrador del contrato</strong>.
                  </p>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 22 }}>
                    <thead><tr><th style={mH}>Folio</th><th style={mH}>Proveedor</th><th style={mH}>Contrato</th><th style={mH}>Periodo</th><th style={{ ...mH, textAlign: "right" }}>Importe</th></tr></thead>
                    <tbody>
                      {g.filas.map((f) => (
                        <tr key={f.id}><td style={mD}>{f.folio_proveedor}</td><td style={mD}>{f.prov}</td><td style={mD}>{f.contrato}</td><td style={mD}>{f.periodo_inicio ?? "—"} → {f.periodo_fin ?? "—"}</td><td style={{ ...mD, textAlign: "right" }}>{money(f.importe_factura)}</td></tr>
                      ))}
                      <tr><td style={{ ...mD, borderBottom: "2px solid #333", borderTop: "2px solid #333" }} colSpan={4}><strong>Total ({g.filas.length} factura{g.filas.length !== 1 ? "s" : ""})</strong></td><td style={{ ...mD, textAlign: "right", fontWeight: 700, borderBottom: "2px solid #333", borderTop: "2px solid #333" }}>{money(total)}</td></tr>
                    </tbody>
                  </table>
                {/* firma al fondo de la hoja */}
                <div style={{ marginTop: 48, textAlign: "left" }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>ATENTAMENTE</div>
                  <div style={{ fontSize: 12, fontStyle: "italic", color: "#555", marginBottom: 56 }}>&ldquo;Seguridad y Solidaridad Social&rdquo;</div>
                  <div style={{ borderTop: "1px solid #333", width: 320, margin: "0", paddingTop: 6 }}>
                    <strong>L.A. Nayeli Alonso Orozco</strong><br />
                    <span style={{ fontSize: 13, color: "#444" }}>Jefa del Departamento de Finanzas · HGZ No. 2</span>
                  </div>
                  <div style={{ marginTop: 22, fontSize: 10.5, color: "#666", lineHeight: 1.4 }}>
                    Revisó: L.A.E. Gabriel Alejandro Zacarías Girón<br />
                    Jefe de la Oficina de Presupuesto · HGZ No. 02
                  </div>
                </div>
              </div>
            );
          })}
            </td></tr></tbody>
          </table>
          </div>
        </div>
        <style>{`
          /* Membrete que se repite por hoja: encabezado en <thead>, pie en <tfoot>. Sin alturas forzadas. */
          .doc-hoja { background:#fff; color:#111; box-sizing:border-box; width:21.6cm; min-height:27.9cm; margin:0 auto 20px; padding:0.5cm 1.2cm; border:1px solid var(--borde); border-radius:4px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          .wrap { width:100%; border-collapse:collapse; }
          .mem-h, .mem-f { display:block; width:100%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          .thc, .tfc { padding:0; }
          .cuerpo { vertical-align:top; padding:0.25cm 0.8cm; }
          .cuerpo table tr { break-inside:avoid; }
          .salto { break-before: page; page-break-before: always; height: 0; overflow: hidden; }
          @page { size: letter; margin: 0.5cm 1.2cm; }
          @media print {
            body * { visibility: hidden !important; }
            .hoja, .hoja * { visibility: visible !important; }
            .hoja { position:static !important; width:100%; }
            .no-print { display:none !important; }
            .doc-hoja { border:none !important; border-radius:0 !important; margin:0 !important; width:100%; min-height:0 !important; padding:0 !important; }
            thead { display:table-header-group; }
            tfoot { display:table-footer-group; }
          }
        `}</style>
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
            <button className="boton secundario" onClick={enviarServicio}>Enviar al servicio →</button>
            <button className="boton secundario" onClick={devolverProveedor}>Devolver al proveedor →</button>
            <button className="boton" onClick={enviarOOAD}>Enviar a OOAD (pago) →</button>
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
