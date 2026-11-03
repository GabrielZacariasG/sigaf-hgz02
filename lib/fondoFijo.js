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
