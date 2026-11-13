"use client";

// Folios de subrogados · resumen por contrato + detalle por factura.
// Cada folio es un "vale" de un servicio pedido al proveedor:
//   · con factura (ligada o del Avance) → FACTURADO (atrapado)
//   · sin factura y no cancelado        → DEVENGO (pendiente de cobrar)
//   · cancelado                          → no cuenta (ni en devengo)
// Los folios facturados son solo lectura. Los de devengo/cancelado se pueden alternar a mano.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { leerTodo } from "../../../lib/paginar";
import { marcarCancelado } from "../../../lib/subrogadosCarga";
import { sinDuplicadosCDSMS } from "../../../lib/subrogadosComun";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const money0 = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const fechaMX = (f) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : "—");
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const PUEDE_TOGGLE = ["jefe_presupuesto", "jefa_finanzas", "auo"];
const PAGADA = "gasto_reflejado";

const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 12, padding: "14px 16px" };
const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap" };
const td = { padding: "7px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13, verticalAlign: "top" };
const linkBtn = { background: "none", border: "none", color: "var(--verde)", cursor: "pointer", fontSize: 12.5, padding: 0 };

// Estado de un folio
function estadoDe(f) {
  if (f.factura_id || (f.factura_txt && String(f.factura_txt).trim())) return "facturado";
  if (f.cancelado) return "cancelado";
  return "devengo";
}

export default function SubrogadosPage() {
  const [folios, setFolios] = useState([]);
  const [contratos, setContratos] = useState(new Map()); // id -> { numero_interno, prov }
  const [facturas, setFacturas] = useState(new Map());    // id -> factura
  const [rol, setRol] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState("");
  const [detalle, setDetalle] = useState(null); // clave de contrato seleccionado (contrato_id o "txt:xxx")
  const [busca, setBusca] = useState("");
  const [selDev, setSelDev] = useState(new Set());
  const [selCanc, setSelCanc] = useState(new Set());
  const [trabajando, setTrabajando] = useState(false);
  const [vista, setVista] = useState("facturado");   // facturado | devengo | cancelado
  const [expandF, setExpandF] = useState(new Set());  // facturas (bloques) expandidas

  async function cargar() {
    setCargando(true); setMsg("");
    const [rF, rC, rFac, rU] = await Promise.all([
      leerTodo((d, h) => supabase.from("subrogados_folios")
        .select("clave, folio, fecha, anio, mes, contrato_id, contrato_txt, paciente, medico, estudio, cantidad, importe, cancelado, factura_id, factura_txt, origen")
        .order("fecha", { ascending: true }).order("folio").range(d, h)),
      leerTodo((d, h) => supabase.from("contratos").select("id, numero_interno, adquisicion_servicio, vigencia_inicio, vigencia_fin, proveedores ( razon_social ), partidas ( nombre )").order("numero_interno").range(d, h)),
      leerTodo((d, h) => supabase.from("facturas").select("id, folio_ingreso, folio_proveedor, importe_factura, estatus_general, anulada").eq("anulada", false).order("id").range(d, h)),
      supabase.auth.getUser(),
    ]);
    if (rF.error) { setMsg("No se pudieron cargar los folios: " + rF.error.message + " (¿corriste la migración 053?)"); setCargando(false); return; }
    // Si el folio viene en el Avance SMS, su copia del CD_SMS no se muestra ni se suma (no se duplica)
    setFolios(sinDuplicadosCDSMS(rF.data || []));
    setContratos(new Map((rC.data || []).map((c) => [c.id, { numero_interno: c.numero_interno, prov: c.proveedores?.razon_social || "—",
      servicio: c.adquisicion_servicio || c.partidas?.nombre || "—", vigIni: c.vigencia_inicio, vigFin: c.vigencia_fin }])));
    setFacturas(new Map((rFac.data || []).map((f) => [f.id, f])));
    const authId = rU?.data?.user?.id;
    if (authId) { const { data: p } = await supabase.from("usuarios").select("rol").eq("auth_id", authId).maybeSingle(); setRol(p?.rol || null); }
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  const puedeToggle = PUEDE_TOGGLE.includes(rol);
  const claveCto = (f) => (f.contrato_id ? f.contrato_id : `txt:${(f.contrato_txt || "sin contrato").trim()}`);
  const nombreCto = (f) => (f.contrato_id ? (contratos.get(f.contrato_id)?.numero_interno || "—") : (f.contrato_txt || "Sin contrato"));
  const provCto = (f) => (f.contrato_id ? (contratos.get(f.contrato_id)?.prov || "—") : "—");
  const servCto = (f) => (f.contrato_id ? (contratos.get(f.contrato_id)?.servicio || "—") : "—");
  const vigCto = (f) => {
    const c = f.contrato_id ? contratos.get(f.contrato_id) : null;
    return c && (c.vigIni || c.vigFin) ? `${fechaMX(c.vigIni)} → ${fechaMX(c.vigFin)}` : "—";
  };

  // ----- Resumen por contrato -----
  const resumen = useMemo(() => {
    const g = new Map();
    for (const f of folios) {
      const k = claveCto(f);
      const x = g.get(k) || { k, contrato: nombreCto(f), prov: provCto(f), servicio: servCto(f), vigencia: vigCto(f), folios: 0, nFac: 0, impFac: 0, nDev: 0, impDev: 0, nCanc: 0 };
      const e = estadoDe(f); const imp = Number(f.importe) || 0;
      x.folios++;
      if (e === "facturado") { x.nFac++; x.impFac = r2(x.impFac + imp); }
      else if (e === "devengo") { x.nDev++; x.impDev = r2(x.impDev + imp); }
      else x.nCanc++;
      g.set(k, x);
    }
    let rows = [...g.values()].sort((a, b) => b.impDev - a.impDev || b.impFac - a.impFac);
    const q = busca.trim().toUpperCase();
    if (q) rows = rows.filter((r) => `${r.contrato} ${r.prov} ${r.servicio}`.toUpperCase().includes(q));
    return rows;
  }, [folios, contratos, busca]);

  const kpis = useMemo(() => {
    let impDev = 0, impFac = 0, nDev = 0;
    for (const f of folios) { const e = estadoDe(f); const imp = Number(f.importe) || 0;
      if (e === "devengo") { impDev += imp; nDev++; } else if (e === "facturado") impFac += imp; }
    return { impDev: r2(impDev), impFac: r2(impFac), nDev };
  }, [folios]);

  // ----- Detalle de un contrato -----
  const det = useMemo(() => {
    if (!detalle) return null;
    const fs = folios.filter((f) => claveCto(f) === detalle);
    if (!fs.length) return null;
    const porFactura = new Map(); // key -> { factura, txt, folios[] }
    const devengo = [], cancelados = [];
    for (const f of fs) {
      const e = estadoDe(f);
      if (e === "facturado") {
        const key = f.factura_id ? `id:${f.factura_id}` : `txt:${String(f.factura_txt).trim()}`;
        const grp = porFactura.get(key) || { key, factura: f.factura_id ? facturas.get(f.factura_id) : null, txt: f.factura_txt, folios: [] };
        grp.folios.push(f); porFactura.set(key, grp);
      } else if (e === "cancelado") cancelados.push(f);
      else devengo.push(f);
    }
    const bloques = [...porFactura.values()].map((b) => ({ ...b, subtotal: r2(b.folios.reduce((s, f) => s + (Number(f.importe) || 0), 0)),
      pagada: b.factura?.estatus_general === PAGADA }))
      .sort((a, b) => (a.factura?.folio_ingreso || a.txt || "").localeCompare(b.factura?.folio_ingreso || b.txt || ""));
    return {
      contrato: fs[0] ? nombreCto(fs[0]) : "—", prov: fs[0] ? provCto(fs[0]) : "—",
      servicio: fs[0] ? servCto(fs[0]) : "—", vigencia: fs[0] ? vigCto(fs[0]) : "—",
      bloques, devengo, cancelados,
      impDev: r2(devengo.reduce((s, f) => s + (Number(f.importe) || 0), 0)),
      impFac: r2(bloques.reduce((s, b) => s + b.subtotal, 0)),
    };
  }, [detalle, folios, facturas, contratos]);

  async function alternar(claves, aCancelado) {
    if (!claves.length) return;
    setTrabajando(true); setMsg("");
    try {
      await marcarCancelado(claves, aCancelado);
      setSelDev(new Set()); setSelCanc(new Set());
      await cargar();
      setMsg(`${claves.length} folio(s) ${aCancelado ? "marcados como CANCELADOS" : "regresados a DEVENGO"}.`);
    } catch (e) { setMsg(e.message); }
    setTrabajando(false);
  }

  async function exportarExcel() {
    if (!det) return;
    const mod = await import("xlsx");
    const XLSX = mod.default || mod;
    const fila = (f, estatus, factura, folioSigaf) => ({
      Folio: f.folio, Fecha: fechaMX(f.fecha), Paciente: f.paciente || "", Médico: f.medico || "",
      Estudio: f.estudio || "", Importe: Number(f.importe) || 0, Factura: factura || "", "Folio SIGAF": folioSigaf || "", Estatus: estatus,
    });
    const rows = [];
    for (const b of det.bloques) for (const f of b.folios)
      rows.push(fila(f, b.pagada ? "Facturado (pagada)" : "Facturado", b.factura?.folio_proveedor || b.txt, b.factura?.folio_ingreso));
    for (const f of det.devengo) rows.push(fila(f, "Devengo", "", ""));
    for (const f of det.cancelados) rows.push(fila(f, "Cancelado", "", ""));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 8 }, { wch: 11 }, { wch: 30 }, { wch: 26 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Folios");
    XLSX.writeFile(wb, `Subrogados_${(det.contrato || "contrato").replace(/[^\w]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (cargando) return <p style={{ padding: 8 }}>Cargando folios de subrogados…</p>;

  // ---------- Vista DETALLE ----------
  if (detalle && det) {
    const tdRow = (f, estado) => (
      <tr key={f.clave}>
        <td style={{ ...td, whiteSpace: "nowrap" }}>{f.folio}</td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>{fechaMX(f.fecha)}</td>
        <td style={td}>{f.paciente || "—"}</td>
        <td style={td}>{f.estudio || "—"}</td>
        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(f.importe)}</td>
      </tr>
    );
    const cab = ["Folio", "Fecha", "Paciente", "Estudio", "Importe"];
    return (
      <div>
        <div className="no-print" style={{ fontSize: 13, marginBottom: 6 }}>
          <button onClick={() => { setDetalle(null); setSelDev(new Set()); setSelCanc(new Set()); setMsg(""); }} style={{ color: "var(--verde)", background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}>← Volver al resumen</button>
          <span style={{ color: "var(--texto-suave)" }}> · Inicio › Presupuesto › Folios de subrogados</span>
        </div>
        <h1 style={{ fontSize: 21, margin: "4px 0 0" }}>{det.contrato}</h1>
        <div style={{ fontSize: 13, color: "var(--texto-suave)", marginBottom: 2 }}>{det.prov} · Facturado {money(det.impFac)} · Devengo <b style={{ color: "#7c3aed" }}>{money(det.impDev)}</b></div>
        <div style={{ fontSize: 12.5, color: "var(--texto-suave)", marginBottom: 10 }}>{det.servicio !== "—" ? det.servicio : "Sin servicio capturado"} · Vigencia {det.vigencia}</div>
        {msg && <div style={{ background: "#eef7f1", color: "#166534", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{msg}</div>}

        {/* Barra: chips para ir directo a cada grupo + descargar Excel */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          {[
            ["facturado", `Facturados (${det.bloques.reduce((s, b) => s + b.folios.length, 0)})`, "#166534", "#dcfce7"],
            ["devengo", `Devengo (${det.devengo.length})`, "#6d28d9", "#f3e8ff"],
            ["cancelado", `Cancelados (${det.cancelados.length})`, "#6b7280", "#eef2f5"],
          ].map(([v, label, col, bg]) => (
            <button key={v} onClick={() => setVista(v)} style={{ cursor: "pointer", fontSize: 13, fontWeight: vista === v ? 700 : 500, padding: "7px 14px", borderRadius: 999, border: `1px solid ${vista === v ? col : "var(--borde)"}`, background: vista === v ? bg : "var(--blanco)", color: vista === v ? col : "var(--texto)" }}>{label}</button>
          ))}
          <button className="boton secundario" onClick={exportarExcel} style={{ marginLeft: "auto", fontSize: 12.5 }}>⬇ Excel del contrato</button>
        </div>

        {/* FACTURADOS (facturas colapsables: una línea cada una, se abre al clic) */}
        {vista === "facturado" && (
          <div>
            {det.bloques.length > 1 && (
              <div style={{ marginBottom: 8, fontSize: 12.5 }}>
                <button onClick={() => setExpandF(new Set(det.bloques.map((b) => b.key)))} style={linkBtn}>Abrir todas</button>
                <span style={{ color: "var(--borde)" }}> · </span>
                <button onClick={() => setExpandF(new Set())} style={linkBtn}>Cerrar todas</button>
              </div>
            )}
            {det.bloques.map((b) => {
              const abierto = expandF.has(b.key);
              return (
                <div key={b.key} style={{ ...card, marginBottom: 8, padding: "10px 14px", borderColor: b.pagada ? "#86efac" : "var(--borde)" }}>
                  <div onClick={() => setExpandF((p) => { const n = new Set(p); n.has(b.key) ? n.delete(b.key) : n.add(b.key); return n; })}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, cursor: "pointer" }}>
                    <div>
                      <span style={{ color: "var(--texto-suave)", marginRight: 6 }}>{abierto ? "▾" : "▸"}</span>
                      <strong style={{ fontSize: 14 }}>
                        {b.factura ? <>Factura {b.factura.folio_proveedor || "—"} · <Link href={`/facturas/${b.factura.id}`} onClick={(e) => e.stopPropagation()} style={{ color: "var(--verde)" }}>{b.factura.folio_ingreso}</Link></>
                          : <>Factura {b.txt} <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}>(del Avance SMS)</span></>}
                      </strong>
                      {b.pagada && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: "#15803d" }}>🔒 Pagada</span>}
                    </div>
                    <span style={{ fontSize: 13 }}>{b.folios.length} folio(s) · <strong>{money(b.subtotal)}</strong></span>
                  </div>
                  {abierto && (
                    <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 8, marginTop: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr>{cab.map((h) => <th key={h} style={{ ...th, textAlign: h === "Importe" ? "right" : "left" }}>{h}</th>)}</tr></thead>
                        <tbody>{b.folios.map((f) => tdRow(f))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {det.bloques.length === 0 && <div style={{ ...card, color: "var(--texto-suave)", fontSize: 13 }}>Este contrato aún no tiene folios facturados.</div>}
          </div>
        )}

        {/* DEVENGO (sin factura) — se puede cancelar a mano */}
        {vista === "devengo" && (
          <div style={{ ...card, marginBottom: 12, borderColor: "#c4b5fd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <strong style={{ fontSize: 14, color: "#6d28d9" }}>Devengo (sin factura) — {det.devengo.length} folio(s) · {money(det.impDev)}</strong>
              {puedeToggle && det.devengo.length > 0 && (
                <button className="boton secundario" disabled={!selDev.size || trabajando} onClick={() => alternar([...selDev], true)} style={{ fontSize: 12.5 }}>
                  Marcar {selDev.size || ""} como cancelado(s)
                </button>
              )}
            </div>
            <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{puedeToggle && <th style={{ ...th, width: 28 }} />}{cab.map((h) => <th key={h} style={{ ...th, textAlign: h === "Importe" ? "right" : "left" }}>{h}</th>)}</tr></thead>
                <tbody>{det.devengo.map((f) => (
                  <tr key={f.clave} onClick={() => puedeToggle && setSelDev((p) => { const n = new Set(p); n.has(f.clave) ? n.delete(f.clave) : n.add(f.clave); return n; })}
                    style={{ cursor: puedeToggle ? "pointer" : "default", background: selDev.has(f.clave) ? "#f3e8ff" : undefined }}>
                    {puedeToggle && <td style={td}><input type="checkbox" checked={selDev.has(f.clave)} readOnly /></td>}
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{f.folio}</td><td style={{ ...td, whiteSpace: "nowrap" }}>{fechaMX(f.fecha)}</td>
                    <td style={td}>{f.paciente || "—"}</td><td style={td}>{f.estudio || "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(f.importe)}</td>
                  </tr>
                ))}
                {det.devengo.length === 0 && <tr><td colSpan={puedeToggle ? 6 : 5} style={{ ...td, color: "var(--texto-suave)" }}>Nada en devengo.</td></tr>}</tbody>
              </table>
            </div>
            {!puedeToggle && <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 6 }}>Solo Presupuesto, Finanzas o ventanilla pueden mover devengo/cancelado.</div>}
          </div>
        )}

        {/* CANCELADOS — se pueden regresar a devengo */}
        {vista === "cancelado" && (
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <strong style={{ fontSize: 14, color: "var(--texto-suave)" }}>Cancelados — {det.cancelados.length} folio(s) · no cuentan</strong>
              {puedeToggle && det.cancelados.length > 0 && (
                <button className="boton secundario" disabled={!selCanc.size || trabajando} onClick={() => alternar([...selCanc], false)} style={{ fontSize: 12.5 }}>
                  Regresar {selCanc.size || ""} a devengo
                </button>
              )}
            </div>
            <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{puedeToggle && <th style={{ ...th, width: 28 }} />}{cab.map((h) => <th key={h} style={{ ...th, textAlign: h === "Importe" ? "right" : "left" }}>{h}</th>)}</tr></thead>
                <tbody>{det.cancelados.map((f) => (
                  <tr key={f.clave} onClick={() => puedeToggle && setSelCanc((p) => { const n = new Set(p); n.has(f.clave) ? n.delete(f.clave) : n.add(f.clave); return n; })}
                    style={{ cursor: puedeToggle ? "pointer" : "default", color: "var(--texto-suave)", background: selCanc.has(f.clave) ? "#f1f5f9" : undefined }}>
                    {puedeToggle && <td style={td}><input type="checkbox" checked={selCanc.has(f.clave)} readOnly /></td>}
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{f.folio}</td><td style={{ ...td, whiteSpace: "nowrap" }}>{fechaMX(f.fecha)}</td>
                    <td style={td}>{f.paciente || "—"}</td><td style={td}>{f.estudio || "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", textDecoration: "line-through" }}>{money(f.importe)}</td>
                  </tr>
                ))}
                {det.cancelados.length === 0 && <tr><td colSpan={puedeToggle ? 6 : 5} style={{ ...td, color: "var(--texto-suave)" }}>Sin cancelados.</td></tr>}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- Vista RESUMEN ----------
  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Inicio</Link><span style={{ color: "var(--texto-suave)" }}> › Presupuesto › Folios de subrogados</span></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Folios de subrogados</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 4 }}>Resumen por contrato. Entra a un contrato para ver qué folios se facturaron, cuáles están en devengo y cuáles cancelados.</p>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: "12px 0" }}>
        <div style={{ ...card, borderColor: "#c4b5fd" }}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>En devengo (sin facturar)</div><div style={{ fontSize: 24, fontWeight: 800, color: "#6d28d9" }}>{money0(kpis.impDev)}</div><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{kpis.nDev} folio(s)</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Facturado (atrapado)</div><div style={{ fontSize: 24, fontWeight: 800, color: "#166534" }}>{money0(kpis.impFac)}</div></div>
        <div style={card}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Contratos con folios</div><div style={{ fontSize: 24, fontWeight: 800 }}>{resumen.length}</div></div>
      </div>

      <div style={{ ...card }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar contrato, proveedor o servicio…" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14, width: "100%", maxWidth: 360, boxSizing: "border-box", marginBottom: 10 }} />
        {msg && <div style={{ background: "var(--ambar-claro)", color: "var(--ambar)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 8 }}>{msg}</div>}
        <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Contrato</th><th style={th}>Proveedor</th>
              <th style={th}>Servicio / partidas</th><th style={th}>Vigencia</th>
              <th style={{ ...th, textAlign: "right" }}>Folios</th>
              <th style={{ ...th, textAlign: "right" }}>Facturados</th><th style={{ ...th, textAlign: "right" }}>$ Facturado</th>
              <th style={{ ...th, textAlign: "right" }}>Devengo</th><th style={{ ...th, textAlign: "right" }}>$ Devengo</th>
              <th style={{ ...th, textAlign: "right" }}>Cancel.</th><th style={th} />
            </tr></thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.k} style={{ cursor: "pointer" }} onClick={() => { setDetalle(r.k); setMsg(""); setSelDev(new Set()); setSelCanc(new Set()); setVista("facturado"); setExpandF(new Set()); }}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.contrato}</td>
                  <td style={td}>{r.prov}</td>
                  <td style={{ ...td, maxWidth: 260, fontSize: 12.5 }}>{r.servicio}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12.5 }}>{r.vigencia}</td>
                  <td style={{ ...td, textAlign: "right" }}>{r.folios}</td>
                  <td style={{ ...td, textAlign: "right" }}>{r.nFac}</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(r.impFac)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#7c3aed", fontWeight: r.nDev ? 700 : 400 }}>{r.nDev}</td>
                  <td style={{ ...td, textAlign: "right", color: "#7c3aed", fontWeight: r.impDev ? 700 : 400 }}>{money(r.impDev)}</td>
                  <td style={{ ...td, textAlign: "right", color: "var(--texto-suave)" }}>{r.nCanc}</td>
                  <td style={{ ...td, textAlign: "right", color: "var(--verde)", whiteSpace: "nowrap" }}>Ver ›</td>
                </tr>
              ))}
              {resumen.length === 0 && <tr><td style={td} colSpan={11}>No hay folios de subrogados cargados. Súbelos en Cargar reportes (Avance SMS / CD_SMS).</td></tr>}
              {resumen.length > 0 && (
                <tr>
                  <td style={{ ...td, fontWeight: 800, borderTop: "2px solid #333" }}>TOTAL ({resumen.length})</td>
                  <td style={{ ...td, borderTop: "2px solid #333" }} />
                  <td style={{ ...td, borderTop: "2px solid #333" }} />
                  <td style={{ ...td, borderTop: "2px solid #333" }} />
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, borderTop: "2px solid #333" }}>{resumen.reduce((s, r) => s + r.folios, 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, borderTop: "2px solid #333" }}>{resumen.reduce((s, r) => s + r.nFac, 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, borderTop: "2px solid #333" }}>{money(resumen.reduce((s, r) => s + r.impFac, 0))}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#7c3aed", borderTop: "2px solid #333" }}>{resumen.reduce((s, r) => s + r.nDev, 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#7c3aed", borderTop: "2px solid #333" }}>{money(resumen.reduce((s, r) => s + r.impDev, 0))}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, borderTop: "2px solid #333" }}>{resumen.reduce((s, r) => s + r.nCanc, 0)}</td>
                  <td style={{ ...td, borderTop: "2px solid #333" }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
