// Traslado de pacientes (9/11/2026) · Folios TP del SCACE "Gastos TP por Unidad" → devengo, avance para correo e informes.
// Reglas de Gabriel:
//   · El contrato y el mes de cada folio se toman de la FECHA DEL VIAJE ("Fecha y Hora de Cita"), NUNCA de cuándo
//     se generó el folio. S6M0022 ene–feb · S6M0030 1/03–23/10 · S6M0112 24/10–31/12 (cuenta 52411011).
//   · Fondo fijo (Estado TP "En relación de gastos" o con importe pagado) no es gasto del contrato.
//   · Autobuses factura por PERIODO y DESTINO (no por folio): un folio queda facturado cuando una factura del mismo
//     contrato, con su detalle de viajes capturado, cubre la fecha del viaje. Las facturas sin detalle (p. ej. las de
//     otra unidad que pagó el HGZ 2: 40264, 41097) no cubren folios.
//   · Mismo paciente el mismo día con dos o más folios = posible repetido. SÍ cuenta (con sep–oct se vio que unos se
//     cobraron y otros no), pero se marca para revisarlo en la carga y en los informes.
// No se guardan NSS ni nombres: del paciente queda una huella (SHA-256 recortado) para detectar repetidos.
import { supabase } from "./supabaseClient";
import { leerTodo } from "./paginar";

export const CUENTA_TRASLADOS = "52411011";
const N = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const num = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[$,\s]/g, "")) || 0);
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const CIUDADES = ["LEON", "GUADALAJARA", "CDMX", "MONTERREY", "SAN LUIS POTOSI", "OTRA"];
export const NOMBRE_CIUDAD = { LEON: "León", GUADALAJARA: "Guadalajara", CDMX: "Ciudad de México", MONTERREY: "Monterrey", "SAN LUIS POTOSI": "San Luis Potosí", OTRA: "Otra" };

// Ciudad destino por el nombre de la unidad receptora del SCACE
export function ciudadDe(unidad) {
  const u = N(unidad);
  if (/LEON|HGP ?48|NO\.? ?48/.test(u)) return "LEON";
  if (/GDL|GUADALAJARA|OCCIDENTE|OBLATOS/.test(u)) return "GUADALAJARA";
  if (/MEX|RAZA|SIGLO|SALINAS|CDMX/.test(u)) return "CDMX";
  if (/MONTERREY|MTY|NUEVO LEON/.test(u)) return "MONTERREY";
  if (/SAN LUIS|SLP/.test(u)) return "SAN LUIS POTOSI";
  return "OTRA";
}
// Ciudad de un concepto del contrato ("AGUASCALIENTES LEÓN, GTO AGUASCALIENTES 8340")
export function ciudadServicio(nombre) {
  const s = N(nombre);
  if (s.includes("LEON")) return "LEON";
  if (s.includes("GUADALAJARA")) return "GUADALAJARA";
  if (s.includes("MEXICO")) return "CDMX";
  if (s.includes("MONTERREY")) return "MONTERREY";
  if (s.includes("SAN LUIS")) return "SAN LUIS POTOSI";
  return "OTRA";
}

