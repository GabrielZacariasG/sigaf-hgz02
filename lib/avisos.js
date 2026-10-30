// Bandeja de avisos (30/10/2026): semáforo de dictamen por factura + avisos de acción.
//
// Semáforo de dictamen (por contrato, en fila): toma lo disponible del HGZ 2 en el dictamen (FINAT IMKK036),
// suma lo que FINAT ya ejerció y SIGAF no marca como pagado, y lo va repartiendo entre las facturas sin pagar
// del contrato en el orden en que van a pedir dinero (primero las que ya están en OOAD, luego las que van llegando).
//   · verde  : hay dinero en el dictamen
//   · ámbar  : no alcanza, pero otra unidad del mismo dictamen tiene saldo → oficio de apoyo
//   · rojo   : no alcanza ni con otras unidades → ampliación de dictamen
//   · validada: su CR ya está validado en FINAT (V)
//   · gris   : contrato sin dictamen cargado (PREI, falta IMKK036 o pasivo sin ligar)
// Un CR en E (error de presupuesto) se avisa aparte aunque el dinero ya alcance (hay que pedir revalidación).
import { supabase } from "./supabaseClient";
import { leerTodo } from "./paginar";
import { ANIO, UI_HGZ2 } from "./contratos";
import { generaPedidoRecepcion, puedeEnviarOoad } from "./estatus";

const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
const ORDEN = { en_tramite_ooad: 0, enviada_ooad: 1, en_revision: 2, capturada: 3 };

export async function cargarAvisos() {
  const [rF, rC, rS, rH, rL] = await Promise.all([
    leerTodo((d, h) => supabase.from("facturas").select(SELECT_F)
      .eq("anulada", false).neq("estatus_general", "devuelta_proveedor").order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("contratos").select("id, numero_interno, dictamen_numero, proveedores ( razon_social )").order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("dictamen_saldos").select("dictamen, ui, pagos, disponible").order("dictamen").order("ui").order("anio").order("mes").range(d, h)),
    leerTodo((d, h) => supabase.from("factura_estatus_historial").select("factura_id, fecha").eq("circuito", "pedido_recepcion").eq("estatus", "generado").order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("contrato_dictamenes").select("contrato_id, dictamen, tipo").order("contrato_id").range(d, h)),
  ]);
  const err = [rF, rC].find((r) => r.error);
  if (err) throw new Error(err.error.message);
  const facturas = rF.data || [];
  const sinPagar = facturas.filter((f) => f.estatus_general !== "gasto_reflejado");
  // Estado presupuestal de los CR (1043): E si alguna línea cayó en error · V si todas validadas · N lo demás
  const ppto = await estadosPpto([...new Set(sinPagar.map((f) => f.cr_contrarecibo).filter(Boolean))]);
  const saldos = {}; for (const s of rS.error ? [] : rS.data || []) (saldos[s.dictamen] ||= []).push(s);
  const prFecha = {}; for (const h of rH.error ? [] : rH.data || []) if (!prFecha[h.factura_id] || h.fecha > prFecha[h.factura_id]) prFecha[h.factura_id] = h.fecha;
  return calcularAvisos({ facturas, contratos: rC.data || [], saldos, ppto, prFecha, links: ligas(rL) });
}

// contrato_dictamenes → { contrato_id: [{ dictamen, tipo }] } (vacío si aún no se corre la 050)
function ligas(r) { const m = {}; for (const l of r?.error ? [] : r?.data || []) (m[l.contrato_id] ||= []).push(l); return m; }

// ---------- Un solo contrato (captura y detalle de factura) ----------
const SELECT_F = "id, contrato_id, folio_ingreso, folio_proveedor, importe_factura, es_pasivo, estatus_general, estatus_firmas, estatus_pedido_recepcion, numero_pedido, numero_recepcion, cr_contrarecibo, fecha_factura, proveedores ( razon_social ), capitulos ( nombre ), partidas ( cuenta_finat, cuenta_prei )";
async function estadosPpto(crs) {
  const lineas = {};
  for (let i = 0; i < crs.length; i += 150) {
    const { data, error } = await supabase.from("comprobantes_ooad").select("cbte, estado_ppto, estado_entrada").in("cbte", crs.slice(i, i + 150));
    if (error) break;
    for (const r of data || []) if (r.estado_entrada !== "X") (lineas[r.cbte] ||= []).push((r.estado_ppto || "N").toUpperCase());
  }
  const ppto = {};
  for (const [cr, es] of Object.entries(lineas)) ppto[cr] = es.includes("E") ? "E" : es.every((e) => e === "V") ? "V" : "N";
  return ppto;
}

