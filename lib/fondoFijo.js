// Fondo fijo: lectura de tablas, resumen mensual, proyección y liga con los comprobantes de OOAD.
import { numeroEnComprobante } from "./reembolsos";
import { folioNorm } from "./pliegosPrecarga";

export const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
export const COLUMNAS_MES = ["PASIVO", ...MESES];
// Las cuentas del resumen mensual, en el orden del Excel.
export const CUENTAS_RESUMEN = [
  { cuenta: "52411024", cc: "200905", nombre: "Pernoctas y boletos" },
  { cuenta: "51371004", cc: "200200", nombre: "Pasajes al personal CC 200200" },
  { cuenta: "51371004", cc: "340909", nombre: "Pasajes al personal CC 340909" },
  { cuenta: "51371007", cc: "141901", nombre: "Viáticos" },
  { cuenta: "51371005", cc: "141901", nombre: "Pasajes terrestres nacionales" },
  { cuenta: "51391001", cc: "200200", nombre: "Derechos federales, estatales y municipales" },
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const money = (n) => "$" + (Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// Topes del fondo fijo (procedimiento IMSS 6B13-003-002). Si el fondo se modifica, cambia FONDO_AUTORIZADO.
export const FONDO_AUTORIZADO = 47840;      // importe autorizado del recibo resguardo
export const TOPE_REEMBOLSO = 0.5;          // ningún reembolso excede el 50% del fondo (§5.2.2.2.1.5)
export const MAX_REEMBOLSOS_MES = 8;        // máximo 8 reembolsos ordinarios al mes
export const TOPE_POR_DOCUMENTO = 2000;     // $2,000 IVA incl. por documento; los pliegos/viáticos están exentos

// Control del fondo: saldo revolvente, índice de revolvencia mensual y alertas normativas.
export function controlFondo(gastos, reembolsos, fondo = FONDO_AUTORIZADO, anio = new Date().getFullYear(), hoy = hoyLocal()) {
  const vivos = gastos.filter((g) => !g.anulado);
  const reemb = reembolsos.filter((r) => r.estatus !== "cancelado");
  const enAnio = (f, mes) => { const s = String(f || ""); return Number(s.slice(0, 4)) === anio && (mes == null || Number(s.slice(5, 7)) === mes); };
  // Fuera de caja: lo que salió del fondo y todavía no regresa (sin CR = aún sin reponer).
  const porReembolsar = r2(vivos.filter((g) => !g.reembolso_id).reduce((s, g) => s + Number(g.total), 0));
  const enviadoSinCR = r2(reemb.filter((r) => !r.cr).reduce((s, r) => s + Number(r.total), 0));
  const disponible = r2(fondo - porReembolsar - enviadoSinCR);
  // Índice de revolvencia por mes (Anexo 12): Ir = Σ reembolsos del mes / fondo.
  const porMes = MESES.map((m, i) => {
    const suma = r2(reemb.filter((r) => enAnio(r.fecha, i + 1)).reduce((s, r) => s + Number(r.total), 0));
    return { mes: m, suma, ir: fondo ? Math.round((suma / fondo) * 1000) / 1000 : 0 };
  });
  const conDato = porMes.filter((x) => x.suma > 0);
  const promedioIr = conDato.length ? Math.round((conDato.reduce((s, x) => s + x.ir, 0) / conDato.length) * 1000) / 1000 : 0;
  // Conteo del mes en curso contra el máximo de 8.
  const mesActual = Number(hoy.slice(5, 7));
  const delMes = reemb.filter((r) => enAnio(r.fecha, mesActual));
  // Alertas normativas.
  const alertas = [];
  const topeReemb = r2(fondo * TOPE_REEMBOLSO);
  reemb.filter((r) => Number(r.total) > topeReemb).forEach((r) => alertas.push({ nivel: "rojo", t: `${r.solicitud} suma ${money(r.total)}, arriba del 50% del fondo (${money(topeReemb)}).` }));
  if (delMes.length > MAX_REEMBOLSOS_MES) alertas.push({ nivel: "rojo", t: `Van ${delMes.length} reembolsos este mes; el máximo ordinario es ${MAX_REEMBOLSOS_MES}.` });
  else if (delMes.length === MAX_REEMBOLSOS_MES) alertas.push({ nivel: "ambar", t: `Ya vas en el reembolso ${MAX_REEMBOLSOS_MES} del mes (el máximo ordinario).` });
  const docAlto = vivos.filter((g) => g.tipo === "OTRA" && Number(g.total) > TOPE_POR_DOCUMENTO);
  if (docAlto.length) alertas.push({ nivel: "ambar", t: `${docAlto.length} documento(s) de otras cuentas pasan de ${money(TOPE_POR_DOCUMENTO)} (tope de poca cuantía; los pliegos están exentos).` });
  if (disponible < 0) alertas.push({ nivel: "rojo", t: `El disponible está en negativo: ya salió más de lo autorizado. Hay que reponer.` });
  return { fondo, porReembolsar, enviadoSinCR, disponible, porMes, promedioIr, reembolsosMes: delMes.length, topeReemb, alertas };
}

// PostgREST entrega de 1000 en 1000.
export async function leerTodo(consulta) {
  const salida = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta().range(desde, desde + 999);
    if (error) throw error;
    salida.push(...(data || []));
    if (!data || data.length < 1000) return salida;
  }
}

export const mesDeFecha = (iso, anioActual = new Date().getFullYear()) => {
  if (!iso) return null;
  return Number(iso.slice(0, 4)) < anioActual ? "PASIVO" : MESES[Number(iso.slice(5, 7)) - 1];
};
export const mesDe = (g) => g.mes_gasto || mesDeFecha(g.fecha);
export const claveGasto = (tipo, folio, anio, proveedor) => {
  const k = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (tipo === "PLIEGO") return `PLIEGO|${folioNorm(folio)}|${anio}`;
  if (tipo === "PERNOCTA" || tipo === "BOLETO") return `T|${k(folio)}|${anio}`;
  if (tipo === "OTRA") return `OTRA|${k(proveedor)}|${k(folio)}|${anio}`;
  return `PASAJE|${k(folio)}|${anio}`;
};
// Lo que revisarPliego necesita saber de lo ya capturado.
export const pliegoParaFiltro = (g) => ({ id: g.id, folio: g.folio, folioNorm: folioNorm(g.folio), anio: String(g.anio ?? ""), matricula: g.matricula, fecha: g.fecha, destino: g.destino, importe: Number(g.importe), total: Number(g.total) });
export const gastoParaFiltro = (g) => ({ id: g.id, tipo: g.tipo, folio: g.folio, nss: g.nss, de: g.de, al: g.al, proveedor: g.proveedor, importe: Number(g.total) });
// Lo que armarReembolso necesita: el importe de la relación es el total del comprobante (cuota + casetas).
export const gastoParaReembolso = (g) => ({ id: g.id, tipo: g.tipo, folio: g.tipo === "PLIEGO" && !String(g.folio).includes("/") ? `${g.folio}/${g.anio}` : g.folio, fecha: g.fecha, importe: Number(g.total), cuenta: g.cuenta, cc: g.cc, reembolso: g.reembolso_id });

// Si a una persona del Informe le falta el importe de un solo folio, sale de su total menos lo demás.
export function deducirImportes(items, capturados = []) {
  const porPersona = {};
  items.forEach((it) => { if (it.totalPersona != null && it.matricula) (porPersona[it.matricula] ||= []).push(it); });
  return items.map((it) => {
    if (it.importe != null || it.totalPersona == null || !it.matricula) return it;
    const suyos = porPersona[it.matricula];
    const sinImporte = suyos.filter((x) => x.importe == null);
    if (sinImporte.length !== 1 || suyos.length !== it.foliosPersona) return it;
    const otros = suyos.filter((x) => x !== it).reduce((s, x) => s + (x.importe || 0) + (x.casetas || 0), 0);
    const yaCapturados = capturados.filter((c) => c.matricula === it.matricula && suyos.some((x) => x.clave === folioNorm(c.folio))).reduce((s, c) => s + Number(c.total || 0), 0);
    const importe = r2(it.totalPersona - Math.max(otros, yaCapturados));
    return importe > 0 ? { ...it, importe, deducido: `Total de la persona ${money(it.totalPersona)} menos sus otros folios ${money(Math.max(otros, yaCapturados))}` } : it;
  });
}

// Ejercido por cuenta y mes, junto a lo que dice la disponibilidad.
export function resumenMensual(gastos, dispo) {
  const vivos = gastos.filter((g) => !g.anulado);
  const extras = [...new Set(vivos.map((g) => `${g.cuenta}|${g.cc}`))].filter((k) => !CUENTAS_RESUMEN.some((c) => `${c.cuenta}|${c.cc}` === k) && /^\d{8}\|/.test(k)).map((k) => { const [cuenta, cc] = k.split("|"); return { cuenta, cc, nombre: "Otra cuenta" }; });
  return [...CUENTAS_RESUMEN, ...extras].map((c) => {
    const suyos = vivos.filter((g) => g.cuenta === c.cuenta && (g.cc || "") === c.cc);
    const ejercido = {}, sistema = {}, disponible = {};
    suyos.forEach((g) => { const m = mesDe(g) || "PASIVO"; ejercido[m] = r2((ejercido[m] || 0) + Number(g.total)); });
    let presupuesto = 0, gasto = 0, saldo = 0;
    dispo.filter((d) => d.cuenta_finat === c.cuenta && d.centro_costo === c.cc).forEach((d) => {
      const mes = MESES[Number(String(d.periodo).slice(-2)) - 1];
      if (mes) { sistema[mes] = r2((sistema[mes] || 0) + Number(d.gasto)); disponible[mes] = r2((disponible[mes] || 0) + Number(d.disponible)); }
      presupuesto += Number(d.presupuesto); gasto += Number(d.gasto); saldo += Number(d.disponible);
    });
    return { ...c, ejercido, sistema, disponible, total: r2(Object.values(ejercido).reduce((s, n) => s + n, 0)), presupuesto: r2(presupuesto), gastoSistema: r2(gasto), saldo: r2(saldo) };
  });
}

// Proyección al cierre. Devengo pendiente = pagado por el fondo y todavía sin CR.
export function proyeccion(renglon, gastos, reembolsos, hoy = hoyLocal()) {
  const mesActual = Number(hoy.slice(5, 7));
  const conCR = new Set(reembolsos.filter((r) => r.cr && r.estatus !== "cancelado").map((r) => r.id));
  const suyos = gastos.filter((g) => !g.anulado && g.cuenta === renglon.cuenta && (g.cc || "") === renglon.cc);
  const pendiente = r2(suyos.filter((g) => !conCR.has(g.reembolso_id)).reduce((s, g) => s + Number(g.total), 0));
  const delAnio = suyos.filter((g) => mesDe(g) !== "PASIVO");
  const completos = Math.max(mesActual - 1, 1);
  const hastaMesPasado = delAnio.filter((g) => MESES.indexOf(mesDe(g)) < completos).reduce((s, g) => s + Number(g.total), 0);
  const promedio = r2(hastaMesPasado / completos);
  const saldo = r2(renglon.presupuesto - renglon.gastoSistema - pendiente);
  const faltan = 12 - mesActual + 1;
  const necesidad = r2(promedio * faltan);
  return { presupuesto: renglon.presupuesto, gasto: renglon.gastoSistema, pendiente, saldo, promedio, cobertura: promedio ? Math.round((saldo / promedio) * 10) / 10 : null, avance: renglon.presupuesto ? Math.round((renglon.gastoSistema / renglon.presupuesto) * 1000) / 10 : null, faltan, necesidad, resultado: r2(saldo - necesidad) };
}

// Liga cada reembolso con su comprobante: primero por CR guardado; si no, por el texto "V OCT 05 - 114/2026".
export function ligarComprobantes(reembolsos, renglones) {
  const porCbte = new Map();
  renglones.forEach((c) => { if (!porCbte.has(c.cbte)) porCbte.set(c.cbte, { cbte: c.cbte, texto: c.factura_txt, importe: Number(c.importe) || 0, entrada: c.estado_entrada, pago: c.estado_pago, programado: c.fecha_prog_pago, emision: c.fecha_emision }); });
  const comps = [...porCbte.values()];
  const dig = (s) => String(s || "").replace(/\D/g, "").replace(/^0+/, "");
  return new Map(reembolsos.map((r) => {
    const porCR = r.cr ? comps.find((c) => dig(c.cbte) === dig(r.cr)) : null;
    const porTexto = porCR ? null : comps.filter((c) => {
      const n = numeroEnComprobante(c.texto);
      return n && r.numero === n.numero && String(r.anio) === n.anio && String(c.texto).trim().toUpperCase()[0] === r.prefijo && c.entrada !== "X";
    });
    const c = porCR || (porTexto && porTexto.length === 1 ? porTexto[0] : null);
    if (!c) return [r.id, null];
    const avisos = [];
    if (c.entrada === "X") avisos.push("El CR está eliminado en OOAD.");
    if (Math.abs(c.importe - Number(r.total)) > 0.01) avisos.push(`OOAD tiene ${money(c.importe)} y aquí suma ${money(r.total)}.`);
    return [r.id, { ...c, avisos, nuevo: !porCR }];
  }));
}
