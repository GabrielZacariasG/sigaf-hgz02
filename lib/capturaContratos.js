// Captura ejecutiva de saldos de contratos (6/11/2026): la imagen que se manda los viernes a las autoridades del HGZ 2
// con el devengado de subrogados. Antes se recortaba del Excel "AVANCE CONTRATOS SMS"; ahora sale de SIGAF con el
// gasto al día (facturado + devengo de folios). Se dibuja en un canvas (sin librerías) y se copia al portapapeles
// para pegarla directo en el correo; si el navegador no deja copiar, se descarga como PNG.
//
// filas: [{ c, x }] de la pantalla Contratos (c = contrato, x = calcularContrato).

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const MES = ["", "ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const fechaLarga = (d) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

// Estado del contrato según lo gastado contra su importe máximo (con ampliación)
export function estadoContrato(x) {
  if (!x.enlace) return { t: "Sin importe", color: "#6b7280", fondo: "#f3f4f6" };
  if (x.saldo < -0.5) return { t: "Sobre ejercicio", color: "#b42318", fondo: "#fde8e7" };
  if (x.avance >= 0.95) return { t: "Agotado", color: "#b42318", fondo: "#fde8e7" };
  if (x.avance >= 0.8) return { t: "Por agotarse", color: "#9a6700", fondo: "#fff4d6" };
  return { t: "Con saldo", color: "#1a6b3c", fondo: "#e6f4ea" };
}

const vigenciaTxt = (c) => {
  const i = String(c.vigencia_inicio || ""), f = String(c.vigencia_fin || "");
  if (!i || !f) return "Sin vigencia";
  const mi = Number(i.slice(5, 7)), mf = Number(f.slice(5, 7)), ai = i.slice(0, 4), af = f.slice(0, 4);
  return ai === af ? `${MES[mi]}–${MES[mf]} ${af}` : `${MES[mi]} ${ai}–${MES[mf]} ${af}`;
};

// Parte un texto en renglones que quepan en `ancho` (máximo `max` renglones, el último con "…")
function renglones(ctx, texto, ancho, max = 2) {
  const palabras = String(texto || "—").replace(/\s+/g, " ").trim().split(" ");
  const out = []; let linea = "";
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho) { linea = prueba; continue; }
    if (linea) out.push(linea); linea = p;
    if (out.length === max) break;
  }
  if (out.length < max && linea) out.push(linea);
  if (out.length === max && palabras.join(" ") !== out.join(" ")) {
    let u = out[max - 1]; while (u && ctx.measureText(u + "…").width > ancho) u = u.slice(0, -1); out[max - 1] = u + "…";
  }
  return out;
}

