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
//
// Lista por factura (2/11/2026), en s.clase: presupuesto · oficio · gestion · aclarar · validada · sindato.
//   · Una factura entra solo si cabe completa; si no cabe, no gasta saldo y se prueba con la siguiente.
//   · Lo que FINAT trae pagado de más no es dinero disponible: se marca "aclarar" (nunca a un CR en error).
//   · Compra emergente y PREI no tienen dictamen: se miden con la dispo de su cuenta en el mes corriente.
import { supabase } from "./supabaseClient";
import { leerTodo } from "./paginar";
import { ANIO, UI_HGZ2, saldoDelMes, corteViejo } from "./contratos";
import { generaPedidoRecepcion, puedeEnviarOoad } from "./estatus";

const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
const ORDEN = { en_tramite_ooad: 0, enviada_ooad: 1, en_revision: 2, capturada: 3 };

const periodoHoy = (hoy = new Date()) => `${hoy.getFullYear()}M${String(hoy.getMonth() + 1).padStart(2, "0")}`;
const leerDispoMes = () => leerTodo((d, h) => supabase.from("dispo_detalle_actual").select("fecha, cuenta_finat, centro_costo, disponible").eq("periodo", periodoHoy()).order("cuenta_finat").order("centro_costo").range(d, h));
// Dispo vigente del mes corriente (solo trae HGZ 2): por cuenta y por cuenta|centro de costo. null si no se pudo leer.
function mapaDispo(r) {
  if (r?.error || !r?.data?.length) return null;
  const m = { fecha: r.data[0].fecha, porCuenta: {}, porCC: {} };
  for (const d of r.data) {
    m.porCuenta[d.cuenta_finat] = (m.porCuenta[d.cuenta_finat] || 0) + num(d.disponible);
    const k = `${d.cuenta_finat}|${d.centro_costo}`; m.porCC[k] = (m.porCC[k] || 0) + num(d.disponible);
  }
  return m;
}

export async function cargarAvisos() {
  const [rF, rC, rS, rH, rL, rDi, rDp] = await Promise.all([
    leerTodo((d, h) => supabase.from("facturas").select(SELECT_F)
      .eq("anulada", false).neq("estatus_general", "devuelta_proveedor").order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("contratos").select("id, numero_interno, dictamen_numero, administrador_contrato, proveedores ( razon_social )").order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("dictamen_saldos").select("dictamen, ui, centro, cuenta, anio, mes, pagos, disponible").order("dictamen").order("ui").order("anio").order("mes").order("cuenta").order("centro").range(d, h)),
    leerTodo((d, h) => supabase.from("factura_estatus_historial").select("factura_id, fecha").eq("circuito", "pedido_recepcion").eq("estatus", "generado").order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("contrato_dictamenes").select("contrato_id, dictamen, tipo").order("contrato_id").range(d, h)),
    supabase.from("dictamenes").select("numero, corte"),
    leerDispoMes(),
  ]);
  const err = [rF, rC].find((r) => r.error);
  if (err) throw new Error(err.error.message);
  const facturas = rF.data || [];
  const sinPagar = facturas.filter((f) => f.estatus_general !== "gasto_reflejado");
  // Estado presupuestal de los CR (1043): E si alguna línea cayó en error · V si todas validadas · N lo demás
  const ppto = await estadosPpto([...new Set(sinPagar.map((f) => f.cr_contrarecibo).filter(Boolean))]);
  const saldos = {}; for (const s of rS.error ? [] : rS.data || []) (saldos[s.dictamen] ||= []).push(s);
  const prFecha = {}; for (const h of rH.error ? [] : rH.data || []) if (!prFecha[h.factura_id] || h.fecha > prFecha[h.factura_id]) prFecha[h.factura_id] = h.fecha;
  return calcularAvisos({ facturas, contratos: rC.data || [], saldos, ppto, prFecha, links: ligas(rL), cortes: mapaCortes(rDi), dispo: mapaDispo(rDp) });
}

