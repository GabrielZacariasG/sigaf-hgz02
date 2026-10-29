// Fase 2 · Lectura del reporte de comprobantes N_AP_IMSS_1043 y cruce con las facturas de SIGAF.
//
// Reglas (aprendidas en la puesta al día del 29/10/2026):
//  · Un comprobante trae una línea por cuenta/unidad. Solo cuenta para el HGZ 2 si alguna línea es de la
//    unidad de información 010102 (o 019001, el pasivo central de los pedidos PREI). El folio 3979 de
//    Médica San Juan existía en la UI 010101 y NO era nuestro.
//  · En "Factura" el guion o la coma SEPARAN facturas ("21296-21320" son dos), no es un rango.
//    "20034-33-59" abrevia: 20034, 20033, 20059.
//  · Estado Entrada X = comprobante eliminado. Estado Pago P = pagado, N = no pagado.
//  · Nada se aplica solo si el importe no cuadra (±1 peso), si el folio es corto o si la factura ya trae
//    otro CR: eso va a "Por confirmar". Coincidencias por terminación de folio ("4122" ⊂ "63874122") NO cuentan.

export const UI_HGZ2 = "010102";
export const UI_PASIVO_CENTRAL = "019001";

const ORD_GEN = { capturada: 0, en_revision: 1, enviada_ooad: 2, en_tramite_ooad: 3, gasto_reflejado: 4 };

