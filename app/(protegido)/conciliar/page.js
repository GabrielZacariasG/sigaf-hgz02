"use client";

import { useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// ---- normalizadores de llave ----
const normFactura = (v) =>
  String(v ?? "").toUpperCase().replace(/\(([A-ZÑ0-9]{2,10})\)/g, "").replace(/[^A-Z0-9]/g, "");
const normProv = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
const normContrato = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const cents = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : Math.round(n * 100);
};

// ---- orden de los estatus (solo AVANZAR) ----
const ORD_GEN = { capturada: 0, en_revision: 1, enviada_ooad: 2, en_tramite_ooad: 3, gasto_reflejado: 4 };
const ORD_FIR = { pendiente: 0, envio_firmas_servicio: 1, autorizada_servicio: 2, envio_firmas_admin_contrato: 3, autorizada_admin_contrato: 4 };
const ORD_PED = { pendiente: 0, solicitado_fsi: 1, generado: 2 };

function findCol(headers, pred) {
  for (let j = 0; j < headers.length; j++) {
    const h = String(headers[j] ?? "").trim().toLowerCase();
    if (h && pred(h)) return j;
  }
  return -1;
}

function analizarReporte(grid) {
  let hdr = -1;
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = (grid[r] || []).map((c) => String(c).trim().toLowerCase());
    if (row.includes("comprobante") || row.includes("factura")) { hdr = r; break; }
  }
  if (hdr < 0) return null;
  const H = grid[hdr] || [];
  const col = {
    comprobante: findCol(H, (h) => h === "comprobante"),
    factura: findCol(H, (h) => h === "factura"),
    provNom: findCol(H, (h) => h.includes("nombre") && h.includes("prov")),
    importe: findCol(H, (h) => h.includes("importe") && (h.includes("captur") || h.includes("mxn"))),
    contrato: findCol(H, (h) => h.includes("contrato imss")) >= 0
      ? findCol(H, (h) => h.includes("contrato imss"))
      : findCol(H, (h) => h === "contrato"),
    fechaPago: findCol(H, (h) => h.includes("fecha") && h.includes("pago") && !h.includes("prog")),
    pedido: findCol(H, (h) => h.includes("pedido")),
    recepcion: findCol(H, (h) => h.includes("recep")),
  };
  const esPREIII = findCol(H, (h) => h.includes("[po]") || h.includes("[recv]")) >= 0;
  const tienePago = col.fechaPago >= 0;
  const tipo = tienePago ? "pagos" : "comprobantes";
  const tienePedRec = col.pedido >= 0 && col.recepcion >= 0 && esPREIII;
  return { hdr, col, tipo, esPREIII, tienePedRec };
}

// calcula los cambios que un reporte propondría a una factura (solo avanzar)
function calcularCambios(f, row, col, tipo, tienePedRec) {
  const cambios = {};
  const compr = String(row[col.comprobante] ?? "").trim();
  if (compr && String(f.cr_contrarecibo ?? "").trim() !== compr) cambios.cr_contrarecibo = compr;
  const genObjetivo = tipo === "pagos" ? "gasto_reflejado" : "en_tramite_ooad";
  if ((ORD_GEN[genObjetivo] ?? 0) > (ORD_GEN[f.estatus_general] ?? 0)) cambios.estatus_general = genObjetivo;
  if (ORD_FIR["autorizada_admin_contrato"] > (ORD_FIR[f.estatus_firmas] ?? 0)) cambios.estatus_firmas = "autorizada_admin_contrato";
  if (tienePedRec && ORD_PED["generado"] > (ORD_PED[f.estatus_pedido_recepcion] ?? 0)) cambios.estatus_pedido_recepcion = "generado";
  return cambios;
}