// Lee lo necesario para el semáforo de un contrato. Devuelve null si no hay contrato.
export async function cargarContrato(contratoId) {
  if (!contratoId) return null;
  const [rC, rF] = await Promise.all([
    supabase.from("contratos").select("id, numero_interno, dictamen_numero, proveedores ( razon_social )").eq("id", contratoId).maybeSingle(),
    leerTodo((d, h) => supabase.from("facturas").select(SELECT_F).eq("contrato_id", contratoId).eq("anulada", false).neq("estatus_general", "devuelta_proveedor").order("id").range(d, h)),
  ]);
  if (rC.error || !rC.data) return null;
  const c = rC.data, facturas = rF.data || [];
  const rL = await supabase.from("contrato_dictamenes").select("contrato_id, dictamen, tipo").eq("contrato_id", contratoId);
  const links = ligas(rL);
  const dics = [...new Set([c.dictamen_numero, ...(links[c.id] || []).map((l) => l.dictamen)].filter(Boolean))];
  const saldos = {};
  if (dics.length) {
    const rS = await supabase.from("dictamen_saldos").select("dictamen, ui, pagos, disponible").in("dictamen", dics);
    if (!rS.error) for (const x of rS.data || []) (saldos[x.dictamen] ||= []).push(x);
  }
  const ppto = await estadosPpto([...new Set(facturas.filter((f) => f.estatus_general !== "gasto_reflejado").map((f) => f.cr_contrarecibo).filter(Boolean))]);
  return { contrato: c, facturas, saldos, ppto, links };
}

// Semáforo de un contrato ya cargado; "nueva" = factura que se está capturando ({ importe, fecha }).
export const ID_NUEVA = "__nueva__";
export function semaforoDe(datos, nueva = null) {
  if (!datos) return null;
  const facturas = nueva && Number(nueva.importe) > 0
    ? [...datos.facturas, { id: ID_NUEVA, contrato_id: datos.contrato.id, folio_ingreso: "(nueva)", importe_factura: Number(nueva.importe), estatus_general: "capturada", fecha_factura: nueva.fecha || new Date().toISOString().slice(0, 10) }]
    : datos.facturas;
  const r = calcularAvisos({ facturas, contratos: [datos.contrato], saldos: datos.saldos, ppto: datos.ppto, links: datos.links });
  // Por dictamen: disponible del HGZ 2 y resumen (un contrato 2025 puede tener su dictamen de pasivo aparte)
  const disponibleDe = (dic) => { const sal = (dic && datos.saldos[dic]) || []; return sal.length ? r2(sal.filter((s) => s.ui === UI_HGZ2).reduce((t, s) => t + num(s.disponible), 0)) : null; };
  const resumenDe = (dic) => r.resumen.find((x) => x.dictamen === dic) || null;
  return { sem: r.sem, contrato: datos.contrato, disponibleDe, resumenDe };
}

// Dictamen con que se paga una factura: las de pasivo (o las sin pagar de un contrato de un año anterior)
// con el dictamen de PASIVO del contrato si lo tiene ligado (contrato_dictamenes); las demás con el principal.
export function dictamenDe(c, f, links = {}) {
  const L = links[c.id] || [];
  const pas = L.find((l) => l.tipo === "pasivo")?.dictamen || null;
  const pri = c.dictamen_numero || L.find((l) => l.tipo === "principal")?.dictamen || null;
  const anioPri = Number(String(pri || "").slice(-4)) || 0;
  if (pas && (!pri || f?.es_pasivo || (f && f.estatus_general !== "gasto_reflejado" && anioPri < ANIO))) return pas;
  return pri;
}

