// Fase 2 · Pagos (N_AP_IMSS_4002 / 4007), recepciones sin comprobante (N_AP_IMSS_1013) y bandeja de avisos.
// Complementa lib/nap.js (comprobantes 1043). Reglas probadas en la carga del 29–30/10/2026:
//  · 4002 = pagado por fecha de pago (todas las cuentas): fecha REAL de pago. Pedido/recepción si los trae.
//  · 4007 = pagado de pedidos (PREI) con la unidad REAL en "[RECV-D] Unidad de Información".
//  · 1013 = recepciones que todavía no tienen comprobante: sirven para anotar pedido-recepción a facturas sin CR
//    (mismo proveedor + mismo importe ±1 y UNA sola candidata).
import { crNum, mismoProveedor, tokensProv, UI_HGZ2, UI_PASIVO_CENTRAL } from "./nap";
import { generaPedidoRecepcion, puedeEnviarOoad, FLUJO_GENERAL, FLUJO_FIRMAS, FLUJO_PEDIDO } from "./estatus";

const txt = (v) => String(v ?? "").trim();
const num = (v) => { if (typeof v === "number") return v; const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isNaN(n) ? 0 : n; };
const fecha = (v) => (typeof v === "number" && v > 20000 ? new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) : null);
const sinCeros = (v) => txt(v).replace(/^0+/, "");
const N = (s) => String(s ?? "").normalize("NFD").replace(/[^A-Za-z0-9[\]]/g, "").toUpperCase();
const ORD_GEN = { capturada: 0, en_revision: 1, enviada_ooad: 2, en_tramite_ooad: 3, gasto_reflejado: 4 };

function encabezado(grid, pruebas) {
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const H = (grid[r] || []).map(N);
    if (pruebas.every((p) => H.some((h) => h.startsWith(N(p))))) return { hdr: r, H };
  }
  return null;
}
const col = (H, ...nombres) => { for (const n of nombres) { const i = H.findIndex((h) => h.startsWith(N(n))); if (i >= 0) return i; } return -1; };

// ¿Qué reporte es? '1043' | '4002' | '4007' | '1013' | null
export function tipoReporte(grid) {
  if (encabezado(grid, ["No. Nota Recep", "No. Pedido", "Contrato IMSS"])) return "1013";
  const e = encabezado(grid, ["Comprobante", "Factura"]);
  if (!e) return null;
  const tiene = (p) => e.H.some((h) => h.startsWith(N(p)));
  if (tiene("Fecha Pago") && tiene("[RECV-D] Unidad")) return "4007";
  if (tiene("Fecha Pago")) return "4002";
  if (tiene("Estado Pago")) return "1043";
  return null;
}

// ---------- 4002 / 4007: pagos ----------
export function leerPagos(grid) {
  const e = encabezado(grid, ["Comprobante", "Fecha Pago"]);
  if (!e) return { error: "No reconocí el reporte de pagos (faltan Comprobante / Fecha Pago)." };
  const { hdr, H } = e;
  const es4007 = H.some((h) => h.startsWith(N("[RECV-D] Unidad")));
  const c = {
    cbte: col(H, "Comprobante"), fpago: col(H, "Fecha Pago"), prov: col(H, "Nombre Proveedor"), fac: col(H, "Factura"),
    imp: col(H, "Importe MXN"), ent: col(H, "Estado Entrada"),
    ui: es4007 ? col(H, "[RECV-D] Unidad de Inform") : col(H, "Unidad de Inform"),
    ped: es4007 ? col(H, "[RECV] Pedido") : col(H, "Nº Pedido", "N Pedido", "No. Pedido"),
    rec: es4007 ? col(H, "[RECV] Recepci", "[RECV]  Recepci") : col(H, "No. Recepci"),
  };
  const pagos = new Map(); const fechas = [];
  for (let r = hdr + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const cbte = txt(row[c.cbte]); if (!/^\d{5,}$/.test(cbte)) continue;
    const fp = fecha(row[c.fpago]); if (fp) fechas.push(fp);
    const k = crNum(cbte);
    const p = pagos.get(k) || { cbte, fecha_pago: null, pedido: "", recepcion: "", uis: new Set(), proveedor: txt(row[c.prov]), factura_txt: txt(row[c.fac]), importe: num(row[c.imp]) };
    if (fp && (!p.fecha_pago || fp > p.fecha_pago)) p.fecha_pago = fp;
    p.uis.add(txt(row[c.ui]).padStart(6, "0"));
    const ped = c.ped >= 0 ? sinCeros(row[c.ped]) : "", rec = c.rec >= 0 ? sinCeros(row[c.rec]) : "";
    if (ped && !p.pedido) p.pedido = ped;
    if (rec && !p.recepcion) p.recepcion = rec;
    pagos.set(k, p);
  }
  fechas.sort();
  return { tipo: es4007 ? "4007" : "4002", pagos, desde: fechas[0] || null, hasta: fechas[fechas.length - 1] || null };
}

