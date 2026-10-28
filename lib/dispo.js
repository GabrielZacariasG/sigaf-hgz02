import * as XLSX from "xlsx";

// Unidad de información del HGZ No. 2 en el reporte IMKK022 (viene como 10102 o 010102).
export const UI_HGZ2 = "10102";

const num = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
};
const sinCeros = (v) => String(v ?? "").trim().replace(/^0+/, "");

// Lee el reporte FINAT "Disponibilidad Presupuestal" (IMKK022) en .csv/.xls/.xlsx
// y suma por cuenta SOLO la unidad de información 10102 (HGZ 2).
// El reporte completo trae TODAS las unidades (012409, 019001, ...): sin este filtro
// el presupuesto y el gasto salían inflados con los de otras unidades.
// Devuelve { fecha, cuentas, filasHgz2, filasOtras, error }.
export async function leerDispoIMKK022(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: true });
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });

  let fecha = null;
  for (let r = 0; r < Math.min(grid.length, 10) && !fecha; r++) {
    for (const c of grid[r] || []) {
      const m = String(c).match(/Fecha Ejec:\s*(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) { fecha = `${m[3]}-${m[2]}-${m[1]}`; break; }
    }
  }

  let hdr = -1;
  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    if ((grid[r] || []).some((c) => String(c).trim().toLowerCase() === "cuenta")) { hdr = r; break; }
  }
  if (hdr < 0) return { fecha, cuentas: null, filasHgz2: 0, filasOtras: 0, error: "No encontré la fila de encabezado 'Cuenta'. ¿Es el reporte de disponibilidad IMKK022?" };

  const enc = (grid[hdr] || []).map((c) => String(c).trim().toLowerCase());
  const col = (re, def) => { const i = enc.findIndex((t) => re.test(t)); return i >= 0 ? i : def; };
  const cUI = col(/^uni\.?\s*inform/, 3);
  const cPres = col(/^presupuesto/, 6), cGas = col(/^gasto/, 7), cComp = col(/^comprometido/, 8), cPre = col(/^precomprometido/, 9), cDisp = col(/^disponible/, 10);

  const agg = new Map();
  let filasHgz2 = 0, filasOtras = 0;
  for (let r = hdr + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const cta = String(row[0] ?? "").trim();
    if (!/^\d{6,}$/.test(cta)) continue;
    if (sinCeros(row[cUI]) !== UI_HGZ2) { filasOtras++; continue; }
    filasHgz2++;
    const o = agg.get(cta) || { cuenta: cta, presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 };
    o.presupuesto += num(row[cPres]); o.gasto += num(row[cGas]); o.comprometido += num(row[cComp]);
    o.precomprometido += num(row[cPre]); o.disponible += num(row[cDisp]);
    agg.set(cta, o);
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  const cuentas = [...agg.values()].map((o) => ({ ...o, presupuesto: r2(o.presupuesto), gasto: r2(o.gasto), comprometido: r2(o.comprometido), precomprometido: r2(o.precomprometido), disponible: r2(o.disponible) }));
  if (!cuentas.length) return { fecha, cuentas: null, filasHgz2, filasOtras, error: `El archivo no trae renglones de la unidad ${UI_HGZ2} (HGZ 2).` };
  return { fecha, cuentas, filasHgz2, filasOtras, error: null };
}
