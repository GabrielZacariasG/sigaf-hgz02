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

  const cCC = col(/^centro\s*costo/, 2), cProy = col(/^proyecto/, 4), cPer = col(/^periodo/, 5);

  const agg = new Map();      // por cuenta
  const porMes = new Map();   // por cuenta + periodo (2026M01..M12)
  const detalle = [];         // renglón por renglón (cuenta × CC × proyecto × periodo)
  let filasHgz2 = 0, filasOtras = 0;
  for (let r = hdr + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const cta = String(row[0] ?? "").trim();
    if (!/^\d{6,}$/.test(cta)) continue;
    if (sinCeros(row[cUI]) !== UI_HGZ2) { filasOtras++; continue; }
    filasHgz2++;
    const m = { presupuesto: num(row[cPres]), gasto: num(row[cGas]), comprometido: num(row[cComp]), precomprometido: num(row[cPre]), disponible: num(row[cDisp]) };
    const periodo = String(row[cPer] ?? "").trim();
    detalle.push({ cuenta_finat: cta, centro_costo: String(row[cCC] ?? "").trim(), proyecto: String(row[cProy] ?? "").trim(), periodo, ...m });
    for (const [mapa, k, base] of [[agg, cta, { cuenta: cta }], [porMes, `${cta}|${periodo}`, { cuenta_finat: cta, periodo }]]) {
      const o = mapa.get(k) || { ...base, presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 };
      for (const c of Object.keys(m)) o[c] += m[c];
      mapa.set(k, o);
    }
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  const red = (o) => ({ ...o, presupuesto: r2(o.presupuesto), gasto: r2(o.gasto), comprometido: r2(o.comprometido), precomprometido: r2(o.precomprometido), disponible: r2(o.disponible) });
  const cuentas = [...agg.values()].map(red);
  const mensual = [...porMes.values()].map(red);
  if (!cuentas.length) return { fecha, cuentas: null, mensual: null, detalle: null, filasHgz2, filasOtras, error: `El archivo no trae renglones de la unidad ${UI_HGZ2} (HGZ 2).` };
  return { fecha, cuentas, mensual, detalle: detalle.map(red), filasHgz2, filasOtras, error: null };
}

// Totales de un corte (para dispo_cortes)
export function totalesDispo(cuentas) {
  const t = { presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 };
  for (const c of cuentas) for (const k of Object.keys(t)) t[k] += Number(c[k]) || 0;
  for (const k of Object.keys(t)) t[k] = Math.round(t[k] * 100) / 100;
  return t;
}

// Guarda un corte completo en SIGAF: dispo_cortes + dispo_mensual (historia) y, si es el
// más reciente, reemplaza dispo_detalle_actual y la disponibilidad por cuenta del ejercicio.
// `supabase` se pasa desde la página. Devuelve { fecha, esUltimo }.
export async function guardarCorteDispo(supabase, lectura, archivo) {
  const { fecha, cuentas, mensual, detalle } = lectura;
  if (!fecha) throw new Error(`${archivo}: no trae la fecha del reporte ("Fecha Ejec:").`);
  const t = totalesDispo(cuentas);
  const { data: ult } = await supabase.from("dispo_cortes").select("fecha").order("fecha", { ascending: false }).limit(1);
  const esUltimo = !ult?.length || ult[0].fecha <= fecha;
  let e = (await supabase.from("dispo_cortes").upsert({ fecha, archivo, filas: detalle.length, ...t, cargado_at: new Date().toISOString() }, { onConflict: "fecha" })).error;
  if (e) throw new Error(`${archivo}: ${e.message}`);
  e = (await supabase.from("dispo_mensual").delete().eq("fecha", fecha)).error;
  if (e) throw new Error(`${archivo}: ${e.message}`);
  for (let i = 0; i < mensual.length; i += 1000) {
    e = (await supabase.from("dispo_mensual").insert(mensual.slice(i, i + 1000).map((m) => ({ fecha, ...m })))).error;
    if (e) throw new Error(`${archivo}: ${e.message}`);
  }
  if (esUltimo) {
    e = (await supabase.from("dispo_detalle_actual").delete().neq("cuenta_finat", "")).error;
    if (e) throw new Error(`${archivo}: ${e.message}`);
    for (let i = 0; i < detalle.length; i += 1000) {
      e = (await supabase.from("dispo_detalle_actual").insert(detalle.slice(i, i + 1000).map((d) => ({ fecha, ...d })))).error;
      if (e) throw new Error(`${archivo}: ${e.message}`);
    }
  }
  return { fecha, esUltimo, totales: t };
}
