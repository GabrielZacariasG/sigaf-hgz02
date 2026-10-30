// Fase B · Folios de subrogados (30/10/2026)
// Cada solicitud de subrogación (folio) es un servicio que el HGZ 2 ya pidió al proveedor. Mientras no tenga factura
// es DEVENGO; cuando se liga a una factura queda FACTURADO; si se canceló (importe 0) queda CANCELADO.
// Fuentes:
//   · CD_SMS (sistema nuevo): "solicitudes_emitidas_….csv" — un renglón por folio y estudio (el CSV viene dentro de la página).
//   · Avance SMS (Excel del área): hojas por proveedor con Folio, Fecha, CURP, paciente, médico, Estudio 1-3, Importe,
//     Contrato, Mes, UMF, FACTURA, ESTATUS (la factura se capturaba a mano). Sirve para traer el historial.
import * as XLSX from "xlsx";

const N = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const num = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[$,\s]/g, "")) || 0);
const MESES = { ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12 };
const fechaISO = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
};
import { claveContrato, HOJAS_AVANCE, PEDIDO_A_SAI } from "./subrogadosComun";
export { claveContrato, HOJAS_AVANCE, PEDIDO_A_SAI };

// Clave única de un renglón: folio + estudio + número de repetición (por si el mismo folio trae el mismo estudio dos veces)
function conClaves(filas) {
  const vistos = {};
  return filas.map((f) => {
    const base = `${N(f.folio)}|${N(f.estudio).slice(0, 120)}`;
    vistos[base] = (vistos[base] || 0) + 1;
    return { ...f, clave: `${base}|${vistos[base]}` };
  });
}

