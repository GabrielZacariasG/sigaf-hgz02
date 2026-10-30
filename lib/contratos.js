// Fase 3 · Cálculos del control de contratos (como las hojas "área médica" / "subrogados" de la cédula).
//   Enlace          = máximo de la unidad + ampliaciones
//   Gasto facturado = facturas del contrato en SIGAF (sin anuladas ni devueltas)
//   Pagos           = facturas ya pagadas (gasto reflejado)
//   Devengo         = servicio recibido SIN factura: por mes, lo capturado menos lo ya facturado de ese mes
//                     (cuando llega la factura, el devengo de ese mes se descuenta solo; nunca negativo)
//   Saldo           = Enlace − (Facturado + Devengo)
//   Proyección      = promedio mensual (facturado 2026 + devengo) de los meses transcurridos × meses de vigencia en el año
export const ANIO = 2026;
const num = (v) => Number(v) || 0;
const mesDe = (f) => {
  if (f.anio_presupuestal && f.mes_presupuestal) return { a: f.anio_presupuestal, m: f.mes_presupuestal };
  const d = f.periodo_inicio || f.fecha_factura; if (!d) return { a: null, m: null };
  return { a: Number(String(d).slice(0, 4)), m: Number(String(d).slice(5, 7)) };
};
const inicioMes = (d) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, 1);

export function mesesVigenciaEnAnio(c, anio = ANIO) {
  if (!c.vigencia_inicio || !c.vigencia_fin) return { desde: 1, hasta: 12, n: 12 };
  const ini = c.vigencia_inicio.slice(0, 4) < String(anio) ? 1 : c.vigencia_inicio.slice(0, 4) > String(anio) ? 13 : Number(c.vigencia_inicio.slice(5, 7));
  const fin = c.vigencia_fin.slice(0, 4) > String(anio) ? 12 : c.vigencia_fin.slice(0, 4) < String(anio) ? 0 : Number(c.vigencia_fin.slice(5, 7));
  return { desde: ini, hasta: fin, n: Math.max(0, fin - ini + 1) };
}