// Facturas de SIGAF con ese CR → fecha real de pago, pagada, pedido-recepción.
export function cruzarPagos(pagos, facturas, fuente) {
  const items = [], alertas = [];
  const porCR = new Map();
  for (const f of facturas) { if (f.anulada) continue; const k = crNum(f.cr_contrarecibo); if (k) { if (!porCR.has(k)) porCR.set(k, []); porCR.get(k).push(f); } }
  for (const [k, p] of pagos) {
    const fs = porCR.get(k); if (!fs || !p.fecha_pago) continue;
    const cambiosPorFactura = {}; const usadas = [];
    for (const f of fs) {
      if (f.estatus_general === "devuelta_proveedor") { alertas.push({ tipo: "devuelta_pagada", ref: p.cbte, f, texto: `Está como DEVUELTA pero el sistema PAGÓ su CR ${p.cbte} el ${p.fecha_pago}.` }); continue; }
      const cam = {};
      if (f.fecha_pago !== p.fecha_pago) cam.fecha_pago = p.fecha_pago;
      if ((ORD_GEN[f.estatus_general] ?? -1) < ORD_GEN.gasto_reflejado) cam.estatus_general = "gasto_reflejado";
      if (p.pedido) {
        const pedF = sinCeros(f.numero_pedido), recF = sinCeros(f.numero_recepcion);
        if (!pedF) cam.numero_pedido = p.pedido;
        if (!recF && p.recepcion) cam.numero_recepcion = p.recepcion;
        if ((pedF && pedF !== p.pedido) || (recF && p.recepcion && recF !== p.recepcion))
          alertas.push({ tipo: "pedido_distinto", ref: p.cbte, f, texto: `SIGAF tiene pedido ${pedF || "—"} / recepción ${recF || "—"}; el sistema pagó con ${p.pedido} / ${p.recepcion || "—"}.` });
        if (f.estatus_pedido_recepcion !== "generado") cam.estatus_pedido_recepcion = "generado";
      }
      if (Object.keys(cam).length) { cambiosPorFactura[f.id] = cam; usadas.push(f); }
    }
    if (usadas.length) items.push({
      fuente, ref: p.cbte, estado: `Pagado ${p.fecha_pago}`, proveedor: p.proveedor, texto: p.factura_txt,
      importe: p.importe, facturas: usadas, cambiosPorFactura, motivos: null,
    });
  }
  return { items, alertas };
}

// ---------- 1013: recepciones sin comprobante ----------
export function leer1013(grid) {
  const e = encabezado(grid, ["No. Nota Recep", "No. Pedido"]);
  if (!e) return { error: "No reconocí el 1013 (faltan No. Nota Recepción / No. Pedido)." };
  const { hdr, H } = e;
  const c = { rec: col(H, "No. Nota Recep"), ped: col(H, "No. Pedido"), cont: col(H, "Contrato IMSS"), prov: col(H, "Nombre Proveedor"),
    frec: col(H, "Fecha Recep"), imp: col(H, "[DST] Importe Merc. MXN", "[DST] Importe Merc"), ui: col(H, "[DST] Unidad Inform"), cta: col(H, "[DST] Cuenta") };
  const m = new Map();
  for (let r = hdr + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const ped = sinCeros(row[c.ped]); if (!ped) continue;
    const rec = sinCeros(row[c.rec]); const k = `${ped}/${rec}`;
    const o = m.get(k) || { pedido: ped, recepcion: rec, contrato: txt(row[c.cont]), proveedor: txt(row[c.prov]), fecha: fecha(row[c.frec]), importe: 0, uis: new Set(), cuentas: new Set() };
    o.importe += num(row[c.imp]); o.uis.add(txt(row[c.ui]).padStart(6, "0")); o.cuentas.add(txt(row[c.cta]));
    m.set(k, o);
  }
  return { recepciones: [...m.values()].filter((o) => o.uis.has(UI_HGZ2)) };
}

