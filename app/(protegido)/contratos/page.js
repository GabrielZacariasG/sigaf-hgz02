"use client";

// Fase 3 (30/10/2026) Â· Contratos: reemplaza las hojas "Ã¡rea mÃ©dica", "subrogados", "linea am" y "lin sub" de la cÃ©dula.
// Una sola pantalla con filtro por capÃ­tulo y dos vistas:
//   Â· Control: mismas columnas de la cÃ©dula (mÃ¡ximos, ampliaciÃ³n, enlace, pagos, facturado, devengo, saldo, avance,
//     proyecciÃ³n, sobrante/faltante, pasivo y meses) agrupado por partida con TOTAL / PRESUPUESTO / DIFERENCIA.
//   Â· LÃ­nea mensual: programado (ESC 1 / AMP) contra gasto y devengo, saldo acumulado; aquÃ­ se captura el devengo.
// Gasto, pagos y pasivo salen de las facturas de SIGAF; nada se teclea.
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";
import { leerTodo } from "../../../lib/paginar";
import { calcularContrato, sumar, ANIO } from "../../../lib/contratos";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const money0 = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const pctTxt = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
const fechaTxt = (f) => (f ? new Date(f + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "â€”");
const MESES = ["", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const esGenerico = (c) => /^(CE|CB)-/.test(c.numero_interno || "");

export default function ContratosPage() {
  const [datos, setDatos] = useState(null);
  const [msg, setMsg] = useState("");
  const [capitulo, setCapitulo] = useState("");
  const [vista, setVista] = useState("control");
  const [con2025, setCon2025] = useState(false);
  const [busca, setBusca] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [guardando, setGuardando] = useState("");

  const cargar = async () => {
    const [rC, rF, rA, rP, rD, rR, rCo] = await Promise.all([
      leerTodo((d, h) => supabase.from("contratos").select("*, proveedores ( razon_social ), partidas ( id, cuenta_finat, nombre, capitulos ( nombre ) )").order("numero_interno").range(d, h)),
      leerTodo((d, h) => supabase.from("facturas").select("id, contrato_id, folio_ingreso, folio_proveedor, importe_factura, estatus_general, es_pasivo, anio_presupuestal, mes_presupuestal, periodo_inicio, fecha_factura, cr_contrarecibo, fecha_pago")
        .eq("anulada", false).neq("estatus_general", "devuelta_proveedor").order("id").range(d, h)),
      leerTodo((d, h) => supabase.from("contrato_ampliaciones").select("*").order("id").range(d, h)),
      leerTodo((d, h) => supabase.from("contrato_programado").select("*").order("id").range(d, h)),
      leerTodo((d, h) => supabase.from("ajustes_devengo").select("*").order("id").range(d, h)),
      leerTodo((d, h) => supabase.from("contrato_reservas").select("*, partidas ( cuenta_finat )").order("id").range(d, h)),
      supabase.from("dispo_cortes").select("fecha").order("fecha", { ascending: false }).limit(1),
    ]);
    const err = [rC, rF, rA, rP, rD, rR].find((r) => r.error);
    if (err) { setMsg("No se pudo cargar: " + err.error.message + " (Â¿ya se corrieron las migraciones 045 y 046?)"); return; }
    let presupuesto = {}; const fechaDispo = rCo.data?.[0]?.fecha || null;
    if (fechaDispo) {
      const rM = await leerTodo((d, h) => supabase.from("dispo_mensual").select("cuenta_finat, presupuesto").eq("fecha", fechaDispo).order("cuenta_finat").range(d, h));
      for (const r of rM.data || []) presupuesto[r.cuenta_finat] = (presupuesto[r.cuenta_finat] || 0) + (Number(r.presupuesto) || 0);
    }
    setDatos({ contratos: rC.data || [], facturas: rF.data || [], amp: rA.data || [], prog: rP.data || [], dev: rD.data || [], reservas: rR.data || [], presupuesto, fechaDispo });
  };
  useEffect(() => { cargar(); }, []);

  const capitulos = useMemo(() => [...new Set((datos?.contratos || []).filter((c) => !esGenerico(c)).map((c) => c.partidas?.capitulos?.nombre).filter(Boolean))].sort(), [datos]);
  useEffect(() => { if (!capitulo && capitulos.length) setCapitulo(capitulos.includes("Area Medica Ctas") ? "Area Medica Ctas" : capitulos[0]); }, [capitulos, capitulo]);

  // Contratos calculados, agrupados por partida
  const bloques = useMemo(() => {
    if (!datos) return [];
    const por = (arr, k) => { const m = {}; for (const x of arr) (m[x[k]] ||= []).push(x); return m; };
    const fPor = por(datos.facturas, "contrato_id"), aPor = por(datos.amp, "contrato_id"), pPor = por(datos.prog, "contrato_id"), dPor = por(datos.dev, "contrato_id");
    const q = busca.trim().toLowerCase();
    const lista = datos.contratos
      .filter((c) => !esGenerico(c))
      .filter((c) => capitulo === "*" || c.partidas?.capitulos?.nombre === capitulo)
      .map((c) => ({ c, x: calcularContrato(c, { facturas: fPor[c.id] || [], ampliaciones: aPor[c.id] || [], devengos: dPor[c.id] || [], programado: pPor[c.id] || [] }), facturas: fPor[c.id] || [], ampliaciones: aPor[c.id] || [] }))
      .filter(({ c, x }) => con2025 || (c.vigencia_fin || "9999") >= `${ANIO}-01-01` || x.pasivo > 0)
      .filter(({ c }) => !q || [c.numero_interno, c.numero_alterno, c.concepto, c.dictamen_numero, c.proveedores?.razon_social].join(" ").toLowerCase().includes(q));
    const g = {};
    for (const it of lista) { const k = it.c.partidas?.cuenta_finat || "â€”"; (g[k] ||= { cuenta: k, nombre: it.c.partidas?.nombre || "", filas: [], reservas: [] }).filas.push(it); }
    for (const r of datos.reservas) { const k = r.partidas?.cuenta_finat; if (g[k] && !q) g[k].reservas.push(r); }
    return Object.values(g).sort((a, b) => a.cuenta.localeCompare(b.cuenta)).map((b) => ({ ...b, filas: b.filas.sort((p, s) => (p.c.vigencia_inicio || "").localeCompare(s.c.vigencia_inicio || "")) }));
  }, [datos, capitulo, con2025, busca]);

  // ---------- Devengo: captura por contrato y mes ----------
  const guardarDevengo = async (contratoId, mes, valor) => {
    const imp = Number(String(valor).replace(/[^0-9.\-]/g, "")) || 0;
    setGuardando(`${contratoId}|${mes}`);
    const { error: e1 } = await supabase.from("ajustes_devengo").delete().eq("contrato_id", contratoId).eq("anio_presupuestal", ANIO).eq("mes_presupuestal", mes).eq("origen", "captura");
    let e2 = null;
    if (!e1 && imp) ({ error: e2 } = await supabase.from("ajustes_devengo").insert({ contrato_id: contratoId, anio_presupuestal: ANIO, mes_presupuestal: mes, importe: imp, origen: "captura", motivo: "Servicio recibido sin factura" }));
    setGuardando("");
    if (e1 || e2) { setMsg("No se pudo guardar el devengo: " + (e1 || e2).message); return; }
    await cargar();
  };

  // ---------- Exportar como la cÃ©dula ----------
  const exportar = () => {
    const enc = ["Concepto", "Dictamen", "Tipo", "Contrato", "Contrato alterno", "Partida", "Proveedor", "Vigencia", "Administrador de contrato", "Importe mÃ¡ximo contrato", "Importe mÃ¡ximo unidad", "Amp o red", "Enlace", "Pagos", "Gasto facturado", "Devengo", "Gasto fac + dev", "Saldo devengo", "% Avance", "ProyecciÃ³n", "Sobrante / Faltante", "Pasivo", ...MESES.slice(1), "TOTAL"];
    const aoa = [[`CONTROL DE CONTRATOS Â· ${capitulo === "*" ? "Todos" : capitulo} Â· SIGAF ${new Date().toLocaleDateString("es-MX")}`], []];
    for (const b of bloques) {
      aoa.push([`${b.cuenta} Â· ${b.nombre}`]); aoa.push(enc);
      for (const { c, x } of b.filas) aoa.push([c.concepto, c.dictamen_numero, c.dictamen_tipo, c.numero_interno, c.numero_alterno, b.cuenta, c.proveedores?.razon_social, `${fechaTxt(c.vigencia_inicio)} al ${fechaTxt(c.vigencia_fin)}`, c.administrador_contrato,
        x.maxC, x.maxU, x.amp, x.enlace, x.pagos, x.facturado, x.devengo, x.facDev, x.saldo, x.avance, x.proyeccion, x.sobrante, x.pasivo, ...x.mensual.slice(1).map((v, i) => v + x.devengoMes[i + 1]), x.mensual.reduce((s, v) => s + v, 0) + x.devengo]);
      for (const r of b.reservas) aoa.push([r.concepto, r.estatus, "", "", "", b.cuenta, r.estatus.toUpperCase(), "", "", "", r.importe]);
      const t = sumar(b.filas.map((f) => f.x)); const res = b.reservas.reduce((s, r) => s + (Number(r.importe) || 0), 0); const pre = datos.presupuesto[b.cuenta] || 0;
      aoa.push(["", "", "", "", "", "", "", "", "TOTAL", t.maxC, t.maxU + res, t.amp, t.enlace + res, t.pagos, t.facturado, t.devengo, t.facDev, t.saldo, t.avance, t.proyeccion, t.sobrante, t.pasivo]);
      aoa.push(["", "", "", "", "", "", "", "", "PRESUPUESTO", "", pre, "", "", "Pte pago", t.facturado - t.pagos]);
      aoa.push(["", "", "", "", "", "", "", "", "DIFERENCIA", "", pre - (t.enlace + res), "", "", "Pte facturar", t.devengo]);
      aoa.push([]);
    }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "contratos");
    XLSX.writeFile(wb, `CONTRATOS SIGAF ${capitulo === "*" ? "TODOS" : capitulo.toUpperCase()}.xlsx`);
  };

  // ---------- estilos ----------
  const th = { background: "var(--verde)", color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "6px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,.25)", lineHeight: 1.15, position: "sticky", top: 0, zIndex: 2 };
  const td = { padding: "4px 8px", borderBottom: "1px solid var(--borde)", borderRight: "1px solid var(--borde)", fontSize: 12.5, whiteSpace: "nowrap" };
  const tdN = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const ANCHO = [210, 150], IZQ = [0, 210];
  const fija = (i, bg) => ({ position: "sticky", left: IZQ[i], minWidth: ANCHO[i], maxWidth: ANCHO[i], zIndex: 1, background: bg || "var(--blanco)", overflow: "hidden", textOverflow: "ellipsis", boxShadow: i === 1 ? "2px 0 0 var(--borde)" : undefined });
  const thFija = (i) => ({ ...th, left: IZQ[i], zIndex: 3, minWidth: ANCHO[i], maxWidth: ANCHO[i] });
  const colorAvance = (a) => (a >= 1 ? "#dc2626" : a >= 0.8 ? "#d97706" : "var(--verde)");
  const Semaforo = ({ x }) => x.avisos.length ? <span title={x.avisos.map((a) => a.t).join(" Â· ")} style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, marginRight: 6, background: x.avisos.some((a) => a.nivel === "rojo") ? "#dc2626" : "#d97706" }} /> : null;
  const ENC = ["Concepto", "Contrato", "Dictamen", "Tipo", "Alterno", "Proveedor", "Vigencia", "Administrador", "MÃ¡x. contrato", "MÃ¡x. unidad", "Amp o red", "Enlace", "Pagos", "Gasto facturado", "Devengo", "Fac + dev", "Saldo", "% Avance", "ProyecciÃ³n", "Sobrante / Faltante", "Pasivo", ...MESES.slice(1), "Total"];

  if (msg && !datos) return <p style={{ color: "var(--rojo)" }}>{msg}</p>;
  if (!datos) return <p>Cargando contratosâ€¦</p>;

  const filaContrato = ({ c, x, facturas, ampliaciones }) => {
    const k = c.id; const sel = abierto === k; const bg = sel ? "#fff7d6" : null;
    return (
      <Fragment key={k}>
        <tr onClick={() => setAbierto(sel ? null : k)} style={{ cursor: "pointer", background: bg || undefined }} title="Clic para ver facturas, ampliaciones y avisos">
          <td style={{ ...td, ...fija(0, bg) }} title={c.concepto}><Semaforo x={x} />{c.concepto || "â€”"}</td>
          <td style={{ ...td, ...fija(1, bg), fontWeight: 600 }} title={c.numero_interno}>{c.numero_interno}</td>
          <td style={td}>{c.dictamen_numero || ""}</td><td style={td}>{c.dictamen_tipo || ""}</td><td style={td}>{c.numero_alterno || ""}</td>
          <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }} title={c.proveedores?.razon_social}>{c.proveedores?.razon_social}</td>
          <td style={td}>{fechaTxt(c.vigencia_inicio)} al {fechaTxt(c.vigencia_fin)}</td>
          <td style={{ ...td, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }} title={c.administrador_contrato}>{c.administrador_contrato || ""}</td>
          <td style={tdN}>{x.maxC ? money(x.maxC) : ""}</td><td style={tdN}>{money(x.maxU)}</td><td style={tdN}>{x.amp ? money(x.amp) : ""}</td>
          <td style={{ ...tdN, fontWeight: 700 }}>{money(x.enlace)}</td><td style={tdN}>{money(x.pagos)}</td><td style={tdN}>{money(x.facturado)}</td>
          <td style={{ ...tdN, color: x.devengo ? "#7c3aed" : undefined }}>{x.devengo ? money(x.devengo) : ""}</td>
          <td style={tdN}>{money(x.facDev)}</td>
          <td style={{ ...tdN, color: x.saldo < -0.5 ? "var(--rojo)" : undefined }}>{money(x.saldo)}</td>
          <td style={{ ...tdN, color: colorAvance(x.avance), fontWeight: 700 }}>{x.enlace ? pctTxt(x.avance) : ""}</td>
          <td style={tdN}>{money(x.proyeccion)}</td>
          <td style={{ ...tdN, color: x.sobrante < -0.5 ? "var(--rojo)" : undefined, fontWeight: 600 }}>{money(x.sobrante)}</td>
          <td style={tdN}>{x.pasivo ? money(x.pasivo) : ""}</td>
          {x.mensual.slice(1).map((v, i) => <td key={i} style={tdN}>{v + x.devengoMes[i + 1] ? money0(v + x.devengoMes[i + 1]) : ""}</td>)}
          <td style={{ ...tdN, fontWeight: 700 }}>{money(x.mensual.reduce((s, v) => s + v, 0) + x.devengo)}</td>
        </tr>
        {sel && (
          <tr><td colSpan={ENC.length} style={{ padding: "10px 14px", background: "#f7f8f7", borderBottom: "2px solid var(--verde)" }}>
            <div style={{ position: "sticky", left: 14, maxWidth: "calc(100vw - 80px)" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <strong>{c.numero_interno}</strong><span>{c.proveedores?.razon_social}</span>
                {x.avisos.map((a, i) => <span key={i} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 99, background: a.nivel === "rojo" ? "#fee2e2" : "#fef3c7", color: a.nivel === "rojo" ? "#b91c1c" : "#92400e" }}>{a.t}</span>)}
                <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>Tope de ampliaciÃ³n ({c.tope_ampliacion_pct ?? 20}%): {money(x.tope)}</span>
              </div>
              {ampliaciones.length > 0 && <div style={{ fontSize: 12, marginBottom: 6 }}><strong>Ampliaciones / reducciones:</strong> {ampliaciones.map((a) => `${money(a.importe)}${a.fecha ? " el " + fechaTxt(a.fecha) : ""}${a.convenio ? " (" + a.convenio + ")" : ""}`).join(" Â· ")}</div>}
              <div style={{ maxHeight: 260, overflow: "auto" }}>
                <table style={{ borderCollapse: "collapse" }}>
                  <thead><tr>{["Folio ingreso", "Factura", "Mes", "Importe", "Pasivo", "Estatus", "CR", "Fecha de pago"].map((h) => <th key={h} style={{ ...th, position: "static", background: "#4b5563" }}>{h}</th>)}</tr></thead>
                  <tbody>{facturas.slice().sort((a, b) => (a.periodo_inicio || "").localeCompare(b.periodo_inicio || "")).map((f) => (
                    <tr key={f.id}><td style={td}><Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)" }}>{f.folio_ingreso}</Link></td><td style={td}>{f.folio_proveedor}</td>
                      <td style={td}>{f.mes_presupuestal ? `${MESES[f.mes_presupuestal]} ${f.anio_presupuestal}` : ""}</td><td style={tdN}>{money(f.importe_factura)}</td><td style={td}>{f.es_pasivo ? "SÃ­" : ""}</td>
                      <td style={td}>{f.estatus_general === "gasto_reflejado" ? "Pagada" : f.estatus_general}</td><td style={td}>{f.cr_contrarecibo || ""}</td><td style={td}>{f.fecha_pago ? fechaTxt(f.fecha_pago) : ""}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </td></tr>
        )}
      </Fragment>
    );
  };

  const filtros = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select value={capitulo} onChange={(e) => { setCapitulo(e.target.value); setAbierto(null); }} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 13 }}>
        {capitulos.map((c) => <option key={c} value={c}>{c}</option>)}<option value="*">Todos los capÃ­tulos</option>
      </select>
      <button className={vista === "control" ? "boton" : "boton secundario"} onClick={() => setVista("control")} style={{ fontSize: 13, padding: "6px 14px" }}>Control</button>
      <button className={vista === "linea" ? "boton" : "boton secundario"} onClick={() => setVista("linea")} style={{ fontSize: 13, padding: "6px 14px" }}>LÃ­nea mensual</button>
      <label style={{ fontSize: 13 }}><input type="checkbox" checked={con2025} onChange={(e) => setCon2025(e.target.checked)} /> incluir contratos 2025 ya cerrados</label>
      <input placeholder="Buscar contrato, proveedor, dictamenâ€¦" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--borde)", minWidth: 220 }} />
      <button className="boton secundario" onClick={exportar} style={{ fontSize: 13 }}>â¬‡ Descargar como cÃ©dula</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Contratos {ANIO}</h1>
          <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>Control por contrato como en la cÃ©dula Â· gasto, pagos y pasivo desde las facturas de SIGAF Â· presupuesto de la dispo del {fechaTxt(datos.fechaDispo)}</div>
        </div>
        {filtros}
      </div>
      {msg && <p style={{ color: "var(--rojo)", fontSize: 13 }}>{msg}</p>}

      {vista === "control" && (
        <div style={{ overflow: "auto", maxHeight: "calc(100vh - 170px)", border: "1px solid var(--borde)", borderRadius: 8, background: "var(--blanco)" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead><tr>{ENC.map((h, i) => <th key={h} style={i < 2 ? thFija(i) : th}>{h}</th>)}</tr></thead>
            <tbody>
              {bloques.map((b) => {
                const t = sumar(b.filas.map((f) => f.x)); const res = b.reservas.reduce((s, r) => s + (Number(r.importe) || 0), 0);
                const pre = datos.presupuesto[b.cuenta] || 0; const dif = pre - (t.enlace + res);
                const tot = { background: "var(--verde-claro)", fontWeight: 700 };
                return (
                  <Fragment key={b.cuenta}>
                    <tr><td style={{ ...td, ...fija(0, "#e5efe9"), fontWeight: 800 }}>{b.cuenta}</td><td style={{ ...td, ...fija(1, "#e5efe9"), fontWeight: 800 }} title={b.nombre}>{b.nombre}</td><td colSpan={ENC.length - 2} style={{ ...td, background: "#e5efe9" }} /></tr>
                    {b.filas.map(filaContrato)}
                    {b.reservas.map((r) => (
                      <tr key={r.id} style={{ color: "var(--texto-suave)", fontStyle: "italic" }}>
                        <td style={{ ...td, ...fija(0) }} title={r.concepto}>{r.concepto}</td><td style={{ ...td, ...fija(1) }}>{r.estatus.toUpperCase()}</td>
                        <td colSpan={7} style={td}>Sin contrato: aparta presupuesto</td><td style={tdN}>{money(r.importe)}</td><td style={td} /><td style={tdN}>{money(r.importe)}</td><td colSpan={ENC.length - 12} style={td} />
                      </tr>
                    ))}
                    <tr style={tot}><td style={{ ...td, ...fija(0, "var(--verde-claro)") }} /><td style={{ ...td, ...fija(1, "var(--verde-claro)") }}>TOTAL</td><td colSpan={6} style={td} />
                      <td style={tdN}>{money(t.maxC)}</td><td style={tdN}>{money(t.maxU + res)}</td><td style={tdN}>{money(t.amp)}</td><td style={tdN}>{money(t.enlace + res)}</td><td style={tdN}>{money(t.pagos)}</td><td style={tdN}>{money(t.facturado)}</td>
                      <td style={tdN}>{money(t.devengo)}</td><td style={tdN}>{money(t.facDev)}</td><td style={tdN}>{money(t.saldo)}</td><td style={{ ...tdN, color: colorAvance(t.avance) }}>{pctTxt(t.avance)}</td>
                      <td style={tdN}>{money(t.proyeccion)}</td><td style={{ ...tdN, color: t.sobrante < -0.5 ? "var(--rojo)" : undefined }}>{money(t.sobrante)}</td><td style={tdN}>{money(t.pasivo)}</td>
                      {t.mensual.slice(1).map((v, i) => <td key={i} style={tdN}>{money0(v + t.devengoMes[i + 1])}</td>)}<td style={tdN}>{money(t.mensual.reduce((s, v) => s + v, 0) + t.devengo)}</td></tr>
                    <tr style={{ fontWeight: 600 }}><td style={{ ...td, ...fija(0) }} /><td style={{ ...td, ...fija(1) }}>PRESUPUESTO</td><td colSpan={7} style={td} /><td style={tdN}>{money(pre)}</td><td colSpan={2} style={td} />
                      <td style={{ ...td, fontSize: 11 }}>Pte pago</td><td style={tdN}>{money(t.facturado - t.pagos)}</td><td colSpan={ENC.length - 14} style={td} /></tr>
                    <tr style={{ fontWeight: 600 }}><td style={{ ...td, ...fija(0) }} /><td style={{ ...td, ...fija(1) }}>DIFERENCIA</td><td colSpan={7} style={td} /><td style={{ ...tdN, color: dif < -0.5 ? "var(--rojo)" : undefined }}>{money(dif)}</td><td colSpan={2} style={td} />
                      <td style={{ ...td, fontSize: 11 }}>Pte facturar</td><td style={tdN}>{money(t.devengo)}</td><td colSpan={ENC.length - 14} style={td} /></tr>
                  </Fragment>
                );
              })}
              {!bloques.length && <tr><td colSpan={ENC.length} style={td}>Sin contratos con ese filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {vista === "linea" && (
        <div style={{ overflow: "auto", maxHeight: "calc(100vh - 170px)", border: "1px solid var(--borde)", borderRadius: 8, background: "var(--blanco)" }}>
          <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: "8px 10px" }}>
            <strong>Devengo</strong> = servicio que ya se recibiÃ³ y todavÃ­a no se factura. CaptÃºralo en el renglÃ³n morado (Enter o clic fuera para guardar).
            En gris va la sugerencia: el promedio de los meses facturados. Cuando llegue la factura de ese mes, el devengo se descuenta solo.
          </p>
          <table style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead><tr><th style={thFija(0)}>Contrato</th><th style={thFija(1)}>RenglÃ³n</th>{MESES.slice(1).map((m) => <th key={m} style={th}>{m}</th>)}<th style={th}>TOTAL</th></tr></thead>
            <tbody>
              {bloques.flatMap((b) => b.filas).map(({ c, x }) => {
                const esc = x.prog["ESC 1"], amp = x.prog.AMP, hayAmp = amp.some((v) => v);
                const gasto = x.mensual;
                let acum = 0; const saldo = [0]; for (let m = 1; m <= 12; m++) { acum += esc[m] + amp[m] - gasto[m] - x.devengoMes[m]; saldo.push(acum); }
                const filaN = (t, arr, estilo = {}) => (
                  <tr style={estilo}><td style={{ ...td, ...fija(0, estilo.background) }} /><td style={{ ...td, ...fija(1, estilo.background) }}>{t}</td>
                    {arr.slice(1).map((v, i) => <td key={i} style={{ ...tdN, color: v < -0.5 ? "var(--rojo)" : undefined }}>{v ? money0(v) : ""}</td>)}
                    <td style={{ ...tdN, fontWeight: 700 }}>{t.startsWith("Saldo") ? money0(arr[12]) : money0(arr.slice(1).reduce((s, v) => s + v, 0))}</td></tr>
                );
                return (
                  <Fragment key={c.id}>
                    <tr><td style={{ ...td, ...fija(0, "#e5efe9"), fontWeight: 800 }} title={c.concepto}>{c.numero_interno}</td><td style={{ ...td, ...fija(1, "#e5efe9"), fontWeight: 700 }} title={c.proveedores?.razon_social}>{c.proveedores?.razon_social}</td>
                      <td colSpan={13} style={{ ...td, background: "#e5efe9", fontSize: 12 }}>MÃ¡x. unidad {money(x.maxU)}{x.amp ? ` + amp ${money(x.amp)}` : ""} = enlace {money(x.enlace)} Â· tope ampliaciÃ³n {money(x.tope)} Â· vigencia {fechaTxt(c.vigencia_inicio)} al {fechaTxt(c.vigencia_fin)}</td></tr>
                    {filaN("Programado (ESC 1)", esc)}
                    {hayAmp && filaN("AmpliaciÃ³n (AMP)", amp)}
                    {filaN("Gasto facturado", gasto)}
                    <tr style={{ background: "#f5f3ff" }}><td style={{ ...td, ...fija(0, "#f5f3ff") }} /><td style={{ ...td, ...fija(1, "#f5f3ff"), color: "#7c3aed", fontWeight: 600 }}>Devengo (captura)</td>
                      {MESES.slice(1).map((_, i) => {
                        const m = i + 1; const enVig = m >= x.vig.desde && m <= x.vig.hasta; const cap = x.devCapt[m];
                        return (
                          <td key={m} style={{ ...td, padding: 2 }}>
                            {enVig ? (
                              <input defaultValue={cap ? cap.toFixed(2) : ""} placeholder={!gasto[m] && m <= x.mesHoy && x.sugerido ? Math.round(x.sugerido).toString() : ""}
                                disabled={guardando === `${c.id}|${m}`}
                                onBlur={(e) => { if (Number(e.target.value || 0) !== Number(cap || 0)) guardarDevengo(c.id, m, e.target.value); }}
                                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                title={x.devengoMes[m] !== cap && cap ? `Capturado ${money(cap)}; ya facturado ${money(gasto[m])}; queda ${money(x.devengoMes[m])}` : "Servicio recibido sin factura en este mes"}
                                style={{ width: 92, textAlign: "right", fontSize: 12, border: "1px solid #ddd6fe", borderRadius: 4, padding: "2px 4px", background: "#fff" }} />
                            ) : null}
                          </td>
                        );
                      })}
                      <td style={{ ...tdN, color: "#7c3aed", fontWeight: 700 }}>{x.devengo ? money0(x.devengo) : ""}</td></tr>
                    {filaN("Saldo acumulado", saldo, { background: "#f8fafc", fontWeight: 600 })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>
        Enlace = mÃ¡ximo de la unidad + ampliaciones. Saldo = enlace âˆ’ (facturado + devengo). ProyecciÃ³n = promedio mensual de los meses transcurridos Ã— meses de vigencia en {ANIO} (+ pasivo).
        SemÃ¡foro: amarillo al 80% del contrato o a 30 dÃ­as de vencer; rojo si se rebasa o si la proyecciÃ³n no alcanza.
      </p>
    </div>
  );
}
