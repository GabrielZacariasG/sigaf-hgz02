"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

const DRAFT_KEY = "sigaf_borrador_factura"; // borrador local para no perder la captura

const TOLERANCIA = 1.0; // $1.00 MXN
const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Prefijo de folio de ingreso por capítulo. Debe empatar con los usados en la
// migración (HGZ2-INT-*, HGZ2-AM-*, HGZ2-SS-*, HGZ2-CB-*).
const PREFIJO_CAPITULO = {
  "Integrales": "INT",
  "Servicios Integrales": "INT",
  "Área Médica": "AM",
  "Subrogados": "SS",
  "Cuadro Básico": "CB",
  "Compra Emergente": "CE",
};
function prefijoDe(nombre) {
  if (PREFIJO_CAPITULO[nombre]) return PREFIJO_CAPITULO[nombre];
  // fallback: iniciales alfanuméricas, hasta 3 letras
  const s = (nombre || "GEN").normalize("NFD").replace(/[^\w\s]/g, "").trim().toUpperCase();
  return s.split(/\s+/).map((w) => w[0]).join("").slice(0, 3) || "GEN";
}

// Siguiente folio: HGZ2-{PREFIJO}-{anio}-{consecutivo 6 díg.}
async function generarFolioIngreso(prefijoCap, anio) {
  const prefijo = `HGZ2-${prefijoCap}-${anio}-`;
  const { data, error } = await supabase
    .from("facturas")
    .select("folio_ingreso")
    .like("folio_ingreso", `${prefijo}%`)
    .order("folio_ingreso", { ascending: false })
    .limit(1);
  if (error) throw error;
  let consecutivo = 1;
  if (data && data.length > 0) {
    const ultimo = data[0].folio_ingreso.slice(prefijo.length);
    const n = parseInt(ultimo, 10);
    if (!Number.isNaN(n)) consecutivo = n + 1;
  }
  return prefijo + String(consecutivo).padStart(6, "0");
}