// ---------- Lectura del Excel del SCACE ----------
export function esSCACE(grid) { return /GASTOS TP POR UNIDAD/.test(N(grid?.[0]?.[0])); }
// El Excel del SCACE trae mal su rango (dice A1:G… aunque llega hasta la columna Q): se recalcula con las celdas reales
export function gridSCACE(XLSX, ws) {
  let maxR = 0, maxC = 0;
  for (const k of Object.keys(ws)) {
    if (k[0] === "!") continue;
    const a = XLSX.utils.decode_cell(k); if (a.r > maxR) maxR = a.r; if (a.c > maxC) maxC = a.c;
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
}

// "2026-10-01 9:00", "01/10/2026 09:00" o número de serie de Excel → { fecha, hora }
function fechaHora(v) {
  if (typeof v === "number" && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return { fecha: d.toISOString().slice(0, 10), hora: d.toISOString().slice(11, 16) };
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}:\d{2}))?/); if (m) return { fecha: `${m[1]}-${m[2]}-${m[3]}`, hora: m[4] || null };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}))?/); if (m) return { fecha: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, hora: m[4] || null };
  return { fecha: null, hora: null };
}
async function huella(nss, agregado) {
  const t = `${String(nss ?? "").replace(/\D/g, "")}|${N(agregado)}`;
  if (t === "|") return null;
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// grid = renglones de la primera hoja (sheet_to_json header:1). Devuelve los folios SIN NSS ni nombres.
export async function leerSCACE(grid, archivo) {
  const titulo = String(grid[0]?.[0] || "");
  const unidad = titulo.split(":").slice(1).join(":").trim();
  const periodo = grid[0].map(String).join(" ").match(/(\d{4}-\d{2}-\d{2})\s*al\s*(\d{4}-\d{2}-\d{2})/);
  const hr = grid.findIndex((r) => N(r[0]) === "FOLIO TP");
  if (hr < 0) return { error: "No encontré el encabezado \"Folio TP\"." };
  const H = grid[hr].map(N);
  const col = (re) => H.findIndex((h) => re.test(h));
  const c = { folio: 0, tipo: col(/^TIPO FOLIO/), uni: col(/^UNIDAD RECEPTORA/), esp: col(/^ESPECIALIDAD/), cita: col(/^FECHA Y HORA DE CITA/),
    tcita: col(/^TIPO CITA/), nss: col(/^NSS/), agr: col(/^AGREGADO/), aco: col(/^ACOMPA/), tra: col(/^TRANSPORTE/), mot: col(/^MOTIVO AJUSTE/),
    fpago: col(/^FECHA DE PAGO/), emi: col(/^IMPORTE EMITIDO/), pag: col(/^IMPORTE PAGADO/), est: col(/^ESTADO TP/) };
  if (c.cita < 0 || c.emi < 0) return { error: "Faltan columnas del SCACE (Fecha y Hora de Cita / Importe Emitido)." };
  const filas = [];
  for (let r = hr + 1; r < grid.length; r++) {
    const x = grid[r];
    let folio = String(x[c.folio] ?? "").trim();
    if (!folio || !/^\d+$/.test(folio)) continue;
    if (folio.length < 11) folio = folio.padStart(11, "0"); // el Excel pudo quitar el 0 inicial
    const { fecha, hora } = fechaHora(x[c.cita]);
    if (!fecha) continue;
    const estado = String(x[c.est] ?? "").trim(), pagado = num(x[c.pag]), fp = c.fpago >= 0 ? fechaHora(x[c.fpago]).fecha : null;
    const unidadR = String(x[c.uni] ?? "").trim();
    filas.push({
      folio, tipo_folio: String(x[c.tipo] ?? "").trim() || null, unidad_receptora: unidadR, ciudad: ciudadDe(unidadR),
      especialidad: String(x[c.esp] ?? "").trim() || null, fecha_viaje: fecha, hora_viaje: hora, tipo_cita: String(x[c.tcita] ?? "").trim() || null,
      transporte: String(x[c.tra] ?? "").trim() || null, con_acompanante: c.aco >= 0 && !!String(x[c.aco] ?? "").trim(),
      importe_emitido: r2(num(x[c.emi])), importe_pagado: r2(pagado), fecha_pago: fp, estado_tp: estado || null,
      motivo_ajuste: c.mot >= 0 ? String(x[c.mot] ?? "").trim() || null : null,
      fondo_fijo: /RELACION DE GASTOS/.test(N(estado)) || pagado > 0 || !!fp,
      paciente_huella: c.nss >= 0 ? await huella(x[c.nss], c.agr >= 0 ? x[c.agr] : "") : null,
      archivo,
    });
  }
  return { unidad, desde: periodo?.[1] || null, hasta: periodo?.[2] || null, filas };
}

// ---------- Datos de SIGAF y clasificación ----------
// Contratos de traslados: cuenta 52411011 con destinos capturados (S6M0022, S6M0030, S6M0112…)
export async function cargarTraslados({ conFolios = true } = {}) {
  const rC = await leerTodo((d, h) => supabase.from("contratos")
    .select("id, numero_interno, numero_alterno, vigencia_inicio, vigencia_fin, monto_maximo, tasa_iva, proveedor_id, partidas!inner ( cuenta_finat ), contrato_servicios ( id, nombre_servicio, precio_unitario )")
    .eq("partidas.cuenta_finat", CUENTA_TRASLADOS).order("vigencia_inicio").range(d, h));
  if (rC.error) throw new Error(rC.error.message);
  const contratos = (rC.data || []).filter((c) => c.vigencia_inicio && c.vigencia_fin && (c.contrato_servicios || []).length);
  const ids = contratos.map((c) => c.id);
  let facturas = [], detalle = [], folios = [];
  if (ids.length) {
    const rF = await leerTodo((d, h) => supabase.from("facturas")
      .select("id, contrato_id, folio_ingreso, folio_proveedor, periodo_inicio, periodo_fin, importe_factura, estatus_general, fecha_pago, cr_contrarecibo, mes_presupuestal, anio_presupuestal")
      .in("contrato_id", ids).eq("anulada", false).neq("estatus_general", "devuelta_proveedor").order("id").range(d, h));
    if (rF.error) throw new Error(rF.error.message);
    facturas = rF.data || [];
    const fids = facturas.map((f) => f.id);
    for (let i = 0; i < fids.length; i += 150) {
      const r = await supabase.from("factura_detalle").select("factura_id, contrato_servicio_id, cantidad, importe_calculado").in("factura_id", fids.slice(i, i + 150));
      if (r.error) throw new Error(r.error.message);
      detalle.push(...(r.data || []));
    }
  }
  if (conFolios) {
    const rT = await leerTodo((d, h) => supabase.from("traslados_folios").select("*").order("folio").range(d, h));
    if (rT.error) throw new Error(rT.error.message + " (¿ya se corrió la migración 060?)");
    folios = rT.data || [];
  }
  return { contratos, facturas, detalle, folios };
}

// Contrato vigente el día del viaje (si se enciman, el más nuevo)
export function contratoDelDia(contratos, fecha) {
  const v = contratos.filter((c) => c.vigencia_inicio <= fecha && fecha <= c.vigencia_fin);
  return v.sort((a, b) => b.vigencia_inicio.localeCompare(a.vigencia_inicio))[0] || null;
}
// Precio con IVA de la ciudad en ese contrato
function tarifa(c, ciudad) {
  const s = (c?.contrato_servicios || []).find((x) => ciudadServicio(x.nombre_servicio) === ciudad);
  if (!s) return null;
  const iva = c.tasa_iva == null ? 0.16 : Number(c.tasa_iva) > 1 ? Number(c.tasa_iva) / 100 : Number(c.tasa_iva);
  return { servicioId: s.id, precio: Number(s.precio_unitario), conIva: Number(s.precio_unitario) * (1 + iva) };
}

// Clasifica cada folio. estado: devengo | facturado | pagado | fondo_fijo | sin_importe | otro_transporte | sin_contrato
// (repetido = marca aparte, no estado)
export function clasificar({ contratos, facturas, detalle, folios }) {
  const conDetalle = new Set(detalle.map((d) => d.factura_id));
  const facPor = {}; for (const f of facturas) if (conDetalle.has(f.id) && f.periodo_inicio && f.periodo_fin) (facPor[f.contrato_id] ||= []).push(f);
  const cPor = new Map(contratos.map((c) => [c.id, c]));
  const base = folios.map((f) => {
    const c = contratoDelDia(contratos, f.fecha_viaje) || cPor.get(f.contrato_id) || null;
    const t = c ? tarifa(c, f.ciudad) : null;
    const boletos = t && t.conIva > 0 ? Math.round((Number(f.importe_emitido) / t.conIva) * 2) / 2 : null;
    const valor = boletos != null && t ? r2(boletos * t.conIva) : Number(f.importe_emitido) || 0;
    const contratado = N(f.transporte).includes("CONTRATADO");
    return { ...f, contrato: c, contrato_id: c?.id || null, boletos, valor, servicioId: t?.servicioId || null, mes: Number(f.fecha_viaje.slice(5, 7)), anio: Number(f.fecha_viaje.slice(0, 4)),
      acompanante: f.con_acompanante || (boletos != null && boletos > 1), boletosAcomp: boletos != null && boletos > 1 ? boletos - 1 : 0, contratado };
  });
  // Posibles repetidos: misma huella el mismo día (solo los que contarían); el primer folio no se marca
  const vistos = new Set();
  for (const f of base.slice().sort((a, b) => a.folio.localeCompare(b.folio))) {
    if (!f.contratado || f.fondo_fijo || !(Number(f.importe_emitido) > 0) || !f.paciente_huella) continue;
    const k = `${f.paciente_huella}|${f.fecha_viaje}`;
    if (vistos.has(k)) f.repetido = true; else vistos.add(k);
  }
  for (const f of base) {
    if (!f.contratado) f.estado = "otro_transporte";
    else if (f.fondo_fijo) f.estado = "fondo_fijo";
    else if (!(Number(f.importe_emitido) > 0)) f.estado = "sin_importe";
    else if (!f.contrato_id) f.estado = "sin_contrato";
    else {
      const fac = (facPor[f.contrato_id] || []).find((x) => x.periodo_inicio <= f.fecha_viaje && f.fecha_viaje <= x.periodo_fin);
      f.factura = fac || null;
      f.estado = !fac ? "devengo" : fac.estatus_general === "gasto_reflejado" ? "pagado" : "facturado";
    }
  }
  return base;
}
export const CUENTAN = new Set(["devengo", "facturado", "pagado"]); // viajes del contrato (sin fondo fijo ni cancelados)
export const ETIQUETA_ESTADO = { devengo: "Devengo (sin factura)", facturado: "Facturado", pagado: "Pagado", fondo_fijo: "Fondo fijo", sin_importe: "Sin importe", otro_transporte: "Ambulancia / otro", sin_contrato: "Sin contrato" };

// Devengo por contrato y mes del viaje: { contrato_id: Array(13) }
export function devengoPorContrato(clasificados, anio) {
  const out = {};
  for (const f of clasificados) {
    if (!f.contrato_id) continue;
    const dv = (out[f.contrato_id] ||= Array(13).fill(0));
    if (f.estado === "devengo" && f.anio === anio) dv[f.mes] = r2(dv[f.mes] + f.valor);
  }
  return out;
}

// SCACE contra factura: por factura con detalle y ciudad, boletos emitidos vs facturados
export function scaceContraFacturas({ contratos, facturas, detalle }, clasificados, { desde = "", hasta = "" } = {}) {
  const servCiudad = {}; for (const c of contratos) for (const s of c.contrato_servicios || []) servCiudad[s.id] = { ciudad: ciudadServicio(s.nombre_servicio), precio: Number(s.precio_unitario), c };
  const detPor = {}; for (const d of detalle) (detPor[d.factura_id] ||= []).push(d);
  const filas = [];
  for (const f of facturas) {
    if (!detPor[f.id] || !f.periodo_inicio || !f.periodo_fin) continue;
    if (desde && f.periodo_fin < desde) continue;
    if (hasta && f.periodo_inicio > hasta) continue;
    const c = contratos.find((x) => x.id === f.contrato_id);
    const fact = {}, precio = {};
    for (const d of detPor[f.id]) { const s = servCiudad[d.contrato_servicio_id]; if (!s) continue; fact[s.ciudad] = (fact[s.ciudad] || 0) + Number(d.cantidad || 0); precio[s.ciudad] = s.precio; }
    const emit = {}, rep = {};
    for (const x of clasificados) {
      if (x.contrato_id !== f.contrato_id || x.fecha_viaje < f.periodo_inicio || x.fecha_viaje > f.periodo_fin) continue;
      if (x.factura?.id !== f.id) continue;
      emit[x.ciudad] = (emit[x.ciudad] || 0) + (x.boletos || 0);
      if (x.repetido) rep[x.ciudad] = (rep[x.ciudad] || 0) + (x.boletos || 0);
    }
    for (const ciudad of CIUDADES) {
      const e = emit[ciudad] || 0, k = fact[ciudad] || 0;
      if (!e && !k) continue;
      const dif = Math.round((e - k) * 10) / 10;
      const p = precio[ciudad] ?? (c?.contrato_servicios || []).map((s) => ({ s, ci: ciudadServicio(s.nombre_servicio) })).find((z) => z.ci === ciudad)?.s.precio_unitario ?? 0;
      filas.push({ factura: f, contrato: c?.numero_interno, ciudad, emitidos: e, facturados: k, repetidos: rep[ciudad] || 0, diferencia: dif, importeDif: r2(dif * Number(p) * 1.16),
        lectura: Math.abs(dif) < 0.05 ? "Cuadra" : dif > 0 ? "Emitidos sin cobrar (posible no viajó)" : "Cobrado de más que lo emitido: aclarar" });
    }
  }
  return filas;
}

// ---------- Guardar ----------
export async function guardarTraslados(filas, contratos, onAvance = () => {}) {
  const items = filas.map((f) => ({ ...f, contrato_id: contratoDelDia(contratos, f.fecha_viaje)?.id || null, actualizado_at: new Date().toISOString() }));
  let hechos = 0;
  for (let i = 0; i < items.length; i += 500) {
    const { error } = await supabase.from("traslados_folios").upsert(items.slice(i, i + 500), { onConflict: "folio" });
    if (error) throw new Error("Folios de traslados: " + error.message + " (¿ya se corrió la migración 060?)");
    hechos += Math.min(500, items.length - i); onAvance(`Guardando folios de traslados… ${hechos} de ${items.length}`);
  }
  return hechos;
}

// Resumen para la revisión de la carga (antes de guardar): junta lo nuevo con lo ya guardado
export function resumenCarga(datos, filasNuevas) {
  const porFolio = new Map(datos.folios.map((f) => [f.folio, f]));
  let nuevos = 0, actualizados = 0;
  for (const f of filasNuevas) { if (porFolio.has(f.folio)) actualizados++; else nuevos++; porFolio.set(f.folio, { ...(porFolio.get(f.folio) || {}), ...f }); }
  const todos = clasificar({ ...datos, folios: [...porFolio.values()] });
  const nuevosSet = new Set(filasNuevas.map((f) => f.folio));
  const delArchivo = todos.filter((f) => nuevosSet.has(f.folio));
  const porEstado = {}; for (const f of delArchivo) { const e = (porEstado[f.estado] ||= { n: 0, imp: 0 }); e.n++; e.imp = r2(e.imp + (CUENTAN.has(f.estado) ? f.valor : Number(f.importe_emitido) || 0)); }
  const devengo = {}; for (const f of todos) if (f.estado === "devengo") { const k = f.contrato?.numero_interno || "—"; devengo[k] = r2((devengo[k] || 0) + f.valor); }
  const rep = delArchivo.filter((f) => f.repetido);
  const fechas = delArchivo.map((f) => f.fecha_viaje).sort();
  return { nuevos, actualizados, porEstado, devengo, repetidos: { n: rep.length, imp: r2(rep.reduce((s, f) => s + f.valor, 0)) }, desde: fechas[0] || null, hasta: fechas[fechas.length - 1] || null };
}