export function dibujarCaptura(filas, { titulo = "Saldos de contratos de servicios médicos subrogados", hoy = new Date() } = {}) {
  const ESC = 2;
  const COLS = [
    { k: "vig", t: "Vigencia", w: 110, al: "c" },
    { k: "cta", t: "Cuenta FINAT", w: 96, al: "c" },
    { k: "par", t: "Partida", w: 300, al: "l" },
    { k: "pro", t: "Proveedor", w: 270, al: "l" },
    { k: "max", t: "Importe máximo HGZ 2", w: 150, al: "r" },
    { k: "gas", t: "Total del gasto", w: 150, al: "r" },
    { k: "sal", t: "Saldo", w: 150, al: "r" },
    { k: "ava", t: "Avance", w: 250, al: "l" },
  ];
  const M = 24, W = COLS.reduce((t, c) => t + c.w, 0) + M * 2;
  const FILA = 44, ENC = 40;
  const lista = filas.slice().sort((a, b) => String(a.c.vigencia_inicio || "").localeCompare(String(b.c.vigencia_inicio || "")) || String(a.c.partidas?.cuenta_finat || "").localeCompare(String(b.c.partidas?.cuenta_finat || "")));
  const tot = lista.reduce((t, { x }) => ({ max: t.max + (x.enlace || 0), gas: t.gas + (x.facDev || 0), sal: t.sal + (x.saldo || 0) }), { max: 0, gas: 0, sal: 0 });
  const est = lista.map(({ x }) => estadoContrato(x).t);
  const nSobre = est.filter((e) => e === "Sobre ejercicio").length, nAgot = est.filter((e) => e === "Agotado").length, nPor = est.filter((e) => e === "Por agotarse").length;

  const ALTO_CAB = 118, ALTO_PIE = 52;
  const H = ALTO_CAB + ENC + lista.length * FILA + FILA + ALTO_PIE;
  const cv = document.createElement("canvas"); cv.width = W * ESC; cv.height = H * ESC;
  const ctx = cv.getContext("2d"); ctx.scale(ESC, ESC);
  const F = (peso, tam) => `${peso} ${tam}px Calibri, "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

  // Encabezado: título, fecha y resumen
  ctx.fillStyle = "#1f2937"; ctx.font = F(700, 21); ctx.textBaseline = "alphabetic";
  ctx.fillText(titulo, M, 36);
  ctx.fillStyle = "#4b5563"; ctx.font = F(400, 14);
  ctx.fillText(`HGZ No. 2 · Departamento de Finanzas · saldos al ${fechaLarga(hoy)}`, M, 58);
  const chips = [
    { t: `${lista.length} contratos`, color: "#1f2937", fondo: "#eef0f3" },
    { t: `${nSobre} con sobre ejercicio`, color: "#b42318", fondo: "#fde8e7" },
    { t: `${nAgot} agotados`, color: "#b42318", fondo: "#fde8e7" },
    { t: `${nPor} por agotarse (80% o más)`, color: "#9a6700", fondo: "#fff4d6" },
  ];
  let cx = M; ctx.font = F(700, 13.5);
  for (const ch of chips) {
    const w = ctx.measureText(ch.t).width + 22;
    ctx.fillStyle = ch.fondo; redondo(ctx, cx, 74, w, 26, 13); ctx.fill();
    ctx.fillStyle = ch.color; ctx.fillText(ch.t, cx + 11, 92); cx += w + 8;
  }

  // Encabezado de la tabla
  let y = ALTO_CAB;
  ctx.fillStyle = "#2f3b48"; ctx.fillRect(M, y, W - M * 2, ENC);
  ctx.fillStyle = "#ffffff"; ctx.font = F(700, 12.5);
  let x0 = M;
  for (const c of COLS) { celda(ctx, c.t.toUpperCase(), x0, y, c.w, ENC, c.al === "r" ? "r" : "c"); x0 += c.w; }
  y += ENC;

  // Renglones
  let grupoAnt = null;
  lista.forEach(({ c, x }, i) => {
    const e = estadoContrato(x);
    ctx.fillStyle = i % 2 ? "#f7f8fa" : "#ffffff"; ctx.fillRect(M, y, W - M * 2, FILA);
    const g = vigenciaTxt(c);
    if (grupoAnt !== null && g !== grupoAnt) { ctx.fillStyle = "#9aa5b1"; ctx.fillRect(M, y - 1, W - M * 2, 2); }
    let xx = M;
    for (const col of COLS) {
      ctx.fillStyle = "#1f2937"; ctx.font = F(400, 13);
      if (col.k === "vig") { ctx.font = F(g !== grupoAnt ? 700 : 400, 12.5); ctx.fillStyle = g !== grupoAnt ? "#1f2937" : "#9ca3af"; celda(ctx, g, xx, y, col.w, FILA, "c"); }
      else if (col.k === "cta") { ctx.font = F(700, 13); celda(ctx, c.partidas?.cuenta_finat || "—", xx, y, col.w, FILA, "c"); }
      else if (col.k === "par") { ctx.font = F(700, 12.5); texto2(ctx, c.concepto, xx, y, col.w, FILA); }
      else if (col.k === "pro") { ctx.font = F(400, 12.5); texto2(ctx, c.proveedores?.razon_social, xx, y, col.w, FILA); }
      else if (col.k === "max") {
        celda(ctx, money(x.enlace), xx, y - (x.amp ? 7 : 0), col.w, FILA, "r");
        if (x.amp) { ctx.font = F(400, 10.5); ctx.fillStyle = "#6b7280"; celda(ctx, `incl. ampliación ${money(x.amp)}`, xx, y + 9, col.w, FILA, "r"); }
      }
      else if (col.k === "gas") celda(ctx, money(x.facDev), xx, y, col.w, FILA, "r");
      else if (col.k === "sal") { ctx.font = F(700, 13); ctx.fillStyle = x.saldo < -0.5 ? "#b42318" : "#1f2937"; celda(ctx, money(x.saldo), xx, y, col.w, FILA, "r"); }
      else if (col.k === "ava") {
        const pct = Math.max(0, x.avance || 0), bw = 70, bx = xx + 12, by = y + FILA / 2 - 5;
        ctx.fillStyle = "#e5e7eb"; redondo(ctx, bx, by, bw, 10, 5); ctx.fill();
        ctx.fillStyle = e.color; if (pct > 0.005) { redondo(ctx, bx, by, Math.max(10, Math.min(1, pct) * bw), 10, 5); ctx.fill(); }
        ctx.font = F(700, 12.5); ctx.fillStyle = e.color; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(`${Math.round(pct * 100)}%`, bx + bw + 8, y + FILA / 2);
        ctx.font = F(700, 11); const tw = ctx.measureText(e.t).width + 14, tx = bx + bw + 48;
        ctx.fillStyle = e.fondo; redondo(ctx, tx, y + FILA / 2 - 10, tw, 20, 10); ctx.fill();
        ctx.fillStyle = e.color; ctx.fillText(e.t, tx + 7, y + FILA / 2 + 0.5);
      }
      xx += col.w;
    }
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M, y + FILA - 0.5); ctx.lineTo(W - M, y + FILA - 0.5); ctx.stroke();
    grupoAnt = g; y += FILA;
  });

  // Total
  ctx.fillStyle = "#eef0f3"; ctx.fillRect(M, y, W - M * 2, FILA);
  ctx.fillStyle = "#1f2937"; ctx.font = F(700, 13.5);
  const xMax = M + COLS.slice(0, 4).reduce((t, c) => t + c.w, 0);
  celda(ctx, "TOTAL", M, y, COLS.slice(0, 4).reduce((t, c) => t + c.w, 0) - 12, FILA, "r");
  celda(ctx, money(tot.max), xMax, y, COLS[4].w, FILA, "r");
  celda(ctx, money(tot.gas), xMax + COLS[4].w, y, COLS[5].w, FILA, "r");
  ctx.fillStyle = tot.sal < -0.5 ? "#b42318" : "#1f2937";
  celda(ctx, money(tot.sal), xMax + COLS[4].w + COLS[5].w, y, COLS[6].w, FILA, "r");
  const tp = tot.max ? tot.gas / tot.max : 0; ctx.fillStyle = "#1f2937";
  celda(ctx, `${Math.round(tp * 100)}%`, xMax + COLS[4].w + COLS[5].w + COLS[6].w, y, 82 + 12, FILA, "r");
  y += FILA;

  // Pie: de dónde salen los números
  ctx.fillStyle = "#6b7280"; ctx.font = F(400, 11.5); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText("Total del gasto = facturas registradas + devengo (folios de servicio emitidos sin facturar). Importe máximo incluye ampliaciones formalizadas.", M, y + 22);
  ctx.fillText("Fuente: SIGAF HGZ 2.", M, y + 38);
  return cv;
}

function celda(ctx, t, x, y, w, h, al) {
  ctx.textBaseline = "middle"; ctx.textAlign = al === "r" ? "right" : al === "c" ? "center" : "left";
  const px = al === "r" ? x + w - 12 : al === "c" ? x + w / 2 : x + 12;
  ctx.fillText(String(t), px, y + h / 2 + 0.5);
}
function texto2(ctx, t, x, y, w, h) {
  const ls = renglones(ctx, t, w - 24, 2);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const paso = 15, y0 = y + h / 2 - ((ls.length - 1) * paso) / 2;
  ls.forEach((l, i) => ctx.fillText(l, x + 12, y0 + i * paso + 0.5));
}
function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Copia la imagen al portapapeles (para pegar en Outlook) o la descarga si no se puede. Devuelve "copiada" o "descargada".
export async function copiarCaptura(cv, nombre = "saldos contratos.png") {
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("sin portapapeles");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "copiada";
  } catch {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return "descargada";
  }
}