// hoy: fecha de corte (Date). Devuelve un objeto por contrato con todas las columnas de la cédula.
export function calcularContrato(c, { facturas = [], ampliaciones = [], devengos = [], programado = [] }, hoy = new Date(), anio = ANIO) {
  const amp = ampliaciones.reduce((s, a) => s + num(a.importe), 0);
  const maxU = num(c.monto_maximo), enlace = maxU + amp;
  const mensual = Array(13).fill(0);           // facturado 2026 por mes (no pasivo)
  let facturado = 0, pagos = 0, pasivo = 0;
  for (const f of facturas) {
    const imp = num(f.importe_factura); facturado += imp;
    if (f.estatus_general === "gasto_reflejado") pagos += imp;
    if (f.es_pasivo) { pasivo += imp; continue; }
    const { a, m } = mesDe(f); if (a === anio && m >= 1 && m <= 12) mensual[m] += imp;
  }
  const devCapt = Array(13).fill(0);
  for (const d of devengos) if (num(d.anio_presupuestal) === anio && d.mes_presupuestal >= 1 && d.mes_presupuestal <= 12) devCapt[d.mes_presupuestal] += num(d.importe);
  const devengoMes = devCapt.map((v, m) => (m === 0 ? 0 : Math.max(0, v - mensual[m])));
  const devengo = devengoMes.reduce((s, v) => s + v, 0);
  const facDev = facturado + devengo;
  const saldo = enlace - facDev;
  const avance = enlace ? facDev / enlace : 0;
  // Proyección
  const vig = mesesVigenciaEnAnio(c, anio);
  const mesHoy = hoy.getFullYear() > anio ? 12 : hoy.getFullYear() < anio ? 0 : hoy.getMonth() + 1;
  const transcurridos = Math.max(0, Math.min(vig.hasta, mesHoy) - vig.desde + 1);
  let base = 0; for (let m = vig.desde; m <= Math.min(vig.hasta, mesHoy); m++) base += mensual[m] + devengoMes[m];
  const promedio = transcurridos ? base / transcurridos : 0;
  const pasivoEnAnio = pasivo; // pasivo del año anterior cargado a este contrato
  const proyeccion = vig.n ? promedio * vig.n + pasivoEnAnio : facDev;
  const sobrante = enlace - proyeccion;
  // Programado (línea mensual)
  const prog = { "ESC 1": Array(13).fill(0), AMP: Array(13).fill(0) };
  for (const p of programado) if (num(p.anio) === anio && prog[p.escenario]) prog[p.escenario][p.mes] += num(p.importe);
  // Avisos
  const tope = maxU * num(c.tope_ampliacion_pct ?? 20) / 100;
  // El ajuste para igualar al dictamen FINAT no es ampliación del contrato: no cuenta para el tope
  const ampConvenio = ampliaciones.filter((a) => !String(a.nota || "").startsWith("Ajuste para igualar al dictamen FINAT")).reduce((s, a) => s + num(a.importe), 0);
  const diasVence = c.vigencia_fin ? Math.round((new Date(c.vigencia_fin + "T00:00:00") - hoy) / 86400000) : null;
  const avisos = [];
  if (enlace && avance >= 1) avisos.push({ nivel: "rojo", t: "Rebasa el importe del contrato" });
  else if (enlace && avance >= 0.8) avisos.push({ nivel: "ambar", t: `Lleva ${Math.round(avance * 100)}% del contrato` });
  if (enlace && sobrante < -0.5 && vig.n) avisos.push({ nivel: "rojo", t: "La proyección no alcanza: faltante" });
  if (diasVence != null && diasVence >= 0 && diasVence <= 30) avisos.push({ nivel: "ambar", t: `Vence en ${diasVence} días` });
  if (ampConvenio > tope + 0.5 && maxU) avisos.push({ nivel: "ambar", t: `Ampliación arriba del ${num(c.tope_ampliacion_pct ?? 20)}% del máximo` });
  // Sugerencia de devengo: promedio de los meses con factura, para los meses de vigencia ya transcurridos sin factura
  const conFactura = []; for (let m = vig.desde; m <= Math.min(vig.hasta, mesHoy); m++) if (mensual[m] > 0) conFactura.push(mensual[m]);
  const sugerido = conFactura.length ? conFactura.reduce((s, v) => s + v, 0) / conFactura.length : 0;
  return {
    maxC: num(c.importe_maximo_contrato), maxU, amp, enlace, pagos, facturado, devengo, facDev, saldo, avance,
    proyeccion, sobrante, pasivo, mensual, devCapt, devengoMes, prog, tope, diasVence, avisos, sugerido, vig, mesHoy,
  };
}