const num = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
};
const txt = (v) => String(v ?? "").trim();
const fecha = (v) => {
  if (typeof v === "number" && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const s = txt(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
};
export const crNum = (v) => txt(v).replace(/\D/g, "").replace(/^0+/, "");
const cents = (n) => Math.round(num(n) * 100);

// ---------- 1) Leer el reporte (grid = arreglo de renglones de la hoja) ----------
export function leerNAP1043(grid) {
  let hdr = -1;
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = (grid[r] || []).map((c) => txt(c).toLowerCase());
    if (row.includes("comprobante") && row.includes("factura") && row.some((h) => h.startsWith("estado pago"))) { hdr = r; break; }
  }
  if (hdr < 0) return { error: "No reconocí el reporte: debe ser el N_AP_IMSS_1043 (columnas Comprobante, Factura, Estado Pago)." };
  const H = (grid[hdr] || []).map((c) => txt(c).toLowerCase());
  const c = (nombre) => H.indexOf(nombre.toLowerCase());
  const col = {
    cbte: c("Comprobante"), usuario: c("Usuario"), tipo: c("Tipo Cbte"), stipo: c("STipo Cbte"), nprov: c("No. Proveedor"),
    prov: c("Nombre Proveedor"), contrato: c("Contrato"), fac: c("Factura"), femi: c("Fecha Emision"), ffac: c("Fecha Factura"),
    fprog: c("Fecha Prog Pago"), imp: c("Importe MXN"), ent: c("Estado Entrada"), ppto: c("Estado Ppto"), epago: c("Estado Pago"),
    linea: c("No. Línea Distribución"), ui: c("Unidad de Información"), cc: c("Centro Costo"), cuenta: c("Cuenta"),
    impc: c("Importe Cuenta"), fppto: c("Fecha Ppto"), pedido: c("Nº Pedido"), recep: c("No. Recepción"),
  };
  if (col.cbte < 0 || col.fac < 0 || col.ent < 0 || col.epago < 0) return { error: "Al reporte le faltan columnas (Comprobante, Factura, Estado Entrada o Estado Pago)." };
  const g = (row, k) => (col[k] >= 0 ? row[col[k]] : "");
  const filas = [];
  const nLinea = new Map(); // la "línea de distribución" se repite entre líneas de voucher: se numera en orden
  for (let r = hdr + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const cbte = txt(g(row, "cbte")); if (!/^\d{5,}$/.test(cbte)) continue;
    nLinea.set(cbte, (nLinea.get(cbte) || 0) + 1);
    filas.push({
      cbte, linea: nLinea.get(cbte),
      usuario: txt(g(row, "usuario")), tipo: `${txt(g(row, "tipo"))}/${txt(g(row, "stipo"))}`,
      no_proveedor: txt(g(row, "nprov")).replace(/^0+/, ""), proveedor: txt(g(row, "prov")), contrato: txt(g(row, "contrato")),
      factura_txt: txt(g(row, "fac")), fecha_emision: fecha(g(row, "femi")), fecha_factura: fecha(g(row, "ffac")),
      fecha_prog_pago: fecha(g(row, "fprog")), importe: num(g(row, "imp")),
      estado_entrada: txt(g(row, "ent")), estado_ppto: txt(g(row, "ppto")), estado_pago: txt(g(row, "epago")),
      ui: txt(g(row, "ui")).padStart(6, "0"), centro_costo: txt(g(row, "cc")), cuenta: txt(g(row, "cuenta")),
      importe_cuenta: num(g(row, "impc")), fecha_ppto: fecha(g(row, "fppto")),
      pedido: txt(g(row, "pedido")).replace(/^0+/, ""), recepcion: txt(g(row, "recep")).replace(/^0+/, ""),
    });
  }
  const emis = filas.map((f) => f.fecha_emision).filter(Boolean).sort();
  return { filas, desde: emis[0] || null, hasta: emis[emis.length - 1] || null };
}

// ---------- 2) Folios contenidos en el texto "Factura" ----------
// "(SEP) 21296-21320" → [21296, 21320] · "(ENE) 20034-33-59" → [20034, 20033, 20059]
// "(MAR) 20321,20359 (2)" → [20321, 20359] · "HD-9581" → [HD9581] · "(JUL) 46015679994" → [46015679994]
export function foliosDe(facturaTxt) {
  let s = txt(facturaTxt).toUpperCase()
    .replace(/^\s*(\((19|20)\d{2}\)|\([A-ZÑ]{3,10}\)|(19|20)\d{2}\s)\s*/g, "") // (2025) (SEP) (MARZO) o "2025 "
    .replace(/\(\d\)\s*$/, "")                                                    // "(2)" al final = número de facturas
    .replace(/\/(19|20)\d{2}\b/g, "")                                             // "16/2026" → "16"
    .replace(/^\s*(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)[A-Z]*\b\s*/, "");
  // Un prefijo de letras pegado con guion al número ("HD-9581", "SCXCFA-40511", "FA_26") se une, no separa.
  s = s.replace(/\b([A-Z]{1,8})[-_ ]+(?=\d)/g, "$1");
  const partes = s.split(/[-,;/\s]+|\bY\b/).map((p) => p.replace(/[^A-Z0-9]/g, "")).filter(Boolean);
  const out = [];
  let base = null;
  for (const p of partes) {
    const dig = p.replace(/\D/g, "");
    if (!dig) continue;
    const esSoloDig = /^\d+$/.test(p);
    if (esSoloDig && base && p.length < base.length && base.length - p.length <= 3) {
      out.push({ folio: base.slice(0, base.length - p.length) + p, abreviado: true });
    } else {
      out.push({ folio: p, abreviado: false });
      if (esSoloDig && p.length >= 4) base = p;
    }
  }
  return out;
}

// ---------- 3) Agrupar líneas por comprobante ----------
export function agruparComprobantes(filas) {
  const m = new Map();
  for (const f of filas) {
    let c = m.get(f.cbte);
    if (!c) {
      c = { cbte: f.cbte, no_proveedor: f.no_proveedor, proveedor: f.proveedor, factura_txt: f.factura_txt, importe: f.importe,
        estado_entrada: f.estado_entrada, estado_pago: f.estado_pago, fecha_emision: f.fecha_emision,
        fecha_prog_pago: f.fecha_prog_pago, pedido: f.pedido, recepcion: f.recepcion, lineas: [], uis: new Set(), cuentas: new Set(), impHGZ2: 0 };
      m.set(f.cbte, c);
    }
    c.lineas.push(f); c.uis.add(f.ui); c.cuentas.add(f.cuenta);
    if (f.ui === UI_HGZ2) c.impHGZ2 += f.importe_cuenta;
    if (!c.pedido && f.pedido) c.pedido = f.pedido;
    if (!c.recepcion && f.recepcion) c.recepcion = f.recepcion;
  }
  for (const c of m.values()) {
    c.esHGZ2 = c.uis.has(UI_HGZ2) || c.uis.has(UI_PASIVO_CENTRAL);
    c.eliminado = c.estado_entrada === "X";
    c.pagado = !c.eliminado && c.estado_pago === "P";
    c.folios = foliosDe(c.factura_txt);
    c.cuentasHGZ2 = [...new Set(c.lineas.filter((l) => l.ui === UI_HGZ2).map((l) => l.cuenta))];
  }
  return m;
}

// ---------- 4) Proveedor: ¿es el mismo? ----------
const STOP = new Set(["SA", "DE", "CV", "S", "A", "C", "V", "Y", "DEL", "LA", "LAS", "LOS", "EL", "SAPI", "RL", "SRL", "SC", "AC", "IAP", "AL", "EN", "E"]);
export function tokensProv(nombre) {
  return new Set(txt(nombre).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t)));
}
export function mismoProveedor(a, b) {
  const A = a instanceof Set ? a : tokensProv(a), B = b instanceof Set ? b : tokensProv(b);
  if (!A.size || !B.size) return false;
  let comun = 0;
  // El reporte corta el nombre a 40 letras: "DIM" de "DIMEEX" cuenta como el mismo token.
  for (const t of A) for (const u of B) if (t === u || (t.length >= 3 && u.length >= 3 && (t.startsWith(u) || u.startsWith(t)) && Math.min(t.length, u.length) >= 5)) { comun++; break; }
  return comun >= 2 || (Math.min(A.size, B.size) === 1 && comun === 1);
}

