// Dictámenes "vivos": lo que SIGAF deduce entre un IMKK036 y el siguiente, sin tener que descargarlo cada semana.
//   · saldoVivo: último Disponible Acum del PDF − CR válidos (1043) posteriores al corte − apoyos.
//   · cuadreDispo: suma de saldos por centro y cuenta contra el Comprometido de la dispo; si no cuadra dice qué revisar.
//   · sugerencias: qué gestionar para que una factura no caiga en error de presupuesto, sin ofrecer dos veces el mismo peso.
// Reglas de Gabriel y de la normativa (Norma Presupuestaria 6000-001-010 y Procedimiento 6BA0-003-001):
//   · Lo ejercible hoy es el Disponible Acum del mes corriente; los meses futuros solo se ven en "Disponible".
//   · Movimiento en tiempo, post definitivo y ampliación necesitan Disponible en el mes destino.
//   · Escenario 1 (reducción) y cancelar un previo GENERAN Disponible. El oficio de apoyo no lo consume.
//   · Lo comprometido no se mueve por adecuación (Norma 7.5.18.1) y lo libre lo puede reducir la CPIP (7.5.18.5).
// Sin acceso a Supabase: todo son funciones sobre datos ya leídos.
import { UI_HGZ2, ANIO, saldosAlMes, descuentoApoyos } from "./contratos";

const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
const per = (s) => num(s.anio) * 100 + num(s.mes);
const claveDe = (s) => `${s.centro}|${s.cuenta}`;
const fmt = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const periodoTxt = (a, m) => `${a}M${String(m).padStart(2, "0")}`;
const MESES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const TOPE_AMPLIACION = 0.2; // Procedimiento 5.2.9 y Anexo 2 8.5
// Convenios donde Gabriel no sabe si aplica el 20%: SIGAF no lo asume y pide confirmar con la Jefatura de Finanzas.
const SIN_TOPE_CONOCIDO = new Set(["S7M0163"]);
const normContrato = (c) => String(c || "").trim().toUpperCase().replace(/-\d{2}$/, "");
const fechaCorta = (f) => String(f || "").slice(0, 10);

// CR de una unidad (por omisión el HGZ 2) que FINAT ya validó después del corte del PDF. Los del mismo día del corte se
// descuentan solo si el gasto de ese mes en el PDF no alcanza a traerlos (el IMKK036 se corre en la mañana y el CR pudo
// validarse después). `saldosHg` son los renglones del PDF de esa misma unidad.
export function movimientosDesdeCorte(comprobantes = [], contratos = [], claves = [], corte = "", hasta = null, saldosHg = [], ui = UI_HGZ2) {
  const cs = new Set(contratos.map(normContrato)), ks = new Set(claves), c0 = fechaCorta(corte);
  const dentro = comprobantes.filter((l) => l.ui === ui && cs.has(normContrato(l.contrato)) && ks.has(`${l.centro_costo}|${l.cuenta}`) && String(l.estado_entrada || "").toUpperCase() !== "X" && String(l.estado_ppto || "").toUpperCase() === "V" && l.fecha_ppto);
  const fp = (l) => fechaCorta(l.fecha_ppto);
  const mismoDia = dentro.filter((l) => fp(l) === c0), mes = c0.slice(0, 7), impDe = (arr) => arr.reduce((t, l) => t + num(l.importe_cuenta), 0);
  const delMesAntes = dentro.filter((l) => fp(l).slice(0, 7) === mes && fp(l) < c0);
  const gastoPdfMes = saldosHg.filter((s) => ks.has(claveDe(s)) && `${s.anio}-${String(s.mes).padStart(2, "0")}` === mes).reduce((t, s) => t + num(s.pagos), 0);
  const faltanEnPdf = mismoDia.length > 0 && gastoPdfMes < impDe(delMesAntes) + impDe(mismoDia) - 0.5;
  return {
    aplicados: [...(faltanEnPdf ? mismoDia : []), ...dentro.filter((l) => fp(l) > c0 && (!hasta || fp(l) <= fechaCorta(hasta)))],
    mismoDia: faltanEnPdf ? [] : mismoDia,
  };
}