// Fase 3b · Dictamen del contrato según FINAT (IMKK036, tabla dictamen_saldos).
//   Asignado / pagado / disponible = renglones de la unidad 010102 (HGZ 2).
//   Pendiente = facturas sin pagar cuyo CR aún no está validado en FINAT (sin CR, N o E), descontando lo que
//   FINAT ya ejerció y SIGAF no marca, + devengo capturado. Los CR en V ya pasaron; los E se avisan aparte.
//   Si lo pendiente rebasa el disponible del HGZ 2: no va a pasar validación; si otras unidades
//   tienen disponible en el mismo dictamen, se puede pedir oficio de apoyo; si no, ampliación de dictamen.
export const UI_HGZ2 = "010102";
export function calcularDictamen(c, saldos = [], facturas = [], x = {}, dictamen = null, ppto = {}) {
  if (!c.dictamen_numero || !saldos.length) return null;
  const anioDic = Number(String(c.dictamen_numero).slice(-4)) || ANIO;
  const hg = saldos.filter((s) => s.ui === UI_HGZ2);
  const suma = (arr, k) => arr.reduce((t, s) => t + num(s[k]), 0);
  const asignado = suma(hg, "definitivo"), pagado = suma(hg, "pagos"), disponible = suma(hg, "disponible");
  const porUi = {};
  for (const s of saldos) if (s.ui !== UI_HGZ2) porUi[s.ui] = (porUi[s.ui] || 0) + num(s.disponible);
  const otras = Object.entries(porUi).map(([ui, d]) => ({ ui, disponible: Math.round(d * 100) / 100 })).filter((o) => o.disponible > 0.5).sort((a, b) => b.disponible - a.disponible);
  const otrasDisp = otras.reduce((t, o) => t + o.disponible, 0);
  // Facturas sin pagar en SIGAF, separadas por el estado presupuestal de su CR en FINAT (1043):
  //   V = ya validado (ya pasó; FINAT lo ejerce en el dictamen) · E = cayó en error · N / sin CR = falta validar.
  // Lo que FINAT ya ejerció y SIGAF no marca como pagado (adelanto) se aplica primero a los validados.
  const pagadoSigaf = facturas.filter((f) => f.estatus_general === "gasto_reflejado").reduce((t, f) => t + num(f.importe_factura), 0);
  const sinPagar = facturas.filter((f) => f.estatus_general !== "gasto_reflejado");
  const edo = (f) => (f.cr_contrarecibo && ppto[f.cr_contrarecibo]) || null;
  const validadas = sinPagar.filter((f) => edo(f) === "V"), enError = sinPagar.filter((f) => edo(f) === "E");
  const porValidar = sinPagar.filter((f) => edo(f) !== "V");
  const sumaF = (arr) => arr.reduce((t, f) => t + num(f.importe_factura), 0);
  const sinPagarSigaf = sumaF(sinPagar), impValidadas = sumaF(validadas), impError = sumaF(enError);
  const adelantoFinat = Math.max(0, pagado - pagadoSigaf);
  const pendFact = Math.max(0, sumaF(porValidar) - Math.max(0, adelantoFinat - impValidadas));
  const pendiente = pendFact + (anioDic === ANIO ? num(x.devengo) : 0);
  const faltante = pendiente - disponible;
  const avisos = [];
  if (enError.length) avisos.push({ nivel: "rojo", t: `${enError.length} CR con error de presupuesto en FINAT (${fmt(impError)}): ${enError.map((f) => f.cr_contrarecibo).join(", ")}` });
  if (faltante > 0.5) {
    const que = otrasDisp >= faltante ? `se puede pedir oficio de apoyo (otras unidades tienen ${fmt(otrasDisp)})`
      : otrasDisp > 0.5 ? `otras unidades solo tienen ${fmt(otrasDisp)}: pedir ampliación de dictamen`
      : "pedir ampliación de dictamen";
    avisos.push({ nivel: "rojo", t: `El dictamen no alcanza para lo pendiente: faltan ${fmt(faltante)}; ${que}` });
  }
  if (!c._pasivo && anioDic === ANIO && num(x.enlace) > 0 && Math.abs(asignado - num(x.enlace)) > 1)
    avisos.push({ nivel: "ambar", t: `El dictamen asigna ${fmt(asignado)} al HGZ 2 y el enlace en SIGAF es ${fmt(x.enlace)}` });
  return { numero: c.dictamen_numero, esPasivo: !!c._pasivo, corte: dictamen?.corte || null, origen: dictamen?.origen || null, asignado, pagado, disponible, otras, otrasDisp, sinPagarSigaf, adelantoFinat, validadas, impValidadas, enError, impError, pendFact, pendiente, faltante, avisos };
}
const fmt = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Suma de varios contratos (renglón TOTAL de cada partida)
export function sumar(lista) {
  const t = { maxC: 0, maxU: 0, amp: 0, enlace: 0, pagos: 0, facturado: 0, devengo: 0, facDev: 0, saldo: 0, proyeccion: 0, sobrante: 0, pasivo: 0, mensual: Array(13).fill(0), devengoMes: Array(13).fill(0) };
  for (const x of lista) {
    for (const k of ["maxC", "maxU", "amp", "enlace", "pagos", "facturado", "devengo", "facDev", "saldo", "proyeccion", "sobrante", "pasivo"]) t[k] += num(x[k]);
    for (let m = 1; m <= 12; m++) { t.mensual[m] += x.mensual[m]; t.devengoMes[m] += x.devengoMes[m]; }
  }
  t.avance = t.enlace ? t.facDev / t.enlace : 0;
  return t;
}
