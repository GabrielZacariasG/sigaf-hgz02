"use client";

import { useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const PERIODO = "2026";

const normFactura = (v) => String(v ?? "").toUpperCase().replace(/\(([A-ZÑ0-9]{2,10})\)/g, "").replace(/[^A-Z0-9]/g, "");
const normProv = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
const normContrato = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const cents = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : Math.round(n * 100); };
const numf = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };

const ORD_GEN = { capturada: 0, en_revision: 1, enviada_ooad: 2, en_tramite_ooad: 3, gasto_reflejado: 4 };
const ORD_FIR = { pendiente: 0, envio_firmas_servicio: 1, autorizada_servicio: 2, envio_firmas_admin_contrato: 3, autorizada_admin_contrato: 4 };
const ORD_PED = { pendiente: 0, solicitado_fsi: 1, generado: 2 };

// Orden de procesamiento = orden de las ranuras
const SLOTS = [
  { id: "dispo", n: "1", titulo: "Disponibilidad (presupuesto)", hint: "DISPONIBILIDAD … .csv  ·  reporte FINAT (IMKK022)", tipo: "dispo" },
  { id: "comp_todos", n: "2", titulo: "Comprobantes — todos", hint: "N_AP_IMSS_1043 …  ·  comprobantes por fecha de emisión", tipo: "reporte" },
  { id: "comp_int", n: "3", titulo: "Comprobantes — Integrales", hint: "N_AP_IMSS_1011 …  ·  pendientes de pago (PREI II)", tipo: "reporte" },
  { id: "pagos_gen", n: "4", titulo: "Pagos — general", hint: "pagosun … .xlsx   o   N_AP_IMSS_4002", tipo: "reporte" },
  { id: "pagos_int", n: "5", titulo: "Pagos — Integrales", hint: "N_AP_IMSS_4007 …  ·  pagado + pedido/recepción (PREI II)", tipo: "reporte" },
  { id: "pedrec", n: "6", titulo: "Pedido-Recepción (Integrales)", hint: "N_AP_IMSS_1013 …  ·  recepciones sin comprobante (guía por importe)", tipo: "reporte" },
];

function findCol(H, pred) { for (let j = 0; j < H.length; j++) { const h = String(H[j] ?? "").trim().toLowerCase(); if (h && pred(h)) return j; } return -1; }

function analizarReporte(grid) {
  let hdr = -1;
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = (grid[r] || []).map((c) => String(c).trim().toLowerCase());
    if (row.includes("comprobante") || row.includes("factura") ||
        (row.some((h) => h.includes("no. pedido")) && row.some((h) => h.includes("contrato imss")))) { hdr = r; break; }
  }
  if (hdr < 0) return null;
  const H = grid[hdr] || [];
  // 1013: recepciones sin comprobante (no trae Factura ni Comprobante, sí Pedido + Contrato + Importe Merc)
  const hasFactura = findCol(H, (h) => h === "factura") >= 0;
  const hasCompr = findCol(H, (h) => h === "comprobante") >= 0;
  const hasPedido = findCol(H, (h) => h.includes("no. pedido")) >= 0;
  if (!hasFactura && !hasCompr && hasPedido) {
    return { hdr, tipo: "pedrec", col: {
      pedido: findCol(H, (h) => h.includes("no. pedido")),
      recepcion: findCol(H, (h) => h.includes("nota recep")),
      contrato: findCol(H, (h) => h.includes("contrato imss")),
      importe: findCol(H, (h) => h.includes("importe merc")),
      provNom: findCol(H, (h) => h.includes("nombre") && h.includes("prov")),
      fecha: findCol(H, (h) => h.includes("fecha recep")),
    } };
  }
  const col = {
    comprobante: findCol(H, (h) => h === "comprobante"),
    factura: findCol(H, (h) => h === "factura"),
    provNom: findCol(H, (h) => h.includes("nombre") && h.includes("prov")),
    importe: findCol(H, (h) => h.includes("importe") && (h.includes("captur") || h.includes("mxn"))),
    contrato: findCol(H, (h) => h.includes("contrato imss")) >= 0 ? findCol(H, (h) => h.includes("contrato imss")) : findCol(H, (h) => h === "contrato"),
    fechaPago: findCol(H, (h) => h.includes("fecha") && h.includes("pago") && !h.includes("prog")),
    pedido: findCol(H, (h) => h.includes("pedido")),
    recepcion: findCol(H, (h) => h.includes("recep")),
  };
  const esPREIII = findCol(H, (h) => h.includes("[po]") || h.includes("[recv]")) >= 0;
  const tipo = col.fechaPago >= 0 ? "pagos" : "comprobantes";
  const tienePedRec = col.pedido >= 0 && col.recepcion >= 0 && esPREIII;
  return { hdr, col, tipo, tienePedRec };
}