export function cruzar1013(recepciones, facturas) {
  const items = [], sinFactura = [];
  const sinCR = facturas.filter((f) => !f.anulada && f.estatus_general !== "devuelta_proveedor" && !crNum(f.cr_contrarecibo));
  for (const r of recepciones) {
    const tok = tokensProv(r.proveedor);
    const cands = sinCR.filter((f) => Math.abs(num(f.importe_factura) - r.importe) <= 1 && mismoProveedor(tok, f.proveedores?.razon_social || ""));
    if (cands.length !== 1) { sinFactura.push({ r, n: cands.length }); continue; }
    const f = cands[0];
    if (sinCeros(f.numero_pedido) === r.pedido && f.estatus_pedido_recepcion === "generado") continue;
    if (sinCeros(f.numero_pedido) && sinCeros(f.numero_pedido) !== r.pedido) { sinFactura.push({ r, n: 1, otroPedido: f }); continue; }
    items.push({
      fuente: "1013", ref: `Pedido ${r.pedido}`, estado: `Recepción ${r.recepcion} · ${r.fecha || ""}`, proveedor: r.proveedor,
      texto: `Contrato ${r.contrato}`, importe: r.importe, facturas: [f],
      cambiosPorFactura: { [f.id]: { numero_pedido: r.pedido, numero_recepcion: r.recepcion, estatus_pedido_recepcion: "generado" } }, motivos: null,
    });
  }
  return { items, sinFactura };
}

// ---------- Bandeja de avisos ----------
// facturas = ya con los cambios propuestos aplicados (simulación). hist/umbrales opcionales (días en etapa).
export function avisosDe(facturas, cambiadas, hist = [], umbrales = {}) {
  const listasOOAD = [], estancadas = [];
  const ultima = new Map(); // id|circuito → fecha de entrada al estatus actual
  for (const h of hist) { const k = `${h.factura_id}|${h.circuito}|${h.estatus}`; if (!ultima.has(k) || h.fecha > ultima.get(k)) ultima.set(k, h.fecha); }
  const hoy = Date.now();
  for (const f of facturas) {
    if (f.anulada || f.estatus_general === "devuelta_proveedor") continue;
    const cap = f.capitulos?.nombre || "";
    const pr = generaPedidoRecepcion(cap, f.partidas?.cuenta_finat || f.partidas?.cuenta_prei);
    if (["capturada", "en_revision"].includes(f.estatus_general) && puedeEnviarOoad(f.estatus_firmas, pr ? f.estatus_pedido_recepcion : "generado", cap))
      listasOOAD.push({ f, nueva: cambiadas.has(f.id) });
    if (f.estatus_general === "gasto_reflejado") continue;
    for (const [circ, valor, flujo] of [["general", f.estatus_general, FLUJO_GENERAL], ["firmas", f.estatus_firmas, FLUJO_FIRMAS], ["pedido_recepcion", f.estatus_pedido_recepcion, FLUJO_PEDIDO]]) {
      const lim = umbrales[`${circ}:${valor}`]; if (lim == null) continue;
      if (circ === "pedido_recepcion" && !pr) continue;
      const desde = ultima.get(`${f.id}|${circ}|${valor}`); if (!desde) continue;
      const dias = Math.floor((hoy - new Date(desde).getTime()) / 86400000);
      if (dias > lim && flujo.indexOf(valor) < flujo.length - 1) { estancadas.push({ f, circuito: circ, valor, dias, lim }); break; }
    }
  }
  estancadas.sort((a, b) => b.dias - a.dias);
  return { listasOOAD, estancadas };
}
export { UI_PASIVO_CENTRAL };