// Clasifica el Ajuste Post del dictamen completo (todas las unidades)
export function clasificarAjustes(saldos = []) {
  const con = saldos.filter((s) => Math.abs(num(s.ajuste_post)) > 0.005);
  const previo = saldos.reduce((t, s) => t + num(s.previo), 0);
  const neto = con.reduce((t, s) => t + num(s.ajuste_post), 0), alza = con.filter((s) => num(s.ajuste_post) > 0), baja = con.filter((s) => num(s.ajuste_post) < 0);
  const pct = previo ? neto / previo : 0;
  let tipo = "Sin ajustes";
  if (con.length) {
    if (Math.abs(neto) < 0.5) tipo = "Movimiento en tiempo";
    else if (neto > 0) tipo = baja.length ? "Ampliación con movimientos" : "Ampliación";
    else tipo = alza.length ? "Reducción con movimientos" : "Reducción (Escenario 1)";
  }
  const hg = con.filter((s) => s.ui === UI_HGZ2).sort((a, b) => per(a) - per(b)).map((s) => ({ periodo: periodoTxt(s.anio, s.mes), mes: num(s.mes), importe: num(s.ajuste_post) }));
  return { tipo, previo: r2(previo), neto: r2(neto), pct, alza: r2(alza.reduce((t, s) => t + num(s.ajuste_post), 0)), baja: r2(baja.reduce((t, s) => t + num(s.ajuste_post), 0)), movimientos: con.length, hgz2: hg, enTope: pct >= TOPE_AMPLIACION - 0.0005, margen: r2(Math.max(0, previo * TOPE_AMPLIACION - neto)) };
}

// Saldo al día de TODAS las unidades de un dictamen: el Disponible Acum de cada unidad · centro · cuenta en el PDF,
// menos los CR que FINAT validó después del corte (1043) en esa misma unidad, centro y cuenta. Al HGZ 2 además se le
// restan los apoyos que dimos y que el PDF aún no trae. Es el único cálculo de saldo que usan Avisos, el oficio de
// apoyo, Contratos y Dictámenes (6/11/2026: el oficio proponía con el saldo del PDF y no veía lo glosado después).
// Sin comprobantes da lo mismo que el PDF.
export function saldoAlDia({ saldos = [], corte = "", contratos = [], comprobantes = [], apoyos = [], hoy = new Date() }) {
  const alMes = saldosAlMes(saldos, hoy);
  const uis = [...new Set(saldos.map((s) => s.ui))];
  const filas = [], porUi = {};
  for (const ui of uis) {
    const delUi = saldos.filter((s) => s.ui === ui);
    const claves = [...new Set(delUi.map(claveDe))];
    const { aplicados, mismoDia } = movimientosDesdeCorte(comprobantes, contratos, claves, corte, null, delUi, ui);
    const gasto = {}; for (const l of aplicados) { const k = `${l.centro_costo}|${l.cuenta}`; gasto[k] = (gasto[k] || 0) + num(l.importe_cuenta); }
    const pdf = alMes.filter((s) => s.ui === ui);
    for (const s of pdf) filas.push({ ui, centro: s.centro, cuenta: s.cuenta, saldoPdf: r2(s.saldo), saldo: r2(s.saldo - (gasto[claveDe(s)] || 0)) });
    porUi[ui] = { saldoPdf: r2(pdf.reduce((t, s) => t + s.saldo, 0)), gastoPosterior: r2(aplicados.reduce((t, l) => t + num(l.importe_cuenta), 0)), aplicados, mismoDia };
  }
  // Apoyos que dimos: salen del HGZ 2, renglón por renglón, empezando por el de más saldo
  const apoyosDesc = r2(descuentoApoyos(apoyos, corte));
  let quedaApoyo = apoyosDesc;
  for (const f of filas.filter((x) => x.ui === UI_HGZ2).sort((a, b) => b.saldo - a.saldo)) {
    const q = r2(Math.min(Math.max(0, f.saldo), quedaApoyo)); f.saldo = r2(f.saldo - q); quedaApoyo = r2(quedaApoyo - q);
  }
  const totalUi = (ui) => r2(filas.filter((f) => f.ui === ui).reduce((t, f) => t + f.saldo, 0) - (ui === UI_HGZ2 ? quedaApoyo : 0));
  const hg = porUi[UI_HGZ2] || { saldoPdf: 0, gastoPosterior: 0, aplicados: [], mismoDia: [] };
  const otras = uis.filter((ui) => ui !== UI_HGZ2).map((ui) => ({ ui, saldo: totalUi(ui), saldoPdf: porUi[ui].saldoPdf, gastoPosterior: porUi[ui].gastoPosterior }))
    .filter((o) => o.saldo > 0.5).sort((a, b) => b.saldo - a.saldo);
  return {
    saldoPdf: hg.saldoPdf, gastoPosterior: hg.gastoPosterior, aplicados: hg.aplicados, mismoDia: hg.mismoDia, apoyosDesc,
    saldoHoy: totalUi(UI_HGZ2), otras, otrasDisp: r2(otras.reduce((t, o) => t + o.saldo, 0)), filas,
    gastoOtras: r2(uis.filter((ui) => ui !== UI_HGZ2).reduce((t, ui) => t + porUi[ui].gastoPosterior, 0)),
  };
}