export function calcularAvisos({ facturas, contratos, saldos, ppto, prFecha = {}, links = {} }) {
  const contrato = new Map(contratos.map((c) => [c.id, c]));
  const grupos = {}; // contrato|dictamen → facturas
  for (const f of facturas) {
    if (!f.contrato_id) continue;
    const c = contrato.get(f.contrato_id); if (!c) continue;
    const k = `${c.id}|${dictamenDe(c, f, links) || ""}`;
    (grupos[k] ||= []).push(f);
  }
  const sem = new Map();      // factura_id → semáforo
  const resumen = [];         // por contrato y dictamen con faltante
  for (const [k, fs] of Object.entries(grupos)) {
    const [cid, dic] = [k.slice(0, k.lastIndexOf("|")), k.slice(k.lastIndexOf("|") + 1) || null];
    const c = contrato.get(cid);
    const pendientes = fs.filter((f) => f.estatus_general !== "gasto_reflejado");
    if (!pendientes.length) continue;
    const sal = dic ? saldos[dic] : null;
    if (!sal?.length) {
      const n = String(c.numero_interno || "").toUpperCase();
      const t = dic ? `Falta cargar el IMKK036 del dictamen ${dic}`
        : /^(CE|CB)-/.test(n) ? "Compra emergente: sin dictamen (va contra la cuenta)"
        : /^050GYR|^988T/.test(n) ? "PREI: sin dictamen SAI (el saldo lo da Abasto)"
        : "Contrato sin dictamen en SIGAF";
      for (const f of pendientes) sem.set(f.id, { nivel: "gris", t, contrato: c, dictamen: dic });
      continue;
    }
    if (Number(String(dic).slice(-4)) < ANIO) {
      for (const f of pendientes) sem.set(f.id, { nivel: "gris", t: "Pasivo: falta ligar su dictamen de pasivo 2026", contrato: c, dictamen: dic });
      continue;
    }
    const esPasivo = dic !== c.dictamen_numero;
    const hg = sal.filter((s) => s.ui === UI_HGZ2);
    const disponible = hg.reduce((t, s) => t + num(s.disponible), 0), pagado = hg.reduce((t, s) => t + num(s.pagos), 0);
    const porUi = {}; for (const s of sal) if (s.ui !== UI_HGZ2) porUi[s.ui] = (porUi[s.ui] || 0) + num(s.disponible);
    const otras = Object.entries(porUi).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);
    const otrasDisp = otras.reduce((t, [, v]) => t + v, 0);
    const pagadoSigaf = fs.filter((f) => f.estatus_general === "gasto_reflejado").reduce((t, f) => t + num(f.importe_factura), 0);
    const edo = (f) => (f.cr_contrarecibo && ppto[f.cr_contrarecibo]) || null;
    const validadas = pendientes.filter((f) => edo(f) === "V");
    const impV = validadas.reduce((t, f) => t + num(f.importe_factura), 0);
    const presupuesto = disponible + Math.max(0, pagado - pagadoSigaf - impV);
    for (const f of validadas) sem.set(f.id, { nivel: "validada", t: "Ya validada en FINAT", contrato: c, dictamen: dic, esPasivo });
    const fila = pendientes.filter((f) => edo(f) !== "V").sort((a, b) =>
      (edo(b) === "E") - (edo(a) === "E") || (!!b.cr_contrarecibo) - (!!a.cr_contrarecibo) ||
      (ORDEN[a.estatus_general] ?? 9) - (ORDEN[b.estatus_general] ?? 9) || String(a.fecha_factura || "").localeCompare(String(b.fecha_factura || "")) || String(a.folio_ingreso).localeCompare(String(b.folio_ingreso)));
    let acum = 0, faltaMax = 0;
    for (const f of fila) {
      acum += num(f.importe_factura);
      const falta = r2(acum - presupuesto);
      const base = { contrato: c, dictamen: dic, esPasivo, error: edo(f) === "E" };
      if (falta <= 0.5) sem.set(f.id, { ...base, nivel: base.error ? "ambar" : "verde", t: base.error ? "Cayó en error de presupuesto; ya hay dinero en el dictamen: pedir a OOAD que la revalide" : "Hay dinero en el dictamen" });
      else if (otrasDisp >= falta) sem.set(f.id, { ...base, nivel: "ambar", falta, t: `Necesita oficio de apoyo: faltan ${fmt(Math.min(falta, num(f.importe_factura)))} (UI ${otras[0][0]} tiene ${fmt(otras[0][1])})` });
      else sem.set(f.id, { ...base, nivel: "rojo", falta, t: `Sin dinero: pedir ampliación de dictamen (faltan ${fmt(Math.min(falta, num(f.importe_factura)))})` });
      faltaMax = Math.max(faltaMax, falta);
    }
    if (faltaMax > 0.5 || fila.some((f) => edo(f) === "E"))
      resumen.push({ contrato: c, dictamen: dic, esPasivo, disponible: r2(disponible), faltante: r2(Math.max(0, faltaMax)), otras, otrasDisp: r2(otrasDisp),
        accion: faltaMax <= 0.5 ? "revalidar" : otrasDisp >= faltaMax ? "oficio" : "ampliacion",
        facturas: fila.filter((f) => ["ambar", "rojo"].includes(sem.get(f.id)?.nivel) || edo(f) === "E") });
  }

  // Avisos de acción
  const hoy = Date.now();
  const listasOOAD = [], conPR = [];
  for (const f of facturas) {
    if (!["capturada", "en_revision"].includes(f.estatus_general)) continue;
    const cap = f.capitulos?.nombre || "";
    const llevaPR = generaPedidoRecepcion(cap, f.partidas?.cuenta_finat || f.partidas?.cuenta_prei);
    const lista = puedeEnviarOoad(f.estatus_firmas, llevaPR ? f.estatus_pedido_recepcion : "generado", cap);
    if (lista) listasOOAD.push({ f, sem: sem.get(f.id) || null });
    if (llevaPR && f.estatus_pedido_recepcion === "generado") {
      const desde = prFecha[f.id]; const dias = desde ? Math.floor((hoy - new Date(desde).getTime()) / 86400000) : null;
      conPR.push({ f, lista, dias, nuevo: dias != null && dias <= 7, sem: sem.get(f.id) || null });
    }
  }
  conPR.sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999));
  const enError = facturas.filter((f) => f.estatus_general !== "gasto_reflejado" && f.cr_contrarecibo && ppto[f.cr_contrarecibo] === "E");
  resumen.sort((a, b) => b.faltante - a.faltante);
  return {
    sem, resumen, listasOOAD, conPR, enError,
    cuentas: {
      listasOOAD: listasOOAD.length,
      listasSinDinero: listasOOAD.filter((x) => ["ambar", "rojo"].includes(x.sem?.nivel)).length,
      prNuevos: conPR.filter((x) => x.nuevo).length,
      conPR: conPR.length,
      oficio: resumen.filter((r) => r.accion === "oficio").length,
      ampliacion: resumen.filter((r) => r.accion === "ampliacion").length,
      enError: enError.length,
    },
  };
}
const fmt = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