function calcularCambios(f, compr, tipo, tienePedRec) {
  const cambios = {};
  if (compr && String(f.cr_contrarecibo ?? "").trim() !== compr) cambios.cr_contrarecibo = compr;
  const gen = tipo === "pagos" ? "gasto_reflejado" : "en_tramite_ooad";
  if ((ORD_GEN[gen] ?? 0) > (ORD_GEN[f.estatus_general] ?? 0)) cambios.estatus_general = gen;
  if (ORD_FIR.autorizada_admin_contrato > (ORD_FIR[f.estatus_firmas] ?? 0)) cambios.estatus_firmas = "autorizada_admin_contrato";
  if (tienePedRec && ORD_PED.generado > (ORD_PED[f.estatus_pedido_recepcion] ?? 0)) cambios.estatus_pedido_recepcion = "generado";
  return cambios;
}

function casar(idx, row, col) {
  const compr = String(row[col.comprobante] ?? "").replace(/[^0-9]/g, "");
  if (compr.length >= 4 && idx.porCompr.has(compr)) return { f: idx.porCompr.get(compr), via: "comprobante" };
  const nf = normFactura(row[col.factura]);
  const cont = col.contrato >= 0 ? normContrato(row[col.contrato]) : "";
  const imp = cents(row[col.importe]);
  const prov = normProv(row[col.provNom]).slice(0, 8);
  const provOurs = prov.length >= 5 && idx.provSet.has(prov);
  const contOurs = cont.length >= 8 && [...idx.contratoSet].some((c) => c.includes(cont) || cont.includes(c));
  if (!provOurs && !contOurs) return { ajena: true };
  const mismoProv = (f) => normProv(f.proveedores?.razon_social).slice(0, 8) === prov;
  const cands = nf.length >= 3 ? (idx.porFactura.get(nf) || []) : [];
  if (cands.length) {
    let fil = cands;
    if (cont.length >= 8) { const p = cands.filter((f) => { const c = normContrato(f.contratos?.numero_interno); return c && (c.includes(cont) || cont.includes(c)); }); if (p.length) fil = p; }
    else if (provOurs) { const p = fil.filter(mismoProv); if (p.length) fil = p; }
    if (fil.length > 1 && imp != null) { const p = fil.filter((f) => cents(f.importe_factura) === imp); if (p.length) fil = p; }
    if (fil.length === 1) return { f: fil[0], via: cont ? "contrato+factura" : "factura+prov" };
  }
  let sug = imp != null ? (idx.porImporte.get(imp) || []).filter(mismoProv) : [];
  sug = [...sug].sort((a, b) => (String(a.cr_contrarecibo ?? "").trim() ? 1 : 0) - (String(b.cr_contrarecibo ?? "").trim() ? 1 : 0)).slice(0, 6);
  return { f: null, sugeridos: sug };
}