// Fotografía de un dictamen: saldo del PDF, saldo al día, meses siguientes, ritmo y otras unidades.
export function saldoVivo({ numero, corte, saldos = [], contratos = [], comprobantes = [], apoyos = [], hoy = new Date() }) {
  const hg = saldos.filter((s) => s.ui === UI_HGZ2), tope = hoy.getFullYear() * 100 + hoy.getMonth() + 1;
  const claves = [...new Set(hg.map(claveDe))];
  const dia = saldoAlDia({ saldos, corte, contratos, comprobantes, apoyos, hoy });
  const { saldoPdf, aplicados, mismoDia, gastoPosterior, apoyosDesc, saldoHoy } = dia;

  const porMes = {};
  for (const s of hg) { const p = per(s); const o = (porMes[p] ||= { p, anio: num(s.anio), mes: num(s.mes), definitivo: 0, pagos: 0, disponible: 0, acum: 0, cant: 0 }); o.definitivo += num(s.definitivo); o.pagos += num(s.pagos); o.disponible += num(s.disponible); o.acum += num(s.disponible_acum); o.cant += num(s.cant_pagos); }
  const meses = Object.values(porMes).sort((a, b) => a.p - b.p);
  const futuros = meses.filter((m) => m.p > tope && m.disponible > 0.005).map((m) => ({ ...m, periodo: periodoTxt(m.anio, m.mes), nombre: MESES[m.mes], disponible: r2(m.disponible) }));
  const totalFuturo = r2(futuros.reduce((t, m) => t + m.disponible, 0));
  const saldoFinal = r2(saldoHoy + totalFuturo);

  // Ritmo: gasto promedio de los 3 meses completos anteriores al corriente
  const mesHoy = hoy.getMonth() + 1, anioHoy = hoy.getFullYear();
  const previos = [1, 2, 3].map((n) => { const m = mesHoy - n; return m > 0 ? anioHoy * 100 + m : (anioHoy - 1) * 100 + (12 + m); });
  const ritmo = r2(previos.reduce((t, p) => t + num(porMes[p]?.pagos), 0) / 3);
  const conGasto = meses.filter((m) => m.pagos > 0.005), ultimoGasto = conGasto.length ? conGasto[conGasto.length - 1] : null;

  const otras = dia.otras;
  const claveMayor = claves.map((k) => [k, hg.filter((s) => claveDe(s) === k).reduce((t, s) => t + Math.abs(num(s.definitivo)) + num(s.pagos), 0)]).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return { numero, corte, esAnio: String(numero).endsWith(String(ANIO)), claves, claveMayor, saldoPdf, gastoPosterior, apoyosDesc, saldoHoy, futuros, totalFuturo, saldoFinal, ritmo, ultimoGasto, otras, otrasDisp: dia.otrasDisp, gastoOtras: dia.gastoOtras, filas: dia.filas, aplicados, mismoDia, ajustes: clasificarAjustes(saldos), meses, contratos };
}