// ---------- 5) Folio de SIGAF normalizado ----------
export function claveFolio(f) {
  const s = txt(f).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const dig = s.replace(/\D/g, "").replace(/^0+/, "");
  return { alnum: s.replace(/^0+/, ""), dig };
}
function folioIgual(sig, tok) {
  const a = claveFolio(sig), b = claveFolio(tok);
  if (a.alnum && a.alnum === b.alnum) return "exacto";
  if (a.dig.length >= 3 && a.dig === b.dig) return "digitos";
  return null;
}

// ---------- 6) Cruce ----------
// facturas: [{ id, folio_ingreso, folio_proveedor, importe_factura, cr_contrarecibo, estatus_general, fecha_pago,
//              anulada, proveedores:{razon_social}, partidas:{cuenta_finat} }]
// Devuelve { automaticas, porConfirmar, alertas, faltanEnSigaf, resumen }
export function cruzar(comprobantes, facturas) {
  const vivas = facturas.filter((f) => !f.anulada);
  const porCR = new Map();
  for (const f of vivas) { const k = crNum(f.cr_contrarecibo); if (k) { if (!porCR.has(k)) porCR.set(k, []); porCR.get(k).push(f); } }
  const provCache = new Map();
  const tokF = (f) => { const n = f.proveedores?.razon_social || ""; if (!provCache.has(n)) provCache.set(n, tokensProv(n)); return provCache.get(n); };

  const automaticas = [], porConfirmar = [], alertas = [], faltanEnSigaf = [];
  const tocadas = new Map(); // factura.id -> cbte que la reclamó

  const lista = [...comprobantes.values()].sort((a, b) => (a.fecha_emision || "").localeCompare(b.fecha_emision || "") || a.cbte.localeCompare(b.cbte));
  for (const c of lista) {
    const k = crNum(c.cbte);
    const conCR = porCR.get(k) || [];

    // a) Comprobante eliminado que SIGAF tiene como CR
    if (c.eliminado) {
      for (const f of conCR) alertas.push({ tipo: "cr_eliminado", c, f, texto: `El sistema ELIMINÓ el comprobante ${c.cbte}; la factura sigue con ese CR. Buscar su nuevo comprobante.` });
      continue;
    }

    // b) SIGAF ya tiene este CR: solo avanzar estatus / fecha de pago (vale aunque sea de otra unidad)
    if (conCR.length) {
      for (const f of conCR) {
        if (c.estado_pago === "X") { alertas.push({ tipo: "pago_cancelado", c, f, texto: `El comprobante ${c.cbte} sigue vivo pero su PAGO está CANCELADO (Estado Pago X).` }); tocadas.set(f.id, c.cbte); continue; }
        const cambios = cambiosPara(f, c);
        if (f.estatus_general === "devuelta_proveedor") { alertas.push({ tipo: "devuelta_con_cr", c, f, texto: `Está como DEVUELTA pero su CR ${c.cbte} sigue vivo${c.pagado ? " y PAGADO" : ""}.` }); continue; }
        if (Object.keys(cambios).length) automaticas.push({ c, facturas: [f], cambios, via: "mismo CR" });
        tocadas.set(f.id, c.cbte);
      }
      continue;
    }

    // c) Buscar por proveedor + folio (solo comprobantes del HGZ 2)
    if (!c.esHGZ2) continue;
    const tokC = tokensProv(c.proveedor);
    const candProv = vivas.filter((f) => mismoProveedor(tokC, tokF(f)));
    const encontradas = [], viaFolio = [];
    // Texto completo igual (fondo fijo: "T JUL 01 - 16/2026")
    const completo = claveFolio(txt(c.factura_txt).replace(/^\s*\([^)]*\)\s*/, "")).alnum;
    const igualCompleto = completo.length >= 6 ? candProv.filter((f) => claveFolio(f.folio_proveedor).alnum === completo) : [];
    const tokens = igualCompleto.length === 1 ? [] : c.folios;
    if (igualCompleto.length === 1) { encontradas.push(igualCompleto[0]); viaFolio.push("exacto"); }
    for (const t of tokens) {
      let hits = candProv.filter((f) => folioIgual(f.folio_proveedor, t.folio));
      // Folio abreviado sin base ("291,292" = 21291, 21292): por terminación, SOLO con importe exacto (ver abajo).
      const td = claveFolio(t.folio).dig;
      if (!hits.length && /^\d{2,4}$/.test(t.folio) && td.length >= 2) {
        hits = candProv.filter((f) => { const d = claveFolio(f.folio_proveedor).dig; return d.length > td.length && d.length - td.length <= 3 && d.endsWith(td); });
        if (hits.length) t.abreviado = true;
      }
      if (hits.length === 1) { encontradas.push(hits[0]); viaFolio.push(t.abreviado ? "abreviado" : folioIgual(hits[0].folio_proveedor, t.folio)); }
      else if (hits.length > 1) {
        const libres = hits.filter((f) => !crNum(f.cr_contrarecibo));
        if (libres.length === 1) { encontradas.push(libres[0]); viaFolio.push("duplicado"); }
        else viaFolio.push("ambiguo");
      }
    }
    if (!encontradas.length) {
      if (c.impHGZ2 > 0 || c.uis.has(UI_HGZ2)) faltanEnSigaf.push({ c });
      continue;
    }
    const sumaSigaf = encontradas.reduce((s, f) => s + num(f.importe_factura), 0);
    const cuadra = Math.abs(sumaSigaf - c.importe) <= 1 || (c.impHGZ2 > 0 && Math.abs(sumaSigaf - c.impHGZ2) <= 1);
    const motivos = [];
    if (!cuadra) motivos.push(`importe: SIGAF ${sumaSigaf.toFixed(2)} vs comprobante ${c.importe.toFixed(2)}${c.impHGZ2 && Math.abs(c.impHGZ2 - c.importe) > 1 ? ` (HGZ 2: ${c.impHGZ2.toFixed(2)})` : ""}`);
    if (tokens.length && encontradas.length < tokens.length) motivos.push(`el comprobante trae ${tokens.length} folio(s) y en SIGAF se encontraron ${encontradas.length}`);
    if (viaFolio.includes("abreviado") && (!cuadra || encontradas.length < tokens.length)) motivos.push("folio abreviado en el comprobante");
    if (viaFolio.some((v) => v === "ambiguo")) motivos.push("hay folios repetidos en SIGAF");
    const conOtroCR = encontradas.filter((f) => crNum(f.cr_contrarecibo) && crNum(f.cr_contrarecibo) !== k);
    if (conOtroCR.length) motivos.push(`ya tiene otro CR (${conOtroCR.map((f) => f.cr_contrarecibo).join(", ")})`);
    const devueltas = encontradas.filter((f) => f.estatus_general === "devuelta_proveedor");
    if (devueltas.length) motivos.push("está como DEVUELTA en SIGAF");
    const yaReclamada = encontradas.filter((f) => tocadas.has(f.id));
    if (yaReclamada.length) motivos.push(`otro comprobante (${yaReclamada.map((f) => tocadas.get(f.id)).join(", ")}) también la reclama`);

    const item = { c, facturas: encontradas, cambiosPorFactura: Object.fromEntries(encontradas.map((f) => [f.id, cambiosPara(f, c, true)])), via: viaFolio.join("+"), sumaSigaf };
    encontradas.forEach((f) => tocadas.set(f.id, c.cbte));
    if (motivos.length) porConfirmar.push({ ...item, motivos });
    else automaticas.push({ ...item, cambios: null });
  }

  const n = (arr) => arr.reduce((s, x) => s + (x.facturas ? x.facturas.length : 1), 0);
  return {
    automaticas, porConfirmar, alertas, faltanEnSigaf,
    resumen: {
      comprobantes: comprobantes.size,
      hgz2: [...comprobantes.values()].filter((c) => c.esHGZ2 && !c.eliminado).length,
      eliminados: [...comprobantes.values()].filter((c) => c.eliminado).length,
      facturasAuto: n(automaticas), facturasConfirmar: n(porConfirmar), alertas: alertas.length, faltan: faltanEnSigaf.length,
    },
  };
}

// Cambios que corresponden a una factura según su comprobante (solo avanza, nunca retrocede).
export function cambiosPara(f, c, asignarCR = false) {
  const cambios = {};
  if (asignarCR && crNum(f.cr_contrarecibo) !== crNum(c.cbte)) cambios.cr_contrarecibo = c.cbte;
  const destino = c.pagado ? "gasto_reflejado" : "en_tramite_ooad";
  if ((ORD_GEN[destino] ?? 0) > (ORD_GEN[f.estatus_general] ?? -1)) cambios.estatus_general = destino;
  if (c.pagado && c.fecha_prog_pago && !f.fecha_pago) cambios.fecha_pago = c.fecha_prog_pago;
  return cambios;
}

// Renglones para guardar en comprobantes_ooad.
export function filasParaGuardar(filas, archivo, corte) {
  return filas.map((f) => ({ ...f, archivo, corte }));
}