export default function ConciliarPage() {
  const [files, setFiles] = useState({}); // slotId -> File
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [res, setRes] = useState(null); // resultado del procesamiento
  const [confirmados, setConfirmados] = useState({});
  const [guardando, setGuardando] = useState(false);

  const setSlot = (id, file) => { setRes(null); setOk(""); setError(""); setFiles((p) => ({ ...p, [id]: file || undefined })); };

  const leerGrid = async (file) => {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  };

  const cargarIndice = async () => {
    let todas = [], desde = 0;
    for (;;) {
      const { data, error: e } = await supabase.from("facturas")
        .select("id, folio_proveedor, importe_factura, cr_contrarecibo, estatus_general, estatus_firmas, estatus_pedido_recepcion, contratos ( numero_interno ), proveedores ( razon_social )")
        .range(desde, desde + 999);
      if (e) throw e;
      todas = todas.concat(data || []);
      if (!data || data.length < 1000) break;
      desde += 1000;
    }
    const idx = { porFactura: new Map(), porCompr: new Map(), porImporte: new Map(), porContrato: new Map(), provSet: new Set(), contratoSet: new Set(), lista: todas };
    for (const f of todas) {
      const nf = normFactura(f.folio_proveedor);
      if (nf.length >= 3) { if (!idx.porFactura.has(nf)) idx.porFactura.set(nf, []); idx.porFactura.get(nf).push(f); }
      const cr = String(f.cr_contrarecibo ?? "").replace(/[^0-9]/g, ""); if (cr.length >= 4) idx.porCompr.set(cr, f);
      const ic = cents(f.importe_factura); if (ic != null) { if (!idx.porImporte.has(ic)) idx.porImporte.set(ic, []); idx.porImporte.get(ic).push(f); }
      const p = normProv(f.proveedores?.razon_social).slice(0, 8); if (p.length >= 5) idx.provSet.add(p);
      const c = normContrato(f.contratos?.numero_interno);
      if (c.length >= 8) { idx.contratoSet.add(c); if (!idx.porContrato.has(c)) idx.porContrato.set(c, []); idx.porContrato.get(c).push(f); }
    }
    return idx;
  };

  const procesar = async () => {
    setProcesando(true); setError(""); setOk(""); setRes(null); setConfirmados({});
    try {
      const idx = await cargarIndice();
      const updates = new Map(); // facturaId -> cambios (auto)
      const salida = { total: idx.lista.length, dispo: null, reportes: [], porConfirmar: [] };

      for (const slot of SLOTS) {
        const file = files[slot.id];
        if (!file) continue;
        const grid = await leerGrid(file);

        if (slot.tipo === "dispo") {
          let hdr = -1;
          for (let r = 0; r < Math.min(grid.length, 30); r++) if ((grid[r] || []).some((c) => String(c).trim().toLowerCase() === "cuenta")) { hdr = r; break; }
          if (hdr < 0) { salida.reportes.push({ slot: slot.titulo, nombre: file.name, err: "No es el reporte de disponibilidad (falta 'Cuenta')." }); continue; }
          const agg = {};
          for (let r = hdr + 1; r < grid.length; r++) {
            const cta = String((grid[r] || [])[0] ?? "").trim(); if (!/^\d{6,}$/.test(cta)) continue;
            const a = (agg[cta] ||= { cuenta: cta, presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 });
            a.presupuesto += numf(grid[r][6]); a.gasto += numf(grid[r][7]); a.comprometido += numf(grid[r][8]);
            a.precomprometido += numf(grid[r][9]); a.disponible += numf(grid[r][10]);
          }
          salida.dispo = { slot: slot.titulo, nombre: file.name, filas: Object.values(agg) };
          continue;
        }

        const meta = analizarReporte(grid);
        if (!meta) { salida.reportes.push({ slot: slot.titulo, nombre: file.name, err: "No reconocí el formato (falta Comprobante/Factura)." }); continue; }

        // ---- 1013: Pedido-Recepción (agrega por pedido, sugiere por cercanía de importe) ----
        if (meta.tipo === "pedrec") {
          const { hdr, col } = meta;
          const pedidos = new Map(); // pedido -> {cont, suma(cents), prov, fecha, recep}
          for (let r = hdr + 1; r < grid.length; r++) {
            const row = grid[r] || [];
            const ped = String(row[col.pedido] ?? "").trim(); if (!ped) continue;
            const cont = normContrato(row[col.contrato]);
            const p = pedidos.get(ped) || { cont, suma: 0, prov: String(row[col.provNom] ?? "").trim(), fecha: String(row[col.fecha] ?? "").trim(), recep: String(row[col.recepcion] ?? "").trim() };
            p.suma += cents(row[col.importe]) ?? 0; pedidos.set(ped, p);
          }
          let sugeridos = 0, sinFactura = 0, ajenos = 0;
          for (const [ped, p] of pedidos) {
            // contrato nuestro (match por inclusión)
            let key = null;
            if (p.cont.length >= 8) for (const c of idx.porContrato.keys()) { if (c.includes(p.cont) || p.cont.includes(c)) { key = c; break; } }
            if (!key) { ajenos++; continue; }
            // facturas de ese contrato pendientes de pedido-recepción, por cercanía de importe
            const cands = (idx.porContrato.get(key) || [])
              .filter((f) => ORD_PED.generado > (ORD_PED[f.estatus_pedido_recepcion] ?? 0))
              .map((f) => ({ f, d: Math.abs((cents(f.importe_factura) ?? 0) - p.suma) }))
              .sort((a, b) => a.d - b.d).slice(0, 6);
            if (!cands.length) { sinFactura++; continue; }
            sugeridos++;
            salida.porConfirmar.push({
              key: slot.id + "_" + ped, slot: slot.titulo, esPedRec: true,
              compr: "", facturaTxt: `Pedido ${ped.replace(/^0+/, "")} · rec ${p.recep.replace(/^0+/, "")}`,
              provTxt: p.prov, importe: p.suma / 100,
              candidatos: cands.map(({ f }) => ({ id: f.id, f, cambios: { estatus_pedido_recepcion: "generado" } })),
            });
          }
          salida.reportes.push({ slot: slot.titulo, nombre: file.name, esPedRec: true, pedidos: pedidos.size, sugeridos, sinFactura, ajenos });
          continue;
        }

        const { hdr, col, tipo, tienePedRec } = meta;
        let auto = 0, porConf = 0, sinCruce = 0, ajenas = 0, cruzado = 0, pend = 0;
        const vistos = new Set();
        for (let r = hdr + 1; r < grid.length; r++) {
          const row = grid[r] || [];
          const fTxt = String(row[col.factura] ?? "").trim(), cTxt = String(row[col.comprobante] ?? "").trim();
          if (!fTxt && !cTxt) continue;
          const imp = (cents(row[col.importe]) ?? 0) / 100;
          const m = casar(idx, row, col);
          if (m.ajena) { ajenas++; continue; }
          if (m.f) {
            if (vistos.has(m.f.id)) continue;
            const cambios = calcularCambios(m.f, cTxt, tipo, tienePedRec);
            if (Object.keys(cambios).length) {
              vistos.add(m.f.id); auto++; cruzado += imp;
              updates.set(m.f.id, { ...(updates.get(m.f.id) || {}), ...cambios });
              // aplicar en memoria para el efecto dominó (pagos cruza por comprobante ya lleno)
              Object.assign(m.f, cambios);
              const crn = String(m.f.cr_contrarecibo ?? "").replace(/[^0-9]/g, ""); if (crn.length >= 4) idx.porCompr.set(crn, m.f);
            }
          } else if (m.sugeridos && m.sugeridos.length) {
            porConf++; pend += imp;
            salida.porConfirmar.push({
              key: slot.id + "_" + r, slot: slot.titulo, compr: cTxt, facturaTxt: fTxt, provTxt: String(row[col.provNom] ?? "").trim(), importe: imp,
              candidatos: m.sugeridos.map((f) => ({ id: f.id, f, cambios: calcularCambios(f, cTxt, tipo, tienePedRec) })),
            });
          } else { sinCruce++; pend += imp; }
        }
        salida.reportes.push({ slot: slot.titulo, nombre: file.name, tipo, tienePedRec, auto, porConf, sinCruce, ajenas, cruzado, pend });
      }
      salida.updates = updates;
      setRes(salida);
      const nrep = salida.reportes.filter((r) => !r.err).length + (salida.dispo ? 1 : 0);
      if (!nrep) setError("No subiste ningún reporte válido en las ranuras.");
    } catch (e) { setError("Error al procesar: " + e.message); }
    setProcesando(false);
  };

  const toggleConfirm = (key, id) => setConfirmados((p) => ({ ...p, [key]: p[key] === id ? undefined : id }));

  const guardar = async () => {
    setGuardando(true); setError(""); setOk("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no iniciada.");
      let msg = [];
      // 1) disponibilidad
      if (res.dispo?.filas?.length) {
        const payload = res.dispo.filas.map((f) => ({ cuenta_prei: f.cuenta, periodo: PERIODO, presupuesto: f.presupuesto, gasto: f.gasto, comprometido: f.comprometido, precomprometido: f.precomprometido, disponible: f.disponible, actualizado_at: new Date().toISOString() }));
        const { error: e } = await supabase.from("disponibilidad_presupuestal").upsert(payload, { onConflict: "cuenta_prei,periodo" });
        if (e) throw new Error("disponibilidad: " + e.message);
        msg.push(`${payload.length} cuentas de presupuesto`);
      }
      // 2) facturas (auto + confirmadas)
      const porId = new Map(res.updates);
      for (const pc of res.porConfirmar) {
        const id = confirmados[pc.key]; if (!id) continue;
        const cand = pc.candidatos.find((c) => c.id === id);
        if (cand && Object.keys(cand.cambios).length) porId.set(id, { ...(porId.get(id) || {}), ...cand.cambios });
      }
      const ids = [...porId.keys()]; let hechas = 0;
      for (let i = 0; i < ids.length; i += 25) { const lote = ids.slice(i, i + 25); await Promise.all(lote.map((id) => supabase.from("facturas").update(porId.get(id)).eq("id", id))); hechas += lote.length; }
      if (hechas) msg.push(`${hechas} facturas actualizadas`);
      setOk("Listo: " + (msg.join(" · ") || "sin cambios") + ".");
      setRes(null); setFiles({}); setConfirmados({});
    } catch (e) { setError("No se pudo guardar: " + e.message); }
    setGuardando(false);
  };

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px" };
  const nSlots = Object.values(files).filter(Boolean).length;
  const totalAuto = res ? [...res.updates].length : 0;
  const totalConf = Object.values(confirmados).filter(Boolean).length;

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Actualizar cédula (reportes OOAD / FINAT)</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 800 }}>
        Pon cada reporte en su ranura y dale <strong>Procesar</strong>. SIGAF refresca el presupuesto, rellena comprobantes,
        avanza estatus y marca pagadas — <strong>en el orden correcto</strong>. Lo que no cruce solo, te lo deja para confirmar a mano.
      </p>

      {/* Ranuras */}
      <div style={{ display: "grid", gap: 10, marginTop: 14, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {SLOTS.map((s) => (
          <div key={s.id} style={{ ...card, borderColor: files[s.id] ? "var(--verde)" : "var(--borde)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontWeight: 700, color: "var(--verde)" }}>{s.n}</span>
              <strong style={{ fontSize: 14 }}>{s.titulo}</strong>
            </div>
            <div style={{ fontSize: 12, color: "var(--texto-suave)", margin: "3px 0 8px" }}>{s.hint}</div>
            <input type="file" accept=".xls,.xlsx,.csv" onChange={(e) => setSlot(s.id, e.target.files?.[0])} />
            {files[s.id] && <div style={{ fontSize: 12, color: "var(--verde)", marginTop: 4 }}>✓ {files[s.id].name}</div>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="boton" onClick={procesar} disabled={procesando || guardando || nSlots === 0}>
          {procesando ? "Procesando…" : `Procesar ${nSlots} reporte(s)`}
        </button>
        <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>No guarda nada hasta que revises y confirmes.</span>
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}
      {ok && <p style={{ color: "var(--verde)", fontSize: 14, marginTop: 12, fontWeight: 600 }}>{ok}</p>}

      {res && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Resumen — {totalAuto} automáticas + {totalConf} confirmadas</h2>
            <button className="boton" onClick={guardar} disabled={guardando || (totalAuto + totalConf === 0 && !res.dispo)}>
              {guardando ? "Guardando…" : "Guardar todo"}
            </button>
          </div>

          {res.dispo && (
            <div style={{ ...card, marginTop: 10 }}>
              <strong style={{ fontSize: 14 }}>{res.dispo.slot}</strong> — {res.dispo.filas.length} cuentas de presupuesto se actualizarán.
            </div>
          )}
          {res.reportes.map((r, i) => (
            <div key={i} style={{ ...card, marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <strong style={{ fontSize: 14 }}>{r.slot}</strong>
                <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>{r.nombre}</span>
              </div>
              {r.err ? <div style={{ color: "var(--rojo)", fontSize: 13, marginTop: 4 }}>{r.err}</div> : r.esPedRec ? (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  <span style={{ color: "var(--verde)", fontWeight: 600 }}>{r.sugeridos} pedidos con factura sugerida</span>
                  {" · "}<span style={{ color: "var(--texto-suave)" }}>{r.sinFactura} sin factura capturada · {r.ajenos} de otras unidades</span>
                  {"  ("}{r.pedidos}{" pedidos en el reporte)"}
                </div>
              ) : (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  <span style={{ color: "var(--verde)", fontWeight: 600 }}>{r.auto} automáticas</span>
                  {" · "}{r.porConf} por confirmar{" · "}<span style={{ color: "var(--texto-suave)" }}>{r.sinCruce} sin cruce · {r.ajenas} de otras unidades</span>
                  {"  —  cruzado "}{money(r.cruzado)}
                </div>
              )}
            </div>
          ))}

          {res.porConfirmar.length > 0 && (
            <div style={{ ...card, marginTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Por confirmar — elige el contra-recibo que impactó ({res.porConfirmar.length})</div>
              {res.porConfirmar.slice(0, 80).map((pc) => (
                <div key={pc.key} style={{ borderTop: "1px solid var(--borde)", padding: "8px 0" }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>{money(pc.importe)}</strong> · {pc.slot} · {pc.esPedRec ? <em>{pc.facturaTxt}</em> : <>factura <em>{pc.facturaTxt || "—"}</em></>}{pc.compr && <> · comprobante <em>{pc.compr}</em></>} · {pc.provTxt.slice(0, 28)}
                    {pc.esPedRec && <span style={{ color: "var(--texto-suave)" }}> — marca pedido-recepción generado</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {pc.candidatos.map((c) => {
                      const sel = confirmados[pc.key] === c.id;
                      return (
                        <button key={c.id} onClick={() => toggleConfirm(pc.key, c.id)} style={{ fontSize: 12, padding: "5px 9px", borderRadius: 8, cursor: "pointer", border: sel ? "2px solid var(--verde)" : "1px solid var(--borde)", background: sel ? "color-mix(in srgb, var(--verde) 12%, transparent)" : "var(--blanco)" }}>
                          {sel ? "✓ " : ""}{c.f.folio_proveedor} · {c.f.proveedores?.razon_social?.slice(0, 18) ?? "—"} · {money(c.f.importe_factura)}{c.f.cr_contrarecibo ? " · (ya CR)" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {res.porConfirmar.length > 80 && <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 6 }}>… y {res.porConfirmar.length - 80} más</p>}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 10 }}>Solo se avanzan estatus (nunca se retroceden). Las sugerencias se aplican solo si las confirmas.</p>
        </>
      )}
    </div>
  );
}