// contrato_dictamenes → { contrato_id: [{ dictamen, tipo }] } (vacío si aún no se corre la 050)
const mapaCortes = (r) => Object.fromEntries((r?.error ? [] : r?.data || []).map((d) => [d.numero, d.corte]));
function ligas(r) { const m = {}; for (const l of r?.error ? [] : r?.data || []) (m[l.contrato_id] ||= []).push(l); return m; }

// ---------- Un solo contrato (captura y detalle de factura) ----------
const SELECT_F = "id, contrato_id, folio_ingreso, folio_proveedor, importe_factura, es_pasivo, estatus_general, estatus_firmas, estatus_pedido_recepcion, numero_pedido, numero_recepcion, cr_contrarecibo, fecha_factura, centro_costo, mes_presupuestal, proveedores ( razon_social ), capitulos ( nombre ), partidas ( cuenta_finat, cuenta_prei, nombre )";
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
  const c = rC.data; let facturas = rF.data || [], contratos = [c], dispo = null;
  const rL = await supabase.from("contrato_dictamenes").select("contrato_id, dictamen, tipo").eq("contrato_id", contratoId);
  const links = ligas(rL);
  const dics = [...new Set([c.dictamen_numero, ...(links[c.id] || []).map((l) => l.dictamen)].filter(Boolean))];
  // Sin dictamen va contra la dispo de la cuenta, que comparte con otros contratos: hacen falta todas las pendientes de esos contratos
  if (!dics.length && vaContraDispo(c)) {
    const [rT, rCs, rDp] = await Promise.all([
      leerTodo((d, h) => supabase.from("facturas").select(SELECT_F).eq("anulada", false).not("estatus_general", "in", "(devuelta_proveedor,gasto_reflejado)").order("id").range(d, h)),
      leerTodo((d, h) => supabase.from("contratos").select("id, numero_interno, dictamen_numero, proveedores ( razon_social )").order("id").range(d, h)),
      leerDispoMes(),
    ]);
    if (!rT.error && !rCs.error) { contratos = (rCs.data || []).filter((x) => x.id === c.id || (!x.dictamen_numero && vaContraDispo(x))); const ids = new Set(contratos.map((x) => x.id)); facturas = (rT.data || []).filter((f) => ids.has(f.contrato_id)); }
    dispo = mapaDispo(rDp);
  }
  const saldos = {}; let cortes = {};
  if (dics.length) {
    const rS = await supabase.from("dictamen_saldos").select("dictamen, ui, anio, mes, pagos, disponible").in("dictamen", dics);
    if (!rS.error) for (const x of rS.data || []) (saldos[x.dictamen] ||= []).push(x);
    cortes = mapaCortes(await supabase.from("dictamenes").select("numero, corte").in("numero", dics));
  }
  const ppto = await estadosPpto([...new Set(facturas.filter((f) => f.estatus_general !== "gasto_reflejado").map((f) => f.cr_contrarecibo).filter(Boolean))]);
  return { contrato: c, contratos, facturas, saldos, ppto, links, cortes, dispo };
}

