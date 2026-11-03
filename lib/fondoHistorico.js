// Lee el Excel "PAGO X FONDO FIJO" completo para cargarlo a SIGAF. Se procesa en el navegador: los datos
// personales no pasan por el repositorio. No corrige nada del Excel; lo que no cuadra lo lista en "avisos".
import { DESTINOS } from "./pliegos";
import { destinoDe, folioNorm } from "./pliegosPrecarga";
import { TIPOS_GASTO, cuotaPernocta } from "./reembolsos";

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const nk = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const txt = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const num = (v) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,\s]/g, "")) || 0);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fecha = (v) => (typeof v === "number" && v > 30000 ? new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) : null);
const hora = (v) => { if (typeof v !== "number") return null; const m = Math.round((v % 1) * 1440) % 1440; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
const mesTexto = (v) => { const k = nk(v); return k === "PASIVO" || MESES.includes(k) ? k : null; };
const hoja = (wb, nombre) => { const h = wb.SheetNames.find((n) => nk(n).startsWith(nk(nombre))); return h ? wb.Sheets[h] : null; };

// CD01/2026, "CD 114" y "CD 089/2026" son la misma forma: CD114/2026.
export function normalizarSolicitud(texto, anioBase = 2026) {
  const t = txt(texto).toUpperCase();
  const m = /^(CD|STP)\s*0*(\d+)(?:\s*\/\s*(\d{4}))?/.exec(t);
  if (!m) return { solicitud: t, serie: "OTRA", numero: null, anio: anioBase };
  const anio = Number(m[3] || anioBase), numero = Number(m[2]);
  return { solicitud: `${m[1]}${String(numero).padStart(3, "0")}/${anio}`, serie: m[1], numero, anio };
}
const crNorm = (v) => { const d = String(v ?? "").replace(/\D/g, ""); return d ? d.padStart(8, "0") : null; };
const destinoCatalogo = (lugar) => {
  const d = destinoDe(lugar); if (d) return d;
  const k = nk(lugar);
  return DESTINOS.find((x) => nk(x.nombre) === k || k.startsWith(nk(x.nombre.split(/[ ,]/)[0])))?.nombre || txt(lugar);
};

export function leerHistorico(XLSX, wb) {
  const avisos = [], claves = new Map(), reembolsos = new Map(), gastos = [];
  const grid = (ws) => (ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) : []);
  const unica = (base) => { const n = (claves.get(base) || 0) + 1; claves.set(base, n); return n === 1 ? base : `${base}|H${n}`; };
  const delReembolso = (id, cr, datos, prefijo) => {
    const s = normalizarSolicitud(id);
    let llave = s.solicitud;
    const previo = reembolsos.get(llave);
    if (previo && previo.cr && cr && previo.cr !== cr) { avisos.push(`${llave} aparece con dos CR (${previo.cr} y ${cr}); se cargan aparte.`); llave = `${llave}-B`; }
    const r = reembolsos.get(llave) || { solicitud: llave, serie: s.serie, numero: s.numero, anio: s.anio, prefijo, cr: null, fecha_ingreso: null, fecha_prob_pago: null, ref_bancaria: null, total_excel: 0, estatus: "enviado", origen: "historico" };
    r.cr = r.cr || cr;
    r.fecha_ingreso = r.fecha_ingreso || datos.ingreso || null;
    r.fecha_prob_pago = r.fecha_prob_pago || datos.prob || null;
    r.ref_bancaria = r.ref_bancaria || datos.ref || null;
    r.total_excel = r2(r.total_excel + (datos.total || 0));
    if (/CANCELADO/i.test(String(datos.ref || ""))) r.estatus = "cancelado";
    reembolsos.set(llave, r);
    return llave;
  };

  // ---------- Pliegos ----------
  const gp = grid(hoja(wb, "1007 PLIEGOS"));
  const pliegos = gp.slice(1).map((f, i) => ({ f, fila: i + 2 })).filter((x) => txt(x.f[6]) && txt(x.f[7]));
  const gruposP = [];
  let grupo = null;
  for (const x of pliegos) {
    if (txt(x.f[0])) { grupo = { llave: delReembolso(x.f[0], crNorm(x.f[1]), { ingreso: fecha(x.f[2]), prob: fecha(x.f[3]), ref: txt(x.f[4]), total: num(x.f[22]) }, "V"), total: num(x.f[22]), filas: [] }; gruposP.push(grupo); }
    (grupo ? grupo.filas : []).push(x);
  }
  // El Excel solo marca el primer renglón de cada reembolso. Si la suma alcanza lo reembolsado antes de
  // terminar (el último grupo), lo que sigue todavía no se ha reembolsado.
  const reembolsoDePliego = new Map();
  gruposP.forEach((g, n) => {
    let suma = 0, corte = g.filas.length;
    if (n === gruposP.length - 1 && g.total) g.filas.some((x, i) => { suma = r2(suma + num(x.f[21])); if (Math.abs(suma - g.total) < 0.01) { corte = i + 1; return true; } return false; });
    g.filas.forEach((x, i) => { if (i < corte) reembolsoDePliego.set(x.fila, g.llave); });
  });
  for (const x of pliegos) {
    const f = x.f, fv = fecha(f[11]), anio = Number(String(fv || "").slice(0, 4)) || 2026, folio = txt(f[6]).toUpperCase();
    const total = r2(num(f[21])), importe = r2(num(f[16])), casetas = r2(num(f[17]));
    if (Math.abs(total - importe - casetas) > 0.01) avisos.push(`Pliego ${folio}: total ${total} distinto de importe + casetas (${r2(importe + casetas)}).`);
    gastos.push({
      clave: unica(`PLIEGO|${folioNorm(folio)}|${anio}`), tipo: "PLIEGO", folio, anio, fecha: fv, mes_gasto: mesTexto(f[10]), importe, casetas, boletos: 0, anticipo: r2(num(f[15])), total,
      cuenta: TIPOS_GASTO.PLIEGO.cuenta, cc: TIPOS_GASTO.PLIEGO.cc, matricula: txt(f[7]), persona: txt(f[8]), turno: txt(f[9]), destino: destinoCatalogo(f[14]),
      salida: hora(f[30]), llegada: hora(f[31]), salida_destino: hora(f[32]), regreso: hora(f[33]), cuota: typeof f[36] === "number" ? r2(f[36]) : null,
      infarto: txt(f[27]) || null, paciente: txt(f[25]) || null, especialidad: txt(f[26]) || null, tp01: txt(f[28]) || null, recibido: fecha(f[12]), fecha_pago: fecha(f[13]), observaciones: txt(f[24]) || null,
      _reembolso: reembolsoDePliego.get(x.fila) || null, origen: "historico",
    });
  }

  // ---------- Pernoctas y boletos ----------
  grupo = null;
  const gt = grid(hoja(wb, "52411024 PERNOCTAS"));
  gt.slice(1).map((f, i) => ({ f, fila: i + 2 })).filter((x) => txt(x.f[14]) || txt(x.f[16])).forEach((x) => {
    const f = x.f;
    if (txt(f[0])) grupo = delReembolso(f[0], crNorm(f[1]), { ingreso: fecha(f[2]), prob: fecha(f[3]), ref: txt(f[4]), total: num(f[19]) }, "T");
    const de = fecha(f[11]), al = fecha(f[12]), pago = fecha(f[13]), importe = r2(num(f[18])), folio = txt(f[7]);
    const dias = de && al ? Math.round((new Date(al) - new Date(de)) / 86400000) + 1 : null;
    const conCuota = [113.14, 117.31].some((c) => dias && Math.abs(r2(c * dias) - importe) < 0.02) || !!(cuotaPernocta(de, al) && Math.abs(cuotaPernocta(de, al).importe - importe) < 0.02);
    const tipo = conCuota ? "PERNOCTA" : "BOLETO";
    const anio = Number(String(pago || de || "").slice(0, 4)) || 2026;
    const clave = `T|${nk(folio)}|${anio}`;
    if (claves.has(clave)) avisos.push(`Folio TP07 ${folio} repetido (fila ${x.fila}): revisa que no se haya pagado dos veces.`);
    gastos.push({
      clave: unica(clave), tipo, folio, anio, fecha: pago, mes_gasto: mesTexto(f[9]), importe, casetas: 0, boletos: 0, anticipo: 0, total: importe, cuenta: "52411024", cc: "200905",
      destino: txt(f[6]) || null, unidad_origen: txt(f[10]) || null, de, al, dias, nss: txt(f[14]) || null, agregado: txt(f[15]) || null, paciente: txt(f[16]) || null, acompanante: txt(f[17]) || null,
      _reembolso: grupo, origen: "historico",
    });
  });

  // ---------- Pasajes al personal ----------
  grupo = null;
  const gx = grid(hoja(wb, "1004 PASAJES"));
  gx.slice(1).map((f, i) => ({ f, fila: i + 2 })).filter((x) => txt(x.f[9])).forEach((x) => {
    const f = x.f;
    if (txt(f[0])) grupo = delReembolso(f[0], crNorm(f[1]), { ingreso: fecha(f[2]), prob: fecha(f[3]), ref: fecha(f[4]) ? null : txt(f[4]), total: num(f[15]) }, "O");
    const a = r2(num(f[13])), b = r2(num(f[14])), folioBase = txt(f[5]).toUpperCase(), consec = txt(f[6]);
    const folio = folioBase === "TX" && consec ? `TX-${consec}` : folioBase || `SIN FOLIO ${x.fila}`;
    const pago = fecha(f[8]), anio = Number(String(pago || "").slice(0, 4)) || normalizarSolicitud(f[0] || "").anio;
    gastos.push({
      clave: unica(`PASAJE|${nk(folio)}|${anio}`), tipo: "PASAJE", folio, anio, fecha: pago, mes_gasto: mesTexto(f[7]), importe: r2(a + b), casetas: 0, boletos: 0, anticipo: 0, total: r2(a + b),
      cuenta: "51371004", cc: b ? "340909" : "200200", persona: txt(f[9]), matricula: txt(f[10]), dias: num(f[11]) || null, destino: txt(f[12]) || null, observaciones: txt(f[18]) || null,
      _reembolso: grupo, origen: "historico",
    });
  });

  // ---------- Otras cuentas ----------
  grid(hoja(wb, "OTRAS CUENTAS")).slice(1).map((f, i) => ({ f, fila: i + 2 })).filter((x) => txt(x.f[0]) && num(x.f[8])).forEach((x) => {
    const f = x.f, ref = txt(f[2]), importe = r2(num(f[8])), pago = fecha(f[3]), fact = fecha(f[4]), folio = txt(f[5]) || `SIN FOLIO ${x.fila}`;
    const llave = delReembolso(f[0], crNorm(f[1]), { ref, total: importe }, "O");
    const cuenta = txt(f[9]);
    if (!/^\d{8}$/.test(cuenta)) avisos.push(`Otra cuenta ${txt(f[0])}: la cuenta "${cuenta}" no es de 8 dígitos; se carga como está.`);
    const anio = Number(String(pago || fact || "").slice(0, 4)) || 2026;
    gastos.push({
      clave: unica(`OTRA|${nk(txt(f[6]))}|${nk(folio)}|${anio}`), tipo: "OTRA", folio, anio, fecha: pago, mes_gasto: null, importe, casetas: 0, boletos: 0, anticipo: 0, total: importe,
      cuenta, cc: txt(f[10]) || null, proveedor: txt(f[6]) || null, fecha_factura: fact, observaciones: txt(f[11]) || null, anulado: /CANCELADO/i.test(ref),
      _reembolso: llave, origen: "historico",
    });
  });

  // ---------- Totales de cada reembolso ----------
  const lista = [...reembolsos.values()].map((r) => {
    const suyos = gastos.filter((g) => g._reembolso === r.solicitud && !g.anulado);
    const fechas = suyos.map((g) => g.fecha).filter(Boolean).sort();
    const total = r2(suyos.reduce((s, g) => s + g.total, 0));
    if (r.estatus !== "cancelado" && r.total_excel && Math.abs(total - r.total_excel) > 0.01) avisos.push(`${r.solicitud}: el Excel dice reembolsado ${r.total_excel} y sus renglones suman ${total}.`);
    return { ...r, total, comprobantes: suyos.length, periodo_de: fechas[0] || null, periodo_al: fechas[fechas.length - 1] || null, fecha: r.fecha_ingreso || fechas[fechas.length - 1] || null };
  });

  // ---------- Plantilla y banco ----------
  const comisionados = grid(hoja(wb, "PLANTILLA COMISIONADOS")).slice(1).filter((f) => txt(f[0])).map((f) => ({ matricula: txt(f[0]), nombre: txt(f[1]), categoria: txt(f[2]) || null, clave_hora: txt(f[3]) || null, horario: txt(f[4]) || null, jornada: txt(f[5]) || null }));
  const banco = grid(hoja(wb, "BANCO")).slice(2).map((f, i) => ({ f, fila: i + 3 })).filter((x) => num(x.f[2]) || num(x.f[3])).map((x) => ({ clave: `H${x.fila}`, fecha_ingreso: fecha(x.f[0]), fecha_pago: fecha(x.f[1]), ingreso: r2(num(x.f[2])), egreso: r2(num(x.f[3])), concepto: txt(x.f[5]) || null }));

  const sinPlantilla = [...new Set(gastos.filter((g) => g.tipo === "PLIEGO" && !comisionados.some((c) => c.matricula === g.matricula)).map((g) => g.matricula))];
  if (sinPlantilla.length) avisos.push(`${sinPlantilla.length} matrícula(s) con pliegos que no están en la plantilla: ${sinPlantilla.join(", ")}.`);
  const porTipo = {};
  gastos.filter((g) => !g.anulado).forEach((g) => { porTipo[g.tipo] = porTipo[g.tipo] || { n: 0, total: 0 }; porTipo[g.tipo].n++; porTipo[g.tipo].total = r2(porTipo[g.tipo].total + g.total); });
  return { gastos, reembolsos: lista, comisionados, banco, avisos, porTipo, sinReembolso: gastos.filter((g) => !g._reembolso && !g.anulado).length };
}