export default function ConciliarPage() {
  const [facturas, setFacturas] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [reportes, setReportes] = useState([]);
  const [confirmados, setConfirmados] = useState({}); // key -> facturaId
  const [guardando, setGuardando] = useState(false);

  const cargarFacturas = async () => {
    setCargando(true); setError("");
    try {
      let todas = [], desde = 0;
      for (;;) {
        const { data, error: e } = await supabase
          .from("facturas")
          .select("id, folio_proveedor, importe_factura, cr_contrarecibo, estatus_general, estatus_firmas, estatus_pedido_recepcion, contratos ( numero_interno ), proveedores ( razon_social )")
          .range(desde, desde + 999);
        if (e) throw e;
        todas = todas.concat(data || []);
        if (!data || data.length < 1000) break;
        desde += 1000;
      }
      const idx = { porFactura: new Map(), porCompr: new Map(), porImporte: new Map(), lista: todas };
      for (const f of todas) {
        const nf = normFactura(f.folio_proveedor);
        if (nf.length >= 3) { if (!idx.porFactura.has(nf)) idx.porFactura.set(nf, []); idx.porFactura.get(nf).push(f); }
        const cr = String(f.cr_contrarecibo ?? "").replace(/[^0-9]/g, "");
        if (cr.length >= 4) idx.porCompr.set(cr, f);
        const ic = cents(f.importe_factura);
        if (ic != null) { if (!idx.porImporte.has(ic)) idx.porImporte.set(ic, []); idx.porImporte.get(ic).push(f); }
      }
      setFacturas(idx);
      setReportes([]); setConfirmados({});
      setOk(`${todas.length} facturas cargadas. Ya puedes subir reportes.`);
    } catch (e) { setError("No pude cargar las facturas: " + e.message); }
    setCargando(false);
  };

  // intenta casar exacto; si no, devuelve candidatos por importe (+proveedor)
  const casar = (idx, row, col) => {
    const compr = String(row[col.comprobante] ?? "").replace(/[^0-9]/g, "");
    if (compr.length >= 4 && idx.porCompr.has(compr)) return { f: idx.porCompr.get(compr), via: "comprobante" };
    const nf = normFactura(row[col.factura]);
    const cont = col.contrato >= 0 ? normContrato(row[col.contrato]) : "";
    const imp = cents(row[col.importe]);
    const cands = nf.length >= 3 ? (idx.porFactura.get(nf) || []) : [];
    if (cands.length) {
      let filtrados = cands;
      if (cont.length >= 8) {
        const porC = cands.filter((f) => { const c = normContrato(f.contratos?.numero_interno); return c && (c.includes(cont) || cont.includes(c)); });
        if (porC.length) filtrados = porC;
      }
      if (filtrados.length > 1 && imp != null) {
        const porI = filtrados.filter((f) => cents(f.importe_factura) === imp);
        if (porI.length) filtrados = porI;
      }
      if (filtrados.length === 1) return { f: filtrados[0], via: cont ? "contrato+factura" : "factura" };
    }
    // sugerencias por importe exacto (para confirmar a mano)
    let sugeridos = imp != null ? (idx.porImporte.get(imp) || []) : [];
    // priorizar mismo proveedor y sin CR aún
    const prov = normProv(row[col.provNom]);
    sugeridos = [...sugeridos].sort((a, b) => {
      const pa = prov && normProv(a.proveedores?.razon_social).slice(0, 8) === prov.slice(0, 8) ? 1 : 0;
      const pb = prov && normProv(b.proveedores?.razon_social).slice(0, 8) === prov.slice(0, 8) ? 1 : 0;
      const sa = String(a.cr_contrarecibo ?? "").trim() ? 0 : 1;
      const sb = String(b.cr_contrarecibo ?? "").trim() ? 0 : 1;
      return (pb - pa) || (sb - sa);
    }).slice(0, 6);
    return { f: null, sugeridos, cand: cands.length };
  };

  const onFile = async (e) => {
    setError(""); setOk("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!facturas) { setError("Primero carga las facturas (botón de arriba)."); return; }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      const meta = analizarReporte(grid);
      if (!meta) { setError(`"${file.name}": no reconocí el formato (falta columna Comprobante/Factura).`); e.target.value = ""; return; }
      const { hdr, col, tipo, tienePedRec } = meta;

      const matches = [], porConfirmar = []; let sinCruce = 0, gastoCruzado = 0, gastoPendiente = 0;
      const vistos = new Set();
      const idBase = file.name.replace(/\W+/g, "") + "_";
      for (let r = hdr + 1; r < grid.length; r++) {
        const row = grid[r] || [];
        const fTxt = String(row[col.factura] ?? "").trim();
        const cTxt = String(row[col.comprobante] ?? "").trim();
        if (!fTxt && !cTxt) continue;
        const imp = cents(row[col.importe]) ?? 0;
        const res = casar(facturas, row, col);
        if (res.f) {
          if (vistos.has(res.f.id)) continue;
          const cambios = calcularCambios(res.f, row, col, tipo, tienePedRec);
          if (Object.keys(cambios).length) { vistos.add(res.f.id); matches.push({ f: res.f, via: res.via, cambios }); gastoCruzado += imp / 100; }
        } else if (res.sugeridos && res.sugeridos.length) {
          porConfirmar.push({
            key: idBase + r, compr: cTxt, facturaTxt: fTxt, provTxt: String(row[col.provNom] ?? "").trim(),
            importe: imp / 100, tipo, tienePedRec, col,
            candidatos: res.sugeridos.map((f) => ({ id: f.id, f, cambios: calcularCambios(f, row, col, tipo, tienePedRec) })),
          });
          gastoPendiente += imp / 100;
        } else { sinCruce++; gastoPendiente += imp / 100; }
      }
      setReportes((prev) => [...prev, { nombre: file.name, tipo, tienePedRec, matches, porConfirmar, sinCruce, gastoCruzado, gastoPendiente }]);
    } catch (err) { setError("No pude leer el archivo: " + err.message); }
    e.target.value = "";
  };

  const toggleConfirm = (key, facturaId) =>
    setConfirmados((prev) => ({ ...prev, [key]: prev[key] === facturaId ? undefined : facturaId }));

  // cambios finales = auto-matches + confirmados a mano
  const cambiosFinales = () => {
    const porId = new Map();
    for (const rep of reportes) {
      for (const m of rep.matches) porId.set(m.f.id, { ...(porId.get(m.f.id) || {}), ...m.cambios });
      for (const pc of rep.porConfirmar) {
        const elegido = confirmados[pc.key];
        if (!elegido) continue;
        const cand = pc.candidatos.find((c) => c.id === elegido);
        if (cand && Object.keys(cand.cambios).length) porId.set(elegido, { ...(porId.get(elegido) || {}), ...cand.cambios });
      }
    }
    return porId;
  };

  const totalAuto = reportes.reduce((a, r) => a + r.matches.length, 0);
  const totalConf = Object.values(confirmados).filter(Boolean).length;

  const aplicar = async () => {
    setGuardando(true); setError(""); setOk("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no iniciada.");
      const porId = cambiosFinales();
      const ids = [...porId.keys()];
      let hechas = 0;
      for (let i = 0; i < ids.length; i += 25) {
        const lote = ids.slice(i, i + 25);
        await Promise.all(lote.map((id) => supabase.from("facturas").update(porId.get(id)).eq("id", id)));
        hechas += lote.length;
      }
      setOk(`Listo: ${hechas} facturas actualizadas (${totalAuto} automáticas + ${totalConf} confirmadas).`);
      setReportes([]); setConfirmados({}); setFacturas(null);
    } catch (e) { setError("No se pudo aplicar: " + e.message); }
    setGuardando(false);
  };

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "16px 18px" };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13 };
  const TIPO_LBL = { pagos: "Pagos → marca PAGADA", comprobantes: "Comprobantes → en trámite" };
  const totalPorConfirmar = reportes.reduce((a, r) => a + r.porConfirmar.length, 0);

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>
        <Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link>
      </div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Conciliar reportes (PREI / OOAD)</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 780 }}>
        Sube los reportes de OOAD. SIGAF <strong>cruza y avanza el estatus solo</strong> lo que casa con certeza, y para lo
        demás te <strong>sugiere por importe</strong> qué contra-recibos impactaron para que los <strong>confirmes a mano</strong>.
      </p>

      <div style={{ ...card, marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button className="boton" onClick={cargarFacturas} disabled={cargando || guardando}>
          {cargando ? "Cargando facturas…" : facturas ? "Recargar facturas" : "1) Cargar facturas"}
        </button>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: facturas ? 1 : 0.5 }}>2) Subir reporte(s)</div>
          <input type="file" accept=".xls,.xlsx,.csv" onChange={onFile} disabled={!facturas || guardando} />
        </div>
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}
      {ok && <p style={{ color: "var(--verde)", fontSize: 14, marginTop: 12, fontWeight: 600 }}>{ok}</p>}

      {reportes.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>
              {totalAuto} automáticas + {totalConf} confirmadas · {totalPorConfirmar} por revisar
            </h2>
            <button className="boton" onClick={aplicar} disabled={guardando || (totalAuto + totalConf) === 0}>
              {guardando ? "Aplicando…" : `Aplicar ${totalAuto + totalConf} cambios`}
            </button>
          </div>

          {reportes.map((rep, i) => (
            <div key={i} style={{ ...card, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <strong style={{ fontSize: 14 }}>{rep.nombre}</strong>
                <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>{TIPO_LBL[rep.tipo]}{rep.tienePedRec ? " · +pedido/recepción" : ""}</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                <span style={{ color: "var(--verde)", fontWeight: 600 }}>{rep.matches.length} automáticas</span>
                {" · "}<span>{rep.porConfirmar.length} por confirmar</span>
                {" · "}<span style={{ color: "var(--texto-suave)" }}>{rep.sinCruce} sin cruce</span>
                {"  —  "}<span style={{ color: "var(--texto-suave)" }}>cruzado {money(rep.gastoCruzado)} · pendiente {money(rep.gastoPendiente)}</span>
              </div>

              {/* Por confirmar: sugerencias por importe */}
              {rep.porConfirmar.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Por confirmar — elige el contra-recibo que impactó:</div>
                  {rep.porConfirmar.slice(0, 60).map((pc) => (
                    <div key={pc.key} style={{ borderTop: "1px solid var(--borde)", padding: "8px 0" }}>
                      <div style={{ fontSize: 13 }}>
                        <strong>{money(pc.importe)}</strong> · Reporte: factura <em>{pc.facturaTxt || "—"}</em>
                        {pc.compr && <> · comprobante <em>{pc.compr}</em></>} · {pc.provTxt.slice(0, 30)}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {pc.candidatos.map((c) => {
                          const sel = confirmados[pc.key] === c.id;
                          return (
                            <button key={c.id} onClick={() => toggleConfirm(pc.key, c.id)}
                              style={{ fontSize: 12, padding: "5px 9px", borderRadius: 8, cursor: "pointer",
                                border: sel ? "2px solid var(--verde)" : "1px solid var(--borde)",
                                background: sel ? "color-mix(in srgb, var(--verde) 12%, transparent)" : "var(--blanco)" }}>
                              {sel ? "✓ " : ""}{c.f.folio_proveedor} · {c.f.proveedores?.razon_social?.slice(0, 20) ?? "—"} · {money(c.f.importe_factura)}
                              {c.f.cr_contrarecibo ? " · (ya tiene CR)" : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {rep.porConfirmar.length > 60 && <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 6 }}>… y {rep.porConfirmar.length - 60} más</p>}
                </div>
              )}

              {/* Automáticas */}
              {rep.matches.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 13, cursor: "pointer", color: "var(--verde)" }}>Ver {rep.matches.length} automáticas</summary>
                  <div style={{ overflowX: "auto", maxHeight: 280, marginTop: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr><th style={th}>Factura</th><th style={th}>Proveedor</th><th style={{ ...th, textAlign: "right" }}>Importe</th><th style={th}>Cruce</th><th style={th}>Cambios</th></tr></thead>
                      <tbody>
                        {rep.matches.slice(0, 200).map((m, k) => (
                          <tr key={k}>
                            <td style={td}>{m.f.folio_proveedor}</td>
                            <td style={{ ...td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.f.proveedores?.razon_social ?? "—"}</td>
                            <td style={{ ...td, textAlign: "right" }}>{money(m.f.importe_factura)}</td>
                            <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>{m.via}</td>
                            <td style={{ ...td, fontSize: 12 }}>
                              {m.cambios.estatus_general && <span>→ {m.cambios.estatus_general.replace(/_/g, " ")} </span>}
                              {m.cambios.estatus_pedido_recepcion && <span>· ped/rec </span>}
                              {m.cambios.cr_contrarecibo && <span>· CR {m.cambios.cr_contrarecibo}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          ))}
          <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 10 }}>
            Solo se avanzan estatus (nunca se retroceden). Las sugerencias por importe se aplican únicamente si tú las confirmas.
          </p>
        </>
      )}
    </div>
  );
}