export default function NuevaFacturaPage() {
  const router = useRouter();
  const [contratos, setContratos] = useState([]);   // todos, con proveedor + partida + capítulo embebidos
  const [cargandoCat, setCargandoCat] = useState(true);

  const [paso, setPaso] = useState(1); // 1 = datos · 2 = validación
  const [modo, setModo] = useState("contrato"); // "contrato" | "oc" (compra emergente)
  const [todosProveedores, setTodosProveedores] = useState([]); // TODOS (para compra emergente)
  const [ordenCompra, setOrdenCompra] = useState("");           // número de OC (compra emergente)
  const [ocDup, setOcDup] = useState("");                       // folio de factura donde ya se usó esa OC
  const [folioDup, setFolioDup] = useState("");                 // folio de factura donde ya se usó ese folio de proveedor

  // ---- Paso 1: datos de la factura ----
  const [proveedorId, setProveedorId] = useState("");
  const [provText, setProvText] = useState("");     // texto del buscador de proveedor
  const [provOpen, setProvOpen] = useState(false);  // dropdown de sugerencias abierto
  const [contratoId, setContratoId] = useState("");
  const [folioProveedor, setFolioProveedor] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFin, setPeriodoFin] = useState("");
  const [importe, setImporte] = useState("");       // TOTAL con IVA

  // ---- Paso 2: validación (subtotal/IVA + desglose) ----
  const [servicios, setServicios] = useState([]);
  const [cargandoServ, setCargandoServ] = useState(false);
  const [cantidades, setCantidades] = useState({});
  const [filtro, setFiltro] = useState("");
  const [subtotal, setSubtotal] = useState("");     // SUBTOTAL antes de IVA
  const [iva, setIva] = useState("");               // MONTO de IVA

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [exito, setExito] = useState(null);         // { id, folio, validacion_ok }
  const [borradorAviso, setBorradorAviso] = useState(false); // se restauró un borrador
  const restaurando = useRef(false);                // evita que el auto-select borre el contrato restaurado
  const draftListo = useRef(false);                 // no persistir hasta terminar de restaurar

  // Cargar TODOS los contratos con su proveedor, partida y capítulo. Con eso,
  // al elegir proveedor y contrato se autocompleta capítulo y cuenta.
  useEffect(() => {
    let activo = true;
    (async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id, numero_interno, adquisicion_servicio, proveedor_id, partida_id, proveedores ( id, razon_social ), partidas ( id, cuenta_finat, cuenta_prei, nombre, capitulo_id, capitulos ( id, nombre ) )")
        .order("numero_interno", { ascending: true });
      if (!activo) return;
      if (error) { setMensaje("No se pudieron cargar los contratos: " + error.message); }
      setContratos(data || []);

      // Todos los proveedores (para compra emergente el proveedor varía y puede
      // no tener contrato). Se excluyen los genéricos de contratos marco.
      const { data: provs } = await supabase
        .from("proveedores")
        .select("id, razon_social")
        .order("razon_social", { ascending: true });
      if (!activo) return;
      setTodosProveedores((provs || []).filter((p) => !/PROVEEDORES VARIOS/i.test(p.razon_social || "")));
      setCargandoCat(false);
    })();
    return () => { activo = false; };
  }, []);

  // Restaurar un borrador guardado localmente (para no perder la captura si se
  // cerró la sesión o se recargó la página).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        restaurando.current = true;
        if (d.modo) setModo(d.modo);
        if (d.proveedorId) setProveedorId(d.proveedorId);
        if (d.provText) setProvText(d.provText);
        if (d.contratoId) setContratoId(d.contratoId);
        if (d.folioProveedor) setFolioProveedor(d.folioProveedor);
        if (d.periodoInicio) setPeriodoInicio(d.periodoInicio);
        if (d.periodoFin) setPeriodoFin(d.periodoFin);
        if (d.importe) setImporte(d.importe);
        if (d.ordenCompra) setOrdenCompra(d.ordenCompra);
        if (d.subtotal) setSubtotal(d.subtotal);
        if (d.iva) setIva(d.iva);
        if (d.cantidades) setCantidades(d.cantidades);
        if (d.paso === 2) setPaso(2);
        setBorradorAviso(true);
      }
    } catch { /* localStorage no disponible */ }
    draftListo.current = true;
  }, []);

  const esOC = modo === "oc";
  // Contratos marco de Compra Emergente (uno por cuenta, número CE-####).
  const contratosCE = useMemo(() => contratos.filter((c) => (c.numero_interno || "").startsWith("CE-")), [contratos]);

  // Proveedores distintos (solo los que tienen contratos), ordenados. En modo
  // contrato se usa esta lista; en modo OC (compra emergente) se usan TODOS.
  const proveedoresConContrato = useMemo(() => {
    const m = new Map();
    for (const c of contratos) { if (c.proveedores) m.set(c.proveedores.id, c.proveedores.razon_social); }
    return [...m.entries()].map(([id, razon_social]) => ({ id, razon_social })).sort((a, b) => (a.razon_social || "").localeCompare(b.razon_social || ""));
  }, [contratos]);
  const proveedores = esOC ? todosProveedores : proveedoresConContrato;

  const contratosProv = useMemo(() => contratos.filter((c) => c.proveedor_id === proveedorId), [contratos, proveedorId]);

  // Al cambiar de proveedor (SOLO modo contrato): si tiene un solo contrato, se
  // elige solo; si no, se limpia. En modo OC el contrato marco es independiente.
  useEffect(() => {
    if (restaurando.current) { restaurando.current = false; return; } // no pisar el contrato restaurado
    if (esOC) return;
    if (!proveedorId) { setContratoId(""); return; }
    setContratoId(contratosProv.length === 1 ? contratosProv[0].id : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedorId, esOC]);

  // Guardar el borrador local cada vez que cambian los datos capturados.
  useEffect(() => {
    if (!draftListo.current || exito) return;
    const vacio = !proveedorId && !folioProveedor && !importe && !ordenCompra && !subtotal && !iva && Object.keys(cantidades).length === 0;
    try {
      if (vacio) { localStorage.removeItem(DRAFT_KEY); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        modo, proveedorId, provText, contratoId, folioProveedor, periodoInicio, periodoFin,
        importe, ordenCompra, subtotal, iva, cantidades, paso,
      }));
    } catch { /* localStorage no disponible */ }
  }, [modo, proveedorId, provText, contratoId, folioProveedor, periodoInicio, periodoFin, importe, ordenCompra, subtotal, iva, cantidades, paso, exito]);

  const contratoSel = useMemo(() => contratos.find((c) => c.id === contratoId) || null, [contratos, contratoId]);
  const capituloSel = contratoSel?.partidas?.capitulos || null;
  const cuentaSel = contratoSel?.partidas?.cuenta_finat || contratoSel?.partidas?.cuenta_prei || "";
  const importeNum = parseFloat(importe) || 0;

  // Validación principal: SUBTOTAL + IVA debe = TOTAL capturado (importe).
  const calc = useMemo(() => {
    const sub = parseFloat(subtotal) || 0;
    const ivaAmt = parseFloat(iva) || 0;
    const total = sub + ivaAmt;
    const totalFactura = importeNum;
    const diferencia = total - totalFactura;
    const tasaImplicita = sub > 0 ? ivaAmt / sub : 0;
    return { sub, iva: ivaAmt, total, totalFactura, diferencia, tasaImplicita, ok: sub > 0 && Math.abs(diferencia) <= TOLERANCIA };
  }, [subtotal, iva, importeNum]);

  // Suma de servicios (opcional): ayuda a llenar el subtotal.
  const sumaServicios = useMemo(() => {
    let s = 0;
    for (const sv of servicios) {
      const c = parseFloat(cantidades[sv.id]);
      if (!Number.isNaN(c) && c > 0) s += c * Number(sv.precio_unitario);
    }
    return s;
  }, [servicios, cantidades]);

  // El desglose cuadra con el TOTAL (precios con IVA) o con el SUBTOTAL (precios sin IVA).
  const desglose = useMemo(() => {
    const total = importeNum;
    const suma = sumaServicios;
    const conIva = suma > 0 && Math.abs(suma - total) <= TOLERANCIA;
    const sinIva = suma > 0 && Math.abs(suma * 1.16 - total) <= TOLERANCIA;
    return { total, suma, conIva, sinIva, ok: conIva || sinIva };
  }, [sumaServicios, importeNum]);

  const serviciosFiltrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return servicios;
    return servicios.filter((s) => s.nombre_servicio.toLowerCase().includes(f));
  }, [servicios, filtro]);

  // El desglose es OBLIGATORIO cuando el contrato tiene catálogo de conceptos.
  // (Compra emergente / contratos sin catálogo no tienen servicios → no aplica.)
  const requiereDesglose = servicios.length > 0;
  const desgloseListo = sumaServicios > 0;

  // ---- Detección de duplicados (candado) ----
  // Busca si el folio del proveedor (para ese proveedor) o la OC ya se
  // capturaron antes en una factura NO anulada. Devuelve los folios de ingreso.
  async function buscarDuplicados() {
    let folioDupFolio = "", ocDupFolio = "";
    const fp = folioProveedor.trim();
    if (fp && proveedorId) {
      const { data } = await supabase.from("facturas")
        .select("folio_ingreso").eq("folio_proveedor", fp).eq("proveedor_id", proveedorId).eq("anulada", false).limit(1);
      if (data && data.length) folioDupFolio = data[0].folio_ingreso;
    }
    if (esOC) {
      const oc = ordenCompra.trim();
      if (oc) {
        const { data } = await supabase.from("facturas")
          .select("folio_ingreso").eq("orden_compra", oc).eq("anulada", false).limit(1);
        if (data && data.length) ocDupFolio = data[0].folio_ingreso;
      }
    }
    return { folioDupFolio, ocDupFolio };
  }

  async function revisarFolioDup() {
    const fp = folioProveedor.trim();
    if (!fp || !proveedorId) { setFolioDup(""); return; }
    const { data } = await supabase.from("facturas")
      .select("folio_ingreso").eq("folio_proveedor", fp).eq("proveedor_id", proveedorId).eq("anulada", false).limit(1);
    setFolioDup(data && data.length ? data[0].folio_ingreso : "");
  }
  async function revisarOcDup() {
    const oc = ordenCompra.trim();
    if (!oc) { setOcDup(""); return; }
    const { data } = await supabase.from("facturas")
      .select("folio_ingreso").eq("orden_compra", oc).eq("anulada", false).limit(1);
    setOcDup(data && data.length ? data[0].folio_ingreso : "");
  }

  // Valida los datos del paso 1 (devuelve string de error o null).
  function validarPaso1() {
    if (esOC) {
      if (!proveedorId) return "Elige el proveedor de la compra emergente.";
      if (!contratoId || !contratoSel) return "Elige la cuenta (partida) de la compra emergente.";
      if (!ordenCompra.trim()) return "Captura el número de Orden de Compra (OC).";
    } else {
      if (!proveedorId || !contratoId || !contratoSel) return "Elige proveedor y contrato.";
    }
    if (!contratoSel.partida_id || !capituloSel?.id) return "El contrato no tiene cuenta/capítulo asignado. Corrígelo en Catálogos.";
    if (!folioProveedor.trim()) return "Captura el folio de la factura del proveedor.";
    if (!periodoInicio || !periodoFin) return "Indica el periodo (fecha inicio y fecha fin).";
    if (periodoFin < periodoInicio) return "La fecha fin no puede ser anterior a la fecha inicio.";
    if (Number.isNaN(parseFloat(importe))) return "Captura un importe (total con IVA) válido.";
    return null;
  }

  async function continuar() {
    const err = validarPaso1();
    if (err) { setMensaje(err); return; }
    setMensaje("");
    // Candado: no permitir duplicar folio de proveedor ni OC.
    const { folioDupFolio, ocDupFolio } = await buscarDuplicados();
    setFolioDup(folioDupFolio); setOcDup(ocDupFolio);
    if (folioDupFolio) { setMensaje(`El folio de proveedor "${folioProveedor.trim()}" ya fue capturado en la factura ${folioDupFolio}. No se puede duplicar.`); return; }
    if (ocDupFolio) { setMensaje(`La Orden de Compra "${ordenCompra.trim()}" ya fue capturada en la factura ${ocDupFolio}. No se puede duplicar.`); return; }
    setCargandoServ(true);
    const { data: servs } = await supabase
      .from("contrato_servicios")
      .select("id, nombre_servicio, precio_unitario")
      .eq("contrato_id", contratoId)
      .order("orden", { ascending: true, nullsFirst: false })
      .order("nombre_servicio", { ascending: true });
    setServicios(servs || []);
    setCargandoServ(false);
    setPaso(2);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardarYValidar() {
    setMensaje("");
    const err = validarPaso1();
    if (err) { setMensaje(err); setPaso(1); return; }
    if (!calc.ok) { setMensaje("El subtotal + IVA aún no coincide con el total de la factura. Ajústalo antes de guardar."); return; }
    if (requiereDesglose && !desgloseListo) { setMensaje("Captura el desglose por servicio: es obligatorio en este contrato."); return; }
    // Candado final anti-duplicados (por si algo cambió tras el paso 1).
    const dups = await buscarDuplicados();
    if (dups.folioDupFolio) { setFolioDup(dups.folioDupFolio); setMensaje(`El folio de proveedor "${folioProveedor.trim()}" ya fue capturado en la factura ${dups.folioDupFolio}. No se puede duplicar.`); setPaso(1); return; }
    if (dups.ocDupFolio) { setOcDup(dups.ocDupFolio); setMensaje(`La Orden de Compra "${ordenCompra.trim()}" ya fue capturada en la factura ${dups.ocDupFolio}. No se puede duplicar.`); setPaso(1); return; }

    setCargando(true);
    try {
      // Asegurar sesión válida (refrescar el token) antes de guardar. Si expiró
      // y no se puede refrescar, NO se pierde la captura: queda en el borrador.
      try { await supabase.auth.refreshSession(); } catch { /* sin refresh token */ }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        setMensaje("Tu sesión expiró. Vuelve a iniciar sesión (en otra pestaña) y regresa aquí: tus datos siguen guardados como borrador. Luego presiona «Guardar y validar» otra vez.");
        setCargando(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const authId = userData?.user?.id ?? null;
      let createdBy = null;
      if (authId) {
        const { data: perfil, error: perfilError } = await supabase
          .from("usuarios").select("id").eq("auth_id", authId).maybeSingle();
        if (perfilError) throw perfilError;
        createdBy = perfil?.id ?? null;
      }
      if (!createdBy) {
        setMensaje("Tu usuario no está dado de alta en la tabla 'usuarios'. No se puede registrar la factura.");
        setCargando(false);
        return;
      }

      const sub = Math.round(parseFloat(subtotal) * 100) / 100;
      const ivaAmt = Math.round((parseFloat(iva) || 0) * 100) / 100;
      const total = Math.round((sub + ivaAmt) * 100) / 100;
      const tasa = sub > 0 ? Math.round((ivaAmt / sub) * 10000) / 10000 : 0;
      const ok = Math.abs(total - importeNum) <= TOLERANCIA;

      const anio = new Date(periodoInicio + "T00:00:00").getFullYear();
      const folioIngreso = await generarFolioIngreso(prefijoDe(capituloSel?.nombre), anio);

      const { data: nueva, error } = await supabase
        .from("facturas")
        .insert({
          folio_ingreso: folioIngreso,
          folio_proveedor: folioProveedor,
          capitulo_id: capituloSel.id,
          partida_id: contratoSel.partida_id,
          contrato_id: contratoId,
          proveedor_id: proveedorId,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
          importe_factura: importeNum,
          subtotal_calculado: sub,
          iva_calculado: ivaAmt,
          total_calculado: total,
          tasa_iva: tasa,
          validacion_ok: ok,
          orden_compra: esOC ? ordenCompra.trim() : null,
          estatus_general: "capturada",
          created_by: createdBy,
        })
        .select("id, folio_ingreso")
        .single();

      if (error) { setMensaje("No se pudo guardar la factura: " + error.message); setCargando(false); return; }

      // Persistir el desglose por servicio, para que el jefe pueda verlo en Validación.
      const detalleRows = servicios
        .map((s) => ({ sid: s.id, cant: parseFloat(cantidades[s.id]) }))
        .filter((r) => !Number.isNaN(r.cant) && r.cant > 0)
        .map((r) => ({ factura_id: nueva.id, contrato_servicio_id: r.sid, cantidad: r.cant }));
      let avisoDetalle = "";
      if (detalleRows.length > 0) {
        const { error: eDet } = await supabase.from("factura_detalle").insert(detalleRows);
        if (eDet) {
          avisoDetalle = " (el desglose no se pudo guardar: " + eDet.message + ")";
        } else {
          // Un trigger de factura_detalle recalcula subtotal/IVA/total con base en el
          // desglose; reafirmamos los montos capturados para que manden esos.
          await supabase.from("facturas").update({
            subtotal_calculado: sub, iva_calculado: ivaAmt, total_calculado: total, tasa_iva: tasa, validacion_ok: ok,
          }).eq("id", nueva.id);
        }
      }

      try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
      if (avisoDetalle) setMensaje("Factura guardada" + avisoDetalle);
      setExito({ id: nueva.id, folio: nueva.folio_ingreso, validacion_ok: ok });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err2) {
      setMensaje("Error al generar el folio o guardar: " + err2.message);
    } finally {
      setCargando(false);
    }
  }

  function capturarOtra() {
    setExito(null); setPaso(1);
    setProveedorId(""); setProvText(""); setProvOpen(false); setContratoId("");
    setFolioProveedor(""); setPeriodoInicio(""); setPeriodoFin(""); setImporte("");
    setServicios([]); setCantidades({}); setFiltro(""); setSubtotal(""); setIva("");
    setOrdenCompra(""); setOcDup(""); setFolioDup(""); setMensaje(""); setBorradorAviso(false);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const etiqueta = { fontSize: 12, color: "#5a615e", display: "block", marginTop: 14 };
  const soloLectura = { background: "#f0f2f1", color: "#5a615e" };
  const selectSty = { width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #d8dbd9", marginTop: 4 };
  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "16px 18px", margin: "12px 0" };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "1px solid var(--borde)" };
  const td = { padding: "6px 10px", borderBottom: "1px solid var(--borde)", fontSize: 14 };
  const bigInput = { width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 18, textAlign: "right" };
  const paso1 = paso === 1;

  // ---------------- Pantalla de ÉXITO (folio asignado) ----------------
  if (exito) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", border: "1px solid var(--verde-oscuro)", borderRadius: 12, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>✓</div>
          <h1 style={{ fontSize: 20, margin: "6px 0 2px" }}>Factura guardada y validada</h1>
          <p style={{ fontSize: 14, margin: "10px 0 4px" }}>Se ha asignado el folio de ingreso:</p>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0.5 }}>{exito.folio}</div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="boton" onClick={() => router.push(`/facturas/${exito.id}`)}>Ver factura</button>
          <button className="boton secundario" onClick={capturarOtra}>Capturar otra</button>
          <button className="boton secundario" onClick={() => router.push("/facturas")}>Ir a seguimiento</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: paso1 ? 520 : 720, margin: "0 auto" }}>
      {/* Encabezado con pasos */}
      <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: 0 }}>Paso {paso} de 2</p>
      <h1 style={{ fontSize: 22, margin: "2px 0 4px" }}>{paso1 ? "Captura de factura" : "Validación de la factura"}</h1>

      {borradorAviso && (
        <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", border: "1px solid var(--verde-oscuro)", borderRadius: 8, padding: "8px 12px", fontSize: 13, margin: "6px 0 10px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>💾 Se restauró un <strong>borrador</strong> de una captura sin terminar. Revisa los datos y continúa.</span>
          <button type="button" onClick={capturarOtra} style={{ marginLeft: "auto", background: "none", border: "1px solid var(--verde-oscuro)", color: "var(--verde-oscuro)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>Descartar borrador</button>
        </div>
      )}

      {/* ============ PASO 1 · DATOS ============ */}
      {paso1 && (
        <div style={{ background: "#fff", border: "1px solid #e2e4e2", borderRadius: 12, padding: 24 }}>
          {/* Selector de modo de captura */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {[["contrato", "Por contrato"], ["oc", "Compra emergente (OC)"]].map(([val, txt]) => (
              <button key={val} type="button"
                onClick={() => { if (modo === val) return; setModo(val); setProveedorId(""); setProvText(""); setContratoId(""); setOrdenCompra(""); setMensaje(""); }}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                  border: `1px solid ${modo === val ? "var(--verde)" : "#d8dbd9"}`,
                  background: modo === val ? "var(--verde-claro)" : "#fff",
                  color: modo === val ? "var(--verde-oscuro)" : "#5a615e",
                  fontWeight: modo === val ? 700 : 400 }}>
                {txt}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#5a615e", marginTop: 0 }}>
            {esOC
              ? "Compra por Orden de Compra: elige el proveedor, la cuenta y captura el número de OC. El folio se asigna al final, cuando todo cuadre."
              : "Elige el proveedor y su contrato — el capítulo y la cuenta se completan solos. El folio de ingreso se asigna al final, cuando todo cuadre."}
          </p>

          {/* Proveedor — buscador con sugerencias (typeahead) */}
          <label style={etiqueta}>Proveedor</label>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={provText}
              autoComplete="off"
              onChange={(e) => {
                setProvText(e.target.value);
                setProvOpen(true);
                if (proveedorId) setProveedorId("");
              }}
              onFocus={() => setProvOpen(true)}
              onBlur={() => setTimeout(() => setProvOpen(false), 150)}
              placeholder={cargandoCat ? "Cargando…" : "Escribe para buscar el proveedor…"}
              style={{ ...selectSty }}
            />
            {proveedorId && (
              <button
                type="button"
                onClick={() => { setProveedorId(""); setProvText(""); setProvOpen(false); }}
                title="Limpiar"
                style={{ position: "absolute", right: 8, top: 9, background: "none", border: "none", cursor: "pointer", color: "#5a615e", fontSize: 16, lineHeight: 1 }}
              >×</button>
            )}
            {provOpen && !proveedorId && (() => {
              const q = provText.trim().toLowerCase();
              const lista = (q ? proveedores.filter((p) => (p.razon_social || "").toLowerCase().includes(q)) : proveedores).slice(0, 50);
              return (
                <div style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: "calc(100% + 2px)", background: "#fff", border: "1px solid #d8dbd9", borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,.12)", maxHeight: 260, overflowY: "auto" }}>
                  {lista.length === 0 ? (
                    <div style={{ padding: "10px 12px", fontSize: 13, color: "#5a615e" }}>Sin coincidencias.</div>
                  ) : lista.map((p) => (
                    <div
                      key={p.id}
                      onMouseDown={(e) => { e.preventDefault(); setProveedorId(p.id); setProvText(p.razon_social || ""); setProvOpen(false); }}
                      style={{ padding: "9px 12px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #f0f2f1" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f2f1")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                    >{p.razon_social}</div>
                  ))}
                </div>
              );
            })()}
          </div>

          {esOC ? (
            <>
              {/* Cuenta (partida) de la compra emergente — marco CE- */}
              <label style={etiqueta}>Cuenta (partida) de la compra emergente</label>
              <select required value={contratoId} onChange={(e) => setContratoId(e.target.value)} style={selectSty}>
                <option value="">{contratosCE.length === 0 ? "No hay cuentas de Compra Emergente (corre el SQL)" : "Selecciona la cuenta…"}</option>
                {contratosCE.map((c) => (
                  <option key={c.id} value={c.id}>{[c.partidas?.cuenta_finat, c.partidas?.nombre].filter(Boolean).join(" — ")}</option>
                ))}
              </select>

              {/* Número de Orden de Compra */}
              <label style={etiqueta}>Número de Orden de Compra (OC)</label>
              <input type="text" value={ordenCompra}
                onChange={(e) => { setOrdenCompra(e.target.value); if (ocDup) setOcDup(""); }}
                onBlur={revisarOcDup}
                placeholder="Ej. OC-2026-0123"
                style={ocDup ? { borderColor: "var(--rojo)" } : undefined} />
              {ocDup && <div style={{ fontSize: 12, color: "var(--rojo)", marginTop: 4 }}>🔒 Esta OC ya fue capturada en la factura <strong>{ocDup}</strong>. No se puede duplicar.</div>}
            </>
          ) : (
            <>
              {/* Contrato (de ese proveedor) */}
              <label style={etiqueta}>Contrato</label>
              <select required value={contratoId} onChange={(e) => setContratoId(e.target.value)} disabled={!proveedorId} style={selectSty}>
                <option value="">{!proveedorId ? "Primero elige un proveedor" : contratosProv.length === 0 ? "Este proveedor no tiene contratos" : "Selecciona un contrato…"}</option>
                {contratosProv.map((c) => (
                  <option key={c.id} value={c.id}>{[c.numero_interno, c.adquisicion_servicio].filter(Boolean).join(" — ")}</option>
                ))}
              </select>
              {proveedorId && contratosProv.length === 1 && <div style={{ fontSize: 11, color: "#5a615e", marginTop: 4 }}>Único contrato de este proveedor (ya seleccionado).</div>}
            </>
          )}

          {/* Capítulo y cuenta — autocompletados (solo lectura) */}
          <label style={etiqueta}>Capítulo y cuenta (automáticos)</label>
          <input type="text" readOnly style={soloLectura}
            value={contratoSel ? [capituloSel?.nombre, cuentaSel && `Cuenta ${cuentaSel}`, contratoSel?.partidas?.nombre].filter(Boolean).join(" · ") : ""}
            placeholder={esOC ? "Se completa al elegir la cuenta" : "Se completa al elegir el contrato"} />

          {/* Folio proveedor */}
          <label style={etiqueta}>Folio de factura del proveedor</label>
          <input type="text" value={folioProveedor}
            onChange={(e) => { setFolioProveedor(e.target.value); if (folioDup) setFolioDup(""); }}
            onBlur={revisarFolioDup}
            style={folioDup ? { borderColor: "var(--rojo)" } : undefined} />
          {folioDup && <div style={{ fontSize: 12, color: "var(--rojo)", marginTop: 4 }}>🔒 Este folio de proveedor ya fue capturado en la factura <strong>{folioDup}</strong>. No se puede duplicar.</div>}

          {/* Periodo */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={etiqueta}>Periodo — inicio</label>
              <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={etiqueta}>Periodo — fin</label>
              <input type="date" value={periodoFin} onChange={(e) => setPeriodoFin(e.target.value)} />
            </div>
          </div>

          {/* Importe */}
          <label style={etiqueta}>Importe de la factura (total con IVA)</label>
          <input type="number" step="0.01" min="0" value={importe} onChange={(e) => setImporte(e.target.value)} />

          <div style={{ height: 22 }} />
          <button type="button" onClick={continuar} disabled={cargandoServ} className="boton" style={{ width: "100%" }}>
            {cargandoServ ? "Cargando…" : "Continuar →"}
          </button>
        </div>
      )}

      {/* ============ PASO 2 · VALIDACIÓN ============ */}
      {!paso1 && (
        <>
          {/* Resumen de datos del paso 1 */}
          <div style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
            <div><strong>Proveedor:</strong> {proveedores.find((p) => p.id === proveedorId)?.razon_social || "—"}</div>
            <div><strong>Folio proveedor:</strong> {folioProveedor}</div>
            {esOC && <div style={{ gridColumn: "1 / -1" }}><strong>Orden de Compra:</strong> {ordenCompra || "—"}</div>}
            <div style={{ gridColumn: "1 / -1" }}><strong>{esOC ? "Compra emergente:" : "Contrato:"}</strong> {contratoSel?.numero_interno} — {contratoSel?.adquisicion_servicio}</div>
            <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "var(--texto-suave)" }}>{[capituloSel?.nombre, cuentaSel && `Cuenta ${cuentaSel}`].filter(Boolean).join(" · ")}</div>
            <div style={{ gridColumn: "1 / -1", marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--borde)" }}>
              <strong>Total de la factura (capturado):</strong>{" "}
              <span style={{ fontSize: 18, fontWeight: 700 }}>{money(importeNum)}</span>{" "}
              <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>(con IVA)</span>
            </div>
          </div>

          {/* Captura de subtotal + IVA + validación */}
          <div style={card}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Captura el SUBTOTAL y el IVA tal como vienen en la factura
            </label>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 12, color: "var(--texto-suave)" }}>Subtotal (antes de IVA)</label>
                <input type="number" step="0.01" min="0" value={subtotal} placeholder="0.00"
                  onChange={(e) => setSubtotal(e.target.value)} style={bigInput} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 12, color: "var(--texto-suave)" }}>IVA (monto)</label>
                <input type="number" step="0.01" min="0" value={iva} placeholder="0.00"
                  onChange={(e) => setIva(e.target.value)} style={bigInput} />
              </div>
            </div>
            {/* Botones rápidos para llenar el IVA */}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="boton secundario" style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => { const s = parseFloat(subtotal) || 0; setIva(String(Math.round(s * 0.16 * 100) / 100)); }}>IVA 16%</button>
              <button type="button" className="boton secundario" style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => setIva("0")}>Sin IVA (0%)</button>
              <button type="button" className="boton secundario" style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => { const s = parseFloat(subtotal) || 0; setIva(String(Math.round((importeNum - s) * 100) / 100)); }}>
                Ajustar al total (IVA = total − subtotal)</button>
            </div>

            {/* Cálculo en vivo */}
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 4, fontSize: 14, maxWidth: 400, marginLeft: "auto" }}>
              <span style={{ color: "var(--texto-suave)" }}>Subtotal</span>
              <span style={{ textAlign: "right" }}>{money(calc.sub)}</span>
              <span style={{ color: "var(--texto-suave)" }}>IVA{calc.sub > 0 ? ` (≈${(calc.tasaImplicita * 100).toFixed(1)}%)` : ""}</span>
              <span style={{ textAlign: "right" }}>{money(calc.iva)}</span>
              <span style={{ fontWeight: 700 }}>Total calculado</span>
              <span style={{ textAlign: "right", fontWeight: 700 }}>{money(calc.total)}</span>
              <span style={{ color: "var(--texto-suave)" }}>Total de la factura</span>
              <span style={{ textAlign: "right" }}>{money(calc.totalFactura)}</span>
            </div>

            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, fontSize: 13,
              background: calc.ok ? "var(--verde-claro)" : "var(--rojo-claro)",
              color: calc.ok ? "var(--verde-oscuro)" : "var(--rojo)", maxWidth: 400, marginLeft: "auto" }}>
              {calc.sub <= 0
                ? "Captura el subtotal (y el IVA) para validar."
                : calc.ok
                  ? `✓ Cuadra: subtotal + IVA = ${money(calc.total)} (diferencia ${money(calc.diferencia)}).`
                  : `✗ No cuadra por ${money(calc.diferencia)}. Si es redondeo del CFDI, usa "Ajustar al total".`}
            </div>
          </div>

          {/* Desglose de servicios (OPCIONAL) — ayuda a calcular el subtotal */}
          {servicios.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ fontSize: 15, margin: 0 }}>Desglose por servicio <span style={{ fontSize: 12, color: "var(--rojo)", fontWeight: 700 }}>(obligatorio)</span></h2>
                <div style={{ fontSize: 13 }}>
                  Suma del desglose: <strong>{money(sumaServicios)}</strong>{" "}
                  {sumaServicios > 0 && (
                    <button type="button" className="boton secundario" style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => {
                        if (desglose.sinIva && !desglose.conIva) {
                          const sub = Math.round(sumaServicios * 100) / 100;
                          setSubtotal(String(sub));
                          setIva(String(Math.round((importeNum - sub) * 100) / 100));
                        } else {
                          const sub = Math.round((sumaServicios / 1.16) * 100) / 100;
                          setSubtotal(String(sub));
                          setIva(String(Math.round((sumaServicios - sub) * 100) / 100));
                        }
                      }}>
                      Usar desglose para llenar subtotal + IVA
                    </button>
                  )}
                </div>
              </div>
              {sumaServicios > 0 && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 13,
                  background: desglose.ok ? "var(--verde-claro)" : "var(--rojo-claro)",
                  color: desglose.ok ? "var(--verde-oscuro)" : "var(--rojo)" }}>
                  {desglose.conIva
                    ? `✓ La suma del desglose (${money(sumaServicios)}) coincide con el TOTAL de la factura (precios con IVA).`
                    : desglose.sinIva
                      ? `✓ La suma del desglose (${money(sumaServicios)}) coincide con el SUBTOTAL — los precios de este contrato son sin IVA; con IVA (×1.16) = ${money(sumaServicios * 1.16)} = el TOTAL de la factura.`
                      : `✗ La suma del desglose (${money(sumaServicios)}) no cuadra: ni con el TOTAL (dif. ${money(sumaServicios - desglose.total)}) ni como SUBTOTAL + IVA (dif. ${money(sumaServicios * 1.16 - desglose.total)}).`}
                </div>
              )}
              <input type="text" placeholder="Buscar servicio…" value={filtro} onChange={(e) => setFiltro(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--borde)", margin: "8px 0" }} />
              <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={th}>Servicio</th>
                      <th style={{ ...th, textAlign: "right" }}>Precio</th>
                      <th style={{ ...th, textAlign: "right", width: 100 }}>Cantidad</th>
                      <th style={{ ...th, textAlign: "right" }}>Importe</th>
                    </tr></thead>
                    <tbody>
                      {serviciosFiltrados.map((s) => {
                        const cant = parseFloat(cantidades[s.id]);
                        const imp = !Number.isNaN(cant) && cant > 0 ? cant * Number(s.precio_unitario) : 0;
                        return (
                          <tr key={s.id}>
                            <td style={td}>{s.nombre_servicio}</td>
                            <td style={{ ...td, textAlign: "right" }}>{money(s.precio_unitario)}</td>
                            <td style={{ ...td, textAlign: "right" }}>
                              <input type="number" min="0" step="0.01" value={cantidades[s.id] ?? ""}
                                onChange={(e) => setCantidades((p) => ({ ...p, [s.id]: e.target.value }))}
                                style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--borde)", textAlign: "right" }} />
                            </td>
                            <td style={{ ...td, textAlign: "right" }}>{money(imp)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 6 }}>
                El desglose se da por bueno si la suma cuadra con el <strong>TOTAL</strong> (contratos con precios que ya incluyen IVA) o con el <strong>SUBTOTAL</strong> (contratos con precios sin IVA; la suma × 1.16 = el total). El botón llena el subtotal y el IVA según el caso.
              </p>
            </div>
          )}

          {/* Acciones del paso 2 */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button type="button" className="boton" onClick={guardarYValidar} disabled={cargando || !calc.ok || (requiereDesglose && !desgloseListo)}>
              {cargando ? "Guardando…" : "Guardar y validar"}
            </button>
            <button type="button" className="boton secundario" onClick={() => { setPaso(1); setMensaje(""); }} disabled={cargando}>← Corregir datos</button>
          </div>
          {(!calc.ok || (requiereDesglose && !desgloseListo)) && (
            <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>
              Para guardar y asignar el folio: el <strong>subtotal + IVA</strong> debe coincidir con el total{requiereDesglose ? <> y debes <strong>capturar el desglose por servicio</strong> (obligatorio en este contrato)</> : ""}.
            </p>
          )}
        </>
      )}

      {mensaje && (<p style={{ fontSize: 12, color: "var(--rojo)", marginTop: 16 }}>{mensaje}</p>)}
    </div>
  );
}