// Semáforo de un contrato ya cargado; "nueva" = factura que se está capturando ({ importe, fecha, cuenta, centro }).
export const ID_NUEVA = "__nueva__";
export function semaforoDe(datos, nueva = null) {
  if (!datos) return null;
  const facturas = nueva && Number(nueva.importe) > 0
    ? [...datos.facturas, { id: ID_NUEVA, contrato_id: datos.contrato.id, folio_ingreso: "(nueva)", importe_factura: Number(nueva.importe), estatus_general: "capturada", fecha_factura: nueva.fecha || new Date().toISOString().slice(0, 10), centro_costo: nueva.centro || null, partidas: { cuenta_finat: nueva.cuenta || null } }]
    : datos.facturas;
  const r = calcularAvisos({ facturas, contratos: datos.contratos || [datos.contrato], saldos: datos.saldos, ppto: datos.ppto, links: datos.links, cortes: datos.cortes, dispo: datos.dispo });
  // Por dictamen: saldo del mes corriente del HGZ 2 y resumen (un contrato 2025 puede tener su dictamen de pasivo aparte)
  const disponibleDe = (dic) => { const sal = (dic && datos.saldos[dic]) || []; return sal.length && !corteViejo(datos.cortes?.[dic]) ? saldoDelMes(sal).disponible : null; };
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

// Compra emergente y PREI no tienen dictamen SAI: su dinero se ve en la dispo de la cuenta.
const esPrei = (c) => /^050GYR|^988T/.test(String(c.numero_interno || "").toUpperCase());
const vaContraDispo = (c) => /^(CE|CB)-/.test(String(c.numero_interno || "").toUpperCase()) || esPrei(c);

export function calcularAvisos({ facturas, contratos, saldos, ppto, prFecha = {}, links = {}, cortes = {}, dispo = null }) {
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
  const porActualizar = new Set(); // dictámenes con facturas pendientes cuyo IMKK036 es de un mes anterior
  const contraDispo = [];     // facturas de compra emergente y PREI, se reparten al final por cuenta
  const edoCR = (f) => (f.cr_contrarecibo && ppto[f.cr_contrarecibo]) || null;
  const enFila = (a, b) => (edoCR(b) === "E") - (edoCR(a) === "E") || (!!b.cr_contrarecibo) - (!!a.cr_contrarecibo) ||
    (ORDEN[a.estatus_general] ?? 9) - (ORDEN[b.estatus_general] ?? 9) || String(a.fecha_factura || "").localeCompare(String(b.fecha_factura || "")) || String(a.folio_ingreso).localeCompare(String(b.folio_ingreso));
  for (const [k, fs] of Object.entries(grupos)) {
    const [cid, dic] = [k.slice(0, k.lastIndexOf("|")), k.slice(k.lastIndexOf("|") + 1) || null];
    const c = contrato.get(cid);
    const pendientes = fs.filter((f) => f.estatus_general !== "gasto_reflejado");
    if (!pendientes.length) continue;
    const sal = dic ? saldos[dic] : null;
    if (!sal?.length) {
      if (!dic && vaContraDispo(c)) { for (const f of pendientes) contraDispo.push({ f, c }); continue; }
      const t = dic ? `Falta cargar el IMKK036 del dictamen ${dic}` : "Contrato sin dictamen en SIGAF";
      for (const f of pendientes) sem.set(f.id, { nivel: "gris", clase: "sindato", t, contrato: c, dictamen: dic });
      continue;
    }
    if (Number(String(dic).slice(-4)) < ANIO) {
      for (const f of pendientes) sem.set(f.id, { nivel: "gris", clase: "sindato", t: "Pasivo: falta ligar su dictamen de pasivo 2026", contrato: c, dictamen: dic });
      continue;
    }
    const esPasivo = dic !== c.dictamen_numero;
    const hg = sal.filter((s) => s.ui === UI_HGZ2);
    const pagado = hg.reduce((t, s) => t + num(s.pagos), 0);
    // Saldo del MES CORRIENTE: FINAT valida contra el mes en que se manda a OOAD (decisión de Gabriel 2/11/2026)
    const sm = saldoDelMes(sal);
    const disponible = sm.disponible, otrasDisp = sm.otrasDisp;
    const otras = sm.otras.map((o) => [o.ui, o.disponible]);
    const viejo = corteViejo(cortes[dic]);
    const pagadoSigaf = fs.filter((f) => f.estatus_general === "gasto_reflejado").reduce((t, f) => t + num(f.importe_factura), 0);
    const edo = edoCR;
    const validadas = pendientes.filter((f) => edo(f) === "V");
    const impV = validadas.reduce((t, f) => t + num(f.importe_factura), 0);
    for (const f of validadas) sem.set(f.id, { nivel: "validada", clase: "validada", t: "Ya validada en FINAT", contrato: c, dictamen: dic, esPasivo });
    const fila = pendientes.filter((f) => edo(f) !== "V").sort(enFila);
    // IMKK036 de un mes anterior: no se conoce el saldo de este mes, no se afirma ni que hay ni que falta
    if (viejo) {
      if (fila.length) porActualizar.add(dic);
      for (const f of fila) sem.set(f.id, { contrato: c, dictamen: dic, esPasivo, error: edo(f) === "E", nivel: "gris", clase: "sindato", t: `Falta el IMKK036 de ${sm.nombre}: no se sabe si hay dinero este mes` });
      if (fila.some((f) => edo(f) === "E"))
        resumen.push({ contrato: c, dictamen: dic, esPasivo, disponible: null, faltante: 0, otras: [], otrasDisp: 0, mes: sm.nombre, accion: "actualizar", facturas: fila.filter((f) => edo(f) === "E") });
      continue;
    }
    // Reparte factura por factura: entra solo la que cabe completa (saldo del HGZ 2 y, si falta, otras unidades)
    let restoFinat = Math.max(0, pagado - pagadoSigaf - impV), restoHg = disponible, faltanTotal = 0, hayRojo = false;
    const restoOtras = otras.map(([ui, v]) => [ui, v]);
    // De qué centro de costo sale cada peso (para el oficio): renglones con saldo en el mes, por unidad
    const hoy = new Date();
    const fuentes = sal.filter((s) => num(s.anio) === hoy.getFullYear() && num(s.mes) === hoy.getMonth() + 1 && num(s.disponible) > 0).map((s) => ({ ui: s.ui, centro: s.centro, cuenta: s.cuenta, resto: num(s.disponible) }));
    const tomar = (ui, importe) => {
      const lineas = []; let porTomar = importe;
      for (const o of fuentes.filter((x) => x.ui === ui)) {
        const u = r2(Math.min(o.resto, porTomar)); if (u <= 0) continue;
        lineas.push({ ui, centro: o.centro, cuenta: o.cuenta, importe: u }); o.resto = r2(o.resto - u); porTomar = r2(porTomar - u);
      }
      return lineas;
    };
    for (const f of fila) {
      const imp = num(f.importe_factura);
      const base = { contrato: c, dictamen: dic, esPasivo, error: edo(f) === "E" };
      if (!base.error && imp <= restoFinat + 0.5) {
        restoFinat -= imp;
        sem.set(f.id, { ...base, nivel: "gris", clase: "aclarar", t: "FINAT trae pagos que SIGAF no tiene como pagados: revisar si esta ya se pagó" });
        continue;
      }
      const usaHg = Math.min(restoHg, imp);
      const falta = r2(imp - usaHg);
      if (falta <= 0.5) {
        restoHg -= usaHg;
        sem.set(f.id, { ...base, nivel: base.error ? "ambar" : "verde", clase: "presupuesto", t: base.error ? `Cayó en error de presupuesto; ya hay dinero en ${sm.nombre}: pedir a OOAD que la revalide` : `Hay dinero en ${sm.nombre}` });
        continue;
      }
      faltanTotal += falta;
      if (falta <= restoOtras.reduce((t, o) => t + o[1], 0) + 0.5) {
        restoHg -= usaHg;
        const apoyo = []; let porCubrir = falta;
        for (const o of restoOtras) { const u = r2(Math.min(o[1], porCubrir)); if (u > 0) { apoyo.push([o[0], u]); o[1] = r2(o[1] - u); porCubrir = r2(porCubrir - u); } }
        const lineas = [...apoyo.flatMap(([ui, v]) => tomar(ui, v)), ...(usaHg > 0 ? tomar(UI_HGZ2, r2(usaHg)) : [])];
        sem.set(f.id, { ...base, nivel: "ambar", clase: "oficio", falta, usaHg: r2(usaHg), apoyo, lineas, t: `Mandar con oficio de apoyo: faltan ${fmt(falta)} en ${sm.nombre} (${apoyo.map(([ui, v]) => `UI ${ui} ${fmt(v)}`).join(", ")})` });
      } else {
        hayRojo = true;
        sem.set(f.id, { ...base, nivel: "rojo", clase: "gestion", falta, t: `Sin dinero en ${sm.nombre}: pedir ampliación de dictamen (faltan ${fmt(falta)})` });
      }
    }
    if (faltanTotal > 0.5 || fila.some((f) => edo(f) === "E"))
      resumen.push({ contrato: c, dictamen: dic, esPasivo, disponible: r2(disponible), faltante: r2(faltanTotal), otras, otrasDisp: r2(otrasDisp), mes: sm.nombre,
        accion: faltanTotal <= 0.5 ? "revalidar" : hayRojo ? "ampliacion" : "oficio",
        facturas: fila.filter((f) => ["ambar", "rojo"].includes(sem.get(f.id)?.nivel) || edo(f) === "E") });
  }

  // Compra emergente y PREI: se reparte la dispo del mes de cada cuenta (por centro de costo si la factura lo trae)
  const mesTxt = saldoDelMes([]).nombre;
  const dispoVigente = dispo && !corteViejo(dispo.fecha) ? dispo : null;
  const restoCta = { ...(dispoVigente?.porCuenta || {}) }, restoCC = { ...(dispoVigente?.porCC || {}) };
  for (const { f, c } of contraDispo.slice().sort((a, b) => enFila(a.f, b.f))) {
    const base = { contrato: c, dictamen: null, error: edoCR(f) === "E" };
    if (edoCR(f) === "V") { sem.set(f.id, { ...base, nivel: "validada", clase: "validada", t: "Ya validada en FINAT" }); continue; }
    const cuenta = String(f.partidas?.cuenta_finat || f.partidas?.cuenta_prei || "");
    if (!dispoVigente || !cuenta) { sem.set(f.id, { ...base, nivel: "gris", clase: "sindato", t: !cuenta ? "Sin cuenta: no se puede revisar la dispo" : `Falta la dispo de ${mesTxt}: no se sabe si hay dinero este mes` }); continue; }
    const kCC = `${cuenta}|${f.centro_costo}`;
    const hay = f.centro_costo ? restoCC[kCC] || 0 : restoCta[cuenta] || 0;
    const imp = num(f.importe_factura);
    const quien = esPrei(c) ? " (saldo por confirmar con Abasto)" : "";
    const datos = { ...base, cuenta, centro: f.centro_costo || null, dispoCuenta: r2(hay) };
    if (hay >= imp - 0.5) {
      if (f.centro_costo) restoCC[kCC] = hay - imp; else restoCta[cuenta] = hay - imp;
      sem.set(f.id, { ...datos, nivel: base.error ? "ambar" : "verde", clase: "presupuesto", t: base.error ? `Cayó en error de presupuesto; ya hay dispo en ${mesTxt} en la cuenta ${cuenta}: pedir a OOAD que la revalide` : `Hay dispo en ${mesTxt} en la cuenta ${cuenta}${quien}` });
    } else {
      sem.set(f.id, { ...datos, nivel: "rojo", clase: "gestion", falta: r2(imp - Math.max(0, hay)), t: `Sin dispo suficiente en ${mesTxt} en la cuenta ${cuenta}: gestionar presupuesto${quien}` });
    }
  }

  // Lista por factura: qué se puede trabajar, qué va con oficio, qué requiere otra gestión
  const presupuesto = { presupuesto: [], oficio: [], gestion: [], aclarar: [], validada: [], sindato: [] };
  for (const f of facturas) {
    if (f.estatus_general === "gasto_reflejado" || f.id === ID_NUEVA) continue;
    const s = sem.get(f.id); if (s) (presupuesto[s.clase] || presupuesto.sindato).push({ f, s });
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
    sem, resumen, listasOOAD, conPR, enError, presupuesto, dispoFecha: dispo?.fecha || null, mes: mesTxt,
    cuentas: {
      listasOOAD: listasOOAD.length,
      listasSinDinero: listasOOAD.filter((x) => ["ambar", "rojo"].includes(x.sem?.nivel)).length,
      prNuevos: conPR.filter((x) => x.nuevo).length,
      conPR: conPR.length,
      oficio: resumen.filter((r) => r.accion === "oficio").length,
      ampliacion: resumen.filter((r) => r.accion === "ampliacion").length,
      enError: enError.length,
      porActualizar: porActualizar.size,
    },
  };
}
const fmt = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
