// Fase 3b · Lector del PDF de FINAT IMKK036 "Rep. Disponibilidad Dictamen" (29/10/2026).
// Corre en el navegador: saca el texto del PDF (flujos deflate) y el DETALLE DE SALDOS por
// unidad de información · centro · cuenta · periodo. Cada dictamen se valida contra su renglón TOTALES.
const num = (s) => Number(String(s).replace(/,/g, ""));
const nums = (s) => (String(s).match(/-?\d{1,3}(?:,\d{3})*\.\d{2}/g) || []).map(num);
const MESES = { ENE: 1, JAN: 1, FEB: 2, MAR: 3, ABR: 4, APR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12, DEC: 12 };

// Descomprime un flujo zlib; si trae basura al final, se queda con lo que alcanzó a salir.
async function inflar(bytes) {
  const ds = new DecompressionStream("deflate");
  const w = ds.writable.getWriter(); const r = ds.readable.getReader();
  w.write(bytes).catch(() => {}); w.close().catch(() => {});
  const partes = []; let total = 0;
  try { for (;;) { const { value, done } = await r.read(); if (done) break; partes.push(value); total += value.length; } } catch { /* fin con basura */ }
  if (!total) return null;
  const out = new Uint8Array(total); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

// Texto del PDF, una línea por renglón de texto (mismo criterio con que se validaron los 39 PDF del 29/10).
export async function textoPDF(buffer) {
  const b = new Uint8Array(buffer);
  const lat = new TextDecoder("latin1");
  const s = lat.decode(b);
  const out = []; const re = /stream\r?\n/g; let m;
  while ((m = re.exec(s))) {
    const st = m.index + m[0].length; const en = s.indexOf("endstream", st); if (en < 0) break;
    const dec = await inflar(b.slice(st, en)); if (!dec) continue;
    const txt = lat.decode(dec); if (!/T[Jj]/.test(txt)) continue;
    const lines = []; let cur = ""; const tk = /\[(.*?)\]\s*TJ|\((.*?)(?<!\\)\)\s*Tj|(T\*|Td|TD|Tm|ET)/g; let t;
    while ((t = tk.exec(txt))) {
      if (t[3]) { if (cur.trim()) lines.push(cur); cur = ""; continue; }
      if (t[1] !== undefined) cur += t[1].replace(/\((.*?)(?<!\\)\)|-?\d+(\.\d+)?/g, (a, p) => (p !== undefined ? p : Number(a) < -200 ? " " : ""));
      else cur += t[2];
    }
    if (cur.trim()) lines.push(cur);
    out.push(lines.join("\n"));
  }
  // Une los dígitos que el PDF parte en renglones sueltos y quita el escape de los paréntesis
  let o = "", prev = "";
  for (const l of out.join("\n=====\n").split("\n")) {
    const x = l.replace(/\\\(/g, "(").replace(/\\\)/g, ")");
    if (/^[0-9.,\-]$/.test(x.trim()) && /^[0-9.,\-]/.test(prev.trim())) o += x.trim(); else o += "\n" + x;
    prev = x;
  }
  return o;
}

// Lee un IMKK036 ya convertido a texto. Devuelve { dictamen, origen, fecha_dictamen, corte, ejec, filas, totales, ok, problema }.
export function leerIMKK036(texto) {
  const j = texto.split(/\r?\n/).join("|");
  const dictamen = (j.match(/Num\. Dictamen: \|(\d{10}-\d{4})/) || [])[1];
  if (!dictamen || !/IMKK036/.test(j)) return { ok: false, problema: "No es un IMKK036 (Rep. Disponibilidad Dictamen)." };
  const fe = j.match(/Fecha Ejec: \|(\d\d)-([A-Z]{3})-(\d{4})\|Hora: \|(\d\d):(\d\d) ([AP])M/);
  const h = fe ? (Number(fe[4]) % 12) + (fe[6] === "P" ? 12 : 0) : 0;
  const corte = fe ? `${fe[3]}-${String(MESES[fe[2]] || 1).padStart(2, "0")}-${fe[1]}` : null;
  const ejec = fe ? `${corte}T${String(h).padStart(2, "0")}:${fe[5]}` : null;
  const origen = (j.match(/Origen: \|([A-Z]+)\|/) || [])[1] || null;
  const fd = j.match(/Fecha Dictamen: \|(\d\d)\/(\d\d)\/(\d{4})/);
  const base = { dictamen, origen, fecha_dictamen: fd ? `${fd[3]}-${fd[2]}-${fd[1]}` : null, corte, ejec };
  const ini = j.indexOf("DETALLE DE SALDOS"); const fin = ini >= 0 ? j.indexOf("TOTALES", ini) : -1;
  if (ini < 0 || fin < 0) return { ...base, ok: false, problema: "No trae DETALLE DE SALDOS." };
  const det = j.slice(ini, fin);
  const filas = []; const malos = [];
  // 01|UI|CENTRO|CUENTA|[COG|PRODUCTO|CF|]PROYECTO|AAAAMmm<previo aj.previo aj.post definitivo pagos>|(|n|)|<disponible><disp. acum>
  const re = /\|01\|(\d{6})\|(\w+)\|(\d{8})\|(?:[^|]*\|){0,4}?(\d{4})M(\d\d)([^|]*)\|\(\|(\d+)\|\)\|([^|]*)/g; let m;
  while ((m = re.exec(det))) {
    const a = nums(m[6]), b = nums(m[8]);
    if (a.length !== 5 || b.length < 2) { malos.push(`${m[1]} ${m[4]}M${m[5]}`); continue; }
    filas.push({ ui: m[1], centro: m[2], cuenta: m[3], anio: +m[4], mes: +m[5], previo: a[0], ajuste_previo: a[1], ajuste_post: a[2], definitivo: a[3], pagos: -a[4], cant_pagos: +m[7], disponible: b[0], disponible_acum: b[1] });
  }
  const tt = j.slice(fin + 7).match(/^\|([^|]*)\|\(\|(\d+)\|\)\|([^|]*)/);
  const tA = tt ? nums(tt[1]) : [], tB = tt ? nums(tt[3]) : [];
  const totales = { definitivo: tA[3], pagos: tA[4] != null ? -tA[4] : null, disponible: tB[0] };
  const s = (k) => Math.round(filas.reduce((x, r) => x + r[k], 0) * 100) / 100;
  const cuadra = tt && Math.abs(s("definitivo") - totales.definitivo) < 0.02 && Math.abs(s("pagos") - totales.pagos) < 0.02 && Math.abs(s("disponible") - totales.disponible) < 0.02;
  const problema = malos.length ? `No pude leer ${malos.length} renglón(es): ${malos.slice(0, 3).join(", ")}` : !cuadra ? `Los renglones no cuadran con TOTALES (definitivo ${s("definitivo")} vs ${totales.definitivo})` : null;
  return { ...base, filas, totales, ok: !problema, problema };
}

// Resumen de una unidad: asignado (definitivo), pagado y disponible
export function resumenUI(filas, ui) {
  const f = filas.filter((r) => r.ui === ui);
  const s = (k) => Math.round(f.reduce((x, r) => x + (Number(r[k]) || 0), 0) * 100) / 100;
  return { asignado: s("definitivo"), pagado: s("pagos"), disponible: s("disponible") };
}