// Compara por centro y cuenta el saldo de los dictámenes del año contra el Comprometido de la dispo más reciente.
// Si da $0, no hace falta bajar ningún IMKK036. Si no, dice en qué cuenta buscar.
export function cuadreDispo(vivos = [], saldosPorDictamen = {}, detalleDispo = [], comprobantes = []) {
  const fechaDispo = detalleDispo.reduce((f, d) => (fechaCorta(d.fecha) > f ? fechaCorta(d.fecha) : f), "");
  const comp = {}; for (const d of detalleDispo) { const k = `${d.centro_costo}|${d.cuenta_finat}`; comp[k] = (comp[k] || 0) + num(d.comprometido); }
  const acum = {};
  for (const v of vivos) {
    if (!v.esAnio) continue;
    for (const k of v.claves) {
      const filas = (saldosPorDictamen[v.numero] || []).filter((s) => s.ui === UI_HGZ2 && claveDe(s) === k && num(s.anio) === ANIO).sort((a, b) => per(a) - per(b));
      const ult = filas[filas.length - 1]; if (!ult) continue;
      const { aplicados } = movimientosDesdeCorte(comprobantes, v.contratos, [k], v.corte, fechaDispo || null, filas);
      const o = (acum[k] ||= { clave: k, saldo: 0, dictamenes: [], masViejo: "" });
      o.saldo += num(ult.disponible_acum) - aplicados.reduce((t, l) => t + num(l.importe_cuenta), 0);
      o.dictamenes.push(v.numero);
      if (fechaCorta(v.corte) > (o.masViejo || "")) o.masViejo = fechaCorta(v.corte);
    }
  }
  return Object.values(acum).map((o) => {
    const [centro, cuenta] = o.clave.split("|"), comprometido = r2(comp[o.clave] || 0), saldo = r2(o.saldo), diferencia = r2(comprometido - saldo);
    const dispoVieja = !!fechaDispo && o.masViejo > fechaDispo;
    let estado = "ok", texto = "Cuadra: no hace falta descargar el IMKK036";
    if (dispoVieja) { estado = "espera"; texto = "La dispo es más vieja que el IMKK036: carga la dispo de hoy"; }
    else if (diferencia > 0.5) { estado = "revisar"; texto = "La dispo compromete más que los dictámenes cargados: probable previo o dictamen sin cargar"; }
    else if (diferencia < -0.5) { estado = "revisar"; texto = "Los dictámenes tienen más saldo que la dispo: probable reducción, gasto sin registrar o IMKK036 atrasado"; }
    return { centro, cuenta, saldo, comprometido, diferencia, estado, texto, dictamenes: o.dictamenes, fechaDispo };
  }).sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
}

// Disponible libre de la dispo por centro|cuenta y periodo; es un saldo que se va gastando al sugerir.
export function poolDisponible(detalleDispo = []) {
  const p = {}; for (const d of detalleDispo) { const k = `${d.centro_costo}|${d.cuenta_finat}`; const o = (p[k] ||= {}); o[d.periodo] = (o[d.periodo] || 0) + num(d.disponible); }
  return p;
}

// Lo que no se ha ejercido y puede caer en error: facturas sin validar o ya en E.
export const pendientesDe = (facturas = [], ppto = {}) => facturas.filter((f) => f.estatus_general !== "gasto_reflejado" && String((f.cr_contrarecibo && ppto[f.cr_contrarecibo]) || "").toUpperCase() !== "V");