// ---------- CD_SMS ----------
export function esCDSMS(texto) { return /Folio,Fecha,Contrato,Paciente,Medico,Estudio/i.test(texto); }
export function leerCDSMS(texto) {
  const i = texto.search(/Folio,Fecha,Contrato,Paciente/i);
  if (i < 0) return { error: "No encontré la tabla de folios (Folio,Fecha,Contrato,Paciente…)." };
  let csv = texto.slice(i); const f = csv.search(/<\/main>|<\/body>/i); if (f > 0) csv = csv.slice(0, f);
  const wb = XLSX.read(csv, { type: "string", raw: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
  const filas = rows.filter((r) => String(r.Folio || "").trim()).map((r) => {
    const fecha = fechaISO(r.Fecha);
    return {
      folio: String(r.Folio).trim(), fecha, anio: fecha ? +fecha.slice(0, 4) : null, mes: fecha ? +fecha.slice(5, 7) : null,
      contrato_txt: String(r.Contrato || "").replace(/\s+/g, "").trim(), paciente: String(r.Paciente || "").trim(),
      medico: String(r.Medico || "").trim(), estudio: String(r.Estudio || "").trim(), cantidad: num(r.Cantidad),
      costo_unitario: num(r["Costo unitario"]), importe: num(r.Importe), diagnostico: String(r.Diagnostico || "").trim(),
      motivo: String(r.Motivo || "").trim(), estatus_sistema: String(r.Estatus || "").trim(), cancelado: num(r.Importe) === 0,
      origen: "cd_sms",
    };
  });
  return { filas: conClaves(filas) };
}

// ---------- Avance SMS (historial con factura) ----------
export function esAvanceSMS(wb) { return wb.SheetNames.includes("avance") && Object.keys(HOJAS_AVANCE).some((h) => wb.SheetNames.includes(h)); }
export function leerAvanceSMS(wb) {
  const salida = [], resumen = [];
  for (const [hoja, contrato] of Object.entries(HOJAS_AVANCE)) {
    const ws = wb.Sheets[hoja]; if (!ws) continue;
    const g = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
    const hr = g.findIndex((r) => N(r[0]) === "FOLIO"); if (hr < 0) { resumen.push({ hoja, contrato, error: "sin encabezado Folio" }); continue; }
    const H = g[hr].map(N);
    const col = (re) => H.findIndex((h) => re.test(h));
    const c = { folio: 0, fecha: col(/^FECHA/), curp: col(/^CURP/), nom: col(/^NOMBRE PACIENTE/), ap: col(/PATERNO/), am: col(/MATERNO/),
      med: col(/^NOMBRE MEDICO/), mat: col(/^MATRICULA/), e1: col(/^ESTUDIO 1/), c1: col(/^CANTIDAD 1/), e2: col(/^ESTUDIO 2/), c2: col(/^CANTIDAD 2/),
      e3: col(/^ESTUDIO 3/), c3: col(/^CANTIDAD 3/), imp: col(/^IMPORTE/), con: col(/^CONTRATO/), mes: col(/^MES/), umf: col(/^UMF/),
      fac: col(/^FACTURA/), est: col(/^ESTATUS/) };
    let n = 0, fact = 0, dev = 0, canc = 0;
    for (let r = hr + 1; r < g.length; r++) {
      const x = g[r]; let folio = String(x[c.folio] ?? "").trim();
      if (N(folio) === "FOLIO") continue;
      const fecha = fechaISO(x[c.fecha]);
      // Renglón sin folio pero con importe (p. ej. dosimetría mensual): se identifica por contrato, mes e importe
      if (!folio) {
        const imp0 = c.imp >= 0 ? num(x[c.imp]) : 0; const m0 = c.mes >= 0 ? MESES[N(x[c.mes])] : null;
        if (!imp0 || !m0) continue;
        folio = `SIN FOLIO ${contrato} ${String(m0).padStart(2, "0")}/${fecha ? fecha.slice(0, 4) : "2026"}`;
      }
      // Renglones pegados del CD_SMS: en "CURP" viene el número de contrato y en "Contrato" el motivo
      const pegado = /^050GYR/i.test(String(x[c.curp] ?? "").trim());
      const est = (i, k) => (i >= 0 && String(x[i] ?? "").trim() ? `${String(x[i]).trim()}${k >= 0 && num(x[k]) > 1 ? ` (${num(x[k])})` : ""}` : "");
      const estudio = [est(c.e1, c.c1), est(c.e2, c.c2), est(c.e3, c.c3)].filter(Boolean).join(" + ");
      const importe = c.imp >= 0 ? num(x[c.imp]) : 0;
      const factura = c.fac >= 0 ? String(x[c.fac] ?? "").trim().replace(/\.0+$/, "") : "";
      const estatusTxt = c.est >= 0 ? N(x[c.est]) : "";
      const mesTxt = c.mes >= 0 ? N(x[c.mes]) : "";
      const cancelado = !factura && (importe === 0 || estatusTxt.startsWith("CANCEL"));
      if (!estudio && !importe && !factura) continue;
      salida.push({
        folio, fecha, anio: fecha ? +fecha.slice(0, 4) : null, mes: MESES[mesTxt] || (fecha ? +fecha.slice(5, 7) : null),
        contrato_txt: contrato, curp: pegado ? null : String(x[c.curp] ?? "").trim() || null,
        paciente: [x[c.nom], x[c.ap], x[c.am]].map((v) => String(v ?? "").trim()).filter(Boolean).join(" "),
        medico: String(x[c.med] ?? "").trim(), matricula_medico: pegado ? null : String(x[c.mat] ?? "").trim() || null,
        estudio, cantidad: c.c1 >= 0 ? num(x[c.c1]) : null, importe, umf: pegado ? null : String(x[c.umf] ?? "").trim() || null,
        motivo: pegado && c.con >= 0 ? String(x[c.con] ?? "").trim() : null,
        factura_txt: factura || null, cancelado, origen: "avance_sms", hoja,
      });
      n++; if (factura) fact++; else if (cancelado) canc++; else dev++;
    }
    resumen.push({ hoja, contrato, renglones: n, facturados: fact, devengo: dev, cancelados: canc });
  }
  return { filas: conClaves(salida), resumen };
}