// Sugerencias en orden: tiempo → apoyo → post → Escenario 1 de otro contrato → póliza → CAOA.
// `filas`: [{ vivo, contrato, pendientes: [facturas] }]. El Disponible y los sobrantes se consumen para no ofrecerlos dos veces.
export function generarSugerencias(filas = [], detalleDispo = [], hoy = new Date()) {
  const pool = poolDisponible(detalleDispo), mesHoy = hoy.getMonth() + 1, anioHoy = hoy.getFullYear(), pHoy = periodoTxt(anioHoy, mesHoy), mesesRest = Math.max(1, 12 - mesHoy + 1);
  const dispoHoy = (k) => Math.max(0, num(pool[k]?.[pHoy]));
  const gastar = (k, imp) => { if (pool[k]) pool[k][pHoy] = num(pool[k][pHoy]) - imp; };
  const pendImp = (x) => x.pendientes.reduce((t, f) => t + num(f.importe_factura), 0);
  const sobrante = {};
  for (const x of filas) {
    const v = x.vivo; if (!v.esAnio) continue;
    const s = r2(v.saldoFinal - v.ritmo * mesesRest - pendImp(x)); // sobrante proyectado
    if (s > 500 && !pendImp(x)) sobrante[v.numero] = s;
  }
  const orden = [...filas].sort((a, b) => (pendImp(b) - b.vivo.saldoHoy) - (pendImp(a) - a.vivo.saldoHoy));
  const res = {};
  for (const x of orden) {
    const v = x.vivo, pendiente = r2(pendImp(x)), k = v.claveMayor, pasos = [], avisos = [];
    let falta = r2(pendiente - Math.max(0, v.saldoHoy));
    const sinTope = SIN_TOPE_CONOCIDO.has(normContrato(x.contrato));
    if (falta > 0.5 && v.esAnio && k) {
      // 1. Movimiento en tiempo: saldo de un mes futuro + Disponible en el mes destino
      const mover = r2(Math.min(falta, v.totalFuturo, dispoHoy(k)));
      if (mover > 0.5) {
        gastar(k, mover); falta = r2(falta - mover);
        // Lo que se adelanta deja Disponible en el mes de origen
        let queda = mover; for (const m of v.futuros) { const q = Math.min(queda, m.disponible); if (q > 0 && pool[k]) { pool[k][m.periodo] = num(pool[k][m.periodo]) + q; queda -= q; } }
        pasos.push({ tipo: "tiempo", titulo: "Movimiento en tiempo", importe: mover, detalle: `Adelantar de ${v.futuros.map((m) => m.nombre).join(" y ")} al mes corriente`, quien: "Jefatura de Finanzas, con solicitud de la unidad", requiere: `Usa ${fmt(mover)} del Disponible del mes; el mes de origen queda sin ese dictamen`, base: "Anexo 2 numerales 1, 2 y 8.5", tarda: "3 días hábiles (5.1.7)" });
      } else if (v.totalFuturo > 0.5) avisos.push(`Hay ${fmt(v.totalFuturo)} en meses futuros, pero no hay Disponible en el mes para adelantarlo`);
      // 2. Oficio de apoyo: no consume Disponible, pero la otra unidad puede ocupar ese saldo
      for (const o of v.otras) {
        if (falta <= 0.5) break;
        if (o.saldo < 1000) continue; // saldos mínimos: no vale un oficio
        const imp = r2(Math.min(falta, o.saldo)); falta = r2(falta - imp);
        pasos.push({ tipo: "apoyo", titulo: `Oficio de apoyo de UI ${o.ui}`, importe: imp, detalle: `La unidad tiene ${fmt(o.saldo)} en este dictamen`, quien: "Administrador del contrato, con Jefatura de Finanzas", requiere: "Confirmar que esa unidad no lo necesita para sus propias facturas", base: "Oficios de apoyo del HGZ 2", tarda: "Según atención de Finanzas" });
      }
      // 3. Post definitivo: Disponible del mes y saldo en el contrato
      const puedePost = sinTope || !v.ajustes.enTope;
      const post = puedePost ? r2(Math.min(falta, dispoHoy(k))) : 0;
      if (post > 0.5) { gastar(k, post); falta = r2(falta - post); pasos.push({ tipo: "post", titulo: "Post definitivo a la alza", importe: post, detalle: "Con el Disponible libre del mes en la misma cuenta y centro", quien: "Jefatura de Finanzas", requiere: "Saldo en el contrato; verificar el máximo antes de solicitar", base: "Procedimiento 5.2.19", tarda: "3 días hábiles (5.1.7)" }); }
      // 4. Escenario 1 de otro contrato de la misma cuenta: genera el Disponible que usa el post
      if (puedePost) for (const y of filas) {
        if (falta <= 0.5) break;
        if (y === x || !y.vivo.claves.includes(k) || !sobrante[y.vivo.numero]) continue;
        const imp = r2(Math.min(falta, sobrante[y.vivo.numero])); sobrante[y.vivo.numero] = r2(sobrante[y.vivo.numero] - imp); falta = r2(falta - imp);
        pasos.push({ tipo: "escenario", titulo: `Escenario 1 de ${y.contrato || y.vivo.numero}`, importe: imp, detalle: `Reducir sobrante proyectado y usarlo en post definitivo`, quien: "Administrador del contrato y CAOA; autoriza CPIP", requiere: "Causa justificada, Constancia de modificación y no bajar del mínimo; solo contratos abiertos", base: "Anexo 2 numerales 8.5 y 15", tarda: "Unos días; S6M0049 tardó 1 día en reflejarse" });
      }
      // 5. Póliza: mover Presupuesto libre de meses futuros al mes corriente
      if (puedePost && falta > 0.5 && pool[k]) {
        const fut = Object.keys(pool[k]).filter((p) => p > pHoy && num(pool[k][p]) > 0.5).sort();
        for (const p of fut) {
          if (falta <= 0.5) break;
          const imp = r2(Math.min(falta, num(pool[k][p]))); pool[k][p] = num(pool[k][p]) - imp; falta = r2(falta - imp);
          pasos.push({ tipo: "poliza", titulo: `Adelantar presupuesto de ${MESES[Number(p.slice(-2))]}`, importe: imp, detalle: "Póliza con Disponible libre y luego post definitivo", quien: "Oficina de Presupuesto, y CPIP según el caso", requiere: "Solo con Disponible libre; lo comprometido no se mueve", base: "Norma 7.5.18.1", tarda: "Por confirmar" });
        }
      }
      // 6. Lo que quede: recurso con CAOA y, si cabe, ampliación
      if (falta > 0.5) {
        const a = v.ajustes;
        const detalle = sinTope ? "Confirmar con la Jefatura de Finanzas si a este convenio le aplica el tope del 20%"
          : a.enTope ? "El dictamen ya está en el tope del 20%: no cabe ampliación; apoyo de otra unidad o nuevo procedimiento"
          : `Quedan ${fmt(a.margen)} antes del tope del 20%, tomado sobre el Previo del dictamen; ampliación con convenio modificatorio`;
        pasos.push({ tipo: "caoa", titulo: "Gestionar recurso con CAOA", importe: falta, detalle, quien: "CAOA solicita; Jefatura de Finanzas y CPIP resuelven", requiere: "Previo antes del convenio, convenio modificatorio y disponibilidad", base: "Manual 2000-002-002 función 4; Procedimiento 5.2.9; Norma 7.5.9.4.8", tarda: "Unas 5 semanas (S6M0030: 26/08 a 01/10)" });
      }
    }
    // Avisos que no dependen de una factura
    const finV = x.vigenciaFin ? new Date(fechaCorta(x.vigenciaFin) + "T00:00:00") : null;
    const vencido = finV && finV < hoy;
    const mesesVig = finV && finV.getFullYear() === anioHoy ? Math.max(1, finV.getMonth() + 1 - mesHoy + 1) : mesesRest;
    const proy = vencido ? 0 : r2(v.ritmo * mesesVig), faltaProy = r2(proy - (v.saldoFinal - pendiente));
    if (v.esAnio && v.ritmo > 0.5 && falta <= 0.5 && faltaProy > Math.max(1000, proy * 0.05)) avisos.push(`A este ritmo (${fmt(v.ritmo)} al mes) harían falta ${fmt(faltaProy)} para cerrar ${mesesVig < mesesRest ? "el contrato" : "el año"}; conviene gestionar con tiempo`);
    if (v.esAnio && v.saldoFinal > 500 && !pendiente && (!v.ultimoGasto || v.ultimoGasto.p < anioHoy * 100 + mesHoy - 2)) avisos.push(`${fmt(v.saldoFinal)} sin gasto ${v.ultimoGasto ? `desde ${MESES[v.ultimoGasto.mes]}` : "en el año"}: revisar si es recurso ocioso (Procedimiento 5.2.8)`);
    if (!v.esAnio) avisos.push("Dictamen de año anterior: el saldo es Impte Def + Pagos, porque su acumulado no cuadra");
    res[v.numero] = { pendiente, saldoHoy: v.saldoHoy, faltante: r2(Math.max(0, pendiente - Math.max(0, v.saldoHoy))), sinCubrir: pasos.find((p) => p.tipo === "caoa")?.importe || 0, pasos, avisos, sobrante: sobrante[v.numero] || 0 };
  }
  return res;
}

// Disponible libre del mes y siguientes por cuenta: la CPIP lo puede reducir, conviene tenerlo a la vista (Norma 7.5.18.5).
export function disponibleLibre(detalleDispo = [], claves = [], hoy = new Date()) {
  const ks = new Set(claves), pHoy = periodoTxt(hoy.getFullYear(), hoy.getMonth() + 1), m = {};
  for (const d of detalleDispo) {
    const k = `${d.centro_costo}|${d.cuenta_finat}`; if (!ks.has(k) || d.periodo < pHoy) continue;
    const o = (m[k] ||= { centro: d.centro_costo, cuenta: d.cuenta_finat, total: 0, porMes: {} });
    o.total += num(d.disponible); o.porMes[d.periodo] = (o.porMes[d.periodo] || 0) + num(d.disponible);
  }
  return Object.values(m).filter((o) => o.total > 0.5).sort((a, b) => b.total - a.total).map((o) => ({ ...o, total: r2(o.total) }));
}
