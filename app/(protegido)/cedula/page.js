"use client";

// Cédula de gasto dentro de SIGAF (Fase 1, 29/10/2026).
// Replica las hojas "resumen" y "pto" de la Cédula Gasto 2026: mismas columnas, mismos bloques,
// mismo orden y fila de TOTAL, para que se lea igual que el Excel. Diferencias a propósito:
//  · Presupuesto/Gasto/Comprometido/Precomprometido/Disponible salen de la dispo IMKK022 cargada (no tecleados).
//  · Pasivo y Devengado 2026 salen de las facturas registradas en SIGAF (+ ajustes de devengo).
//  · Las cuentas que el sistema trae y la cédula no listaba aparecen en "CUENTAS NO CLASIFICADAS".
//  · Clic en una cuenta: sus facturas y en qué etapa están.
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";
import { leerTodo } from "../../../lib/paginar";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const money2 = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const pct = (a, b) => (Number(b) ? Number(a) / Number(b) : 0);
const pctTxt = (x) => `${Math.round(x * 100)}%`;
const fechaTxt = (f) => (f ? new Date(f + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const CAMPOS = ["presupuesto", "gasto", "comprometido", "precomprometido", "disponible", "pasivo", "devengado", "cxp"];
// Criterio de PASIVO / DEVENGADO por cuenta, igual que las fórmulas de la cédula (migración 008):
//  facturas = facturas registradas en SIGAF + ajustes de devengo · sistema = pasivo 0 y devengado = gasto del sistema · vacio = sin control
const MODO_TXT = { facturas: "Facturas registradas en SIGAF + ajustes de devengo", sistema: "Como en la cédula: devengado = gasto del sistema (sin control por factura)", vacio: "Sin control de pasivo/devengado (como en la cédula)" };
function aplicarModo(f, modo) {
  const m = modo || "facturas";
  const pasivo = m === "facturas" ? f.pasivo : 0;
  const devengado = m === "facturas" ? f.devengado : m === "sistema" ? f.gasto : 0;
  const cxp = m === "vacio" ? 0 : pasivo + devengado - f.gasto;
  return { ...f, modo: m, pasivo, devengado, cxp };
}
const cero = () => Object.fromEntries(CAMPOS.map((c) => [c, 0]));
const suma = (filas) => {
  const t = cero(); for (const f of filas) for (const c of CAMPOS) t[c] += Number(f[c]) || 0;
  const modos = new Set(filas.map((f) => f.modo)); if (modos.size === 1) t.modo = [...modos][0]; // bloque todo "sistema"/"vacio" se ve igual que sus cuentas
  return t;
};

function etapaDe(f) {
  if (f.estatus_general === "gasto_reflejado") return "Pagada";
  if (f.estatus_general === "devuelta_proveedor") return "Devuelta";
  if (["enviada_ooad", "en_tramite_ooad"].includes(f.estatus_general)) return f.cr_contrarecibo ? "OOAD (con CR)" : "OOAD (sin CR)";
  if (["envio_firmas_admin_contrato", "autorizada_admin_contrato"].includes(f.estatus_firmas)) return "Adm. de contrato";
  if (["envio_firmas_servicio", "autorizada_servicio"].includes(f.estatus_firmas)) return "Servicio";
  return "Finanzas";
}

export default function CedulaPage() {
  const [tab, setTab] = useState("resumen");
  const [cortes, setCortes] = useState([]);
  const [fecha, setFecha] = useState("");
  const [mensual, setMensual] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [pptoIni, setPptoIni] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState("");
  const [abierta, setAbierta] = useState(null);

  // Catálogos y facturas (una vez)
  useEffect(() => {
    (async () => {
      const [rC, rB, rP, rPa, rF, rA] = await Promise.all([
        supabase.from("dispo_cortes").select("fecha, presupuesto, gasto, disponible").order("fecha", { ascending: false }),
        supabase.from("cedula_bloques").select("*").order("orden"),
        supabase.from("presupuesto_inicial").select("*").eq("anio", 2026),
        leerTodo((d, h) => supabase.from("partidas").select("id, cuenta_finat, cuenta_prei, nombre").order("id").range(d, h)),
        leerTodo((d, h) => supabase.from("facturas").select("id, folio_ingreso, folio_proveedor, importe_factura, es_pasivo, estatus_general, estatus_firmas, cr_contrarecibo, fecha_pago, proveedores ( razon_social ), partidas ( cuenta_finat )")
          .eq("anulada", false).neq("estatus_general", "devuelta_proveedor").order("id").range(d, h)),
        leerTodo((d, h) => supabase.from("ajustes_devengo").select("importe, contratos ( partidas ( cuenta_finat ) )").order("id").range(d, h)),
      ]);
      const err = [rC, rB, rP, rPa, rF, rA].find((r) => r.error);
      if (err) setMsg("No se pudo cargar: " + err.error.message + " (¿ya se corrió la migración 007?)");
      setCortes(rC.data || []); setBloques(rB.data || []); setPptoIni(rP.data || []); setPartidas(rPa.data || []);
      setFacturas(rF.data || []); setAjustes(rA.data || []);
      setFecha((rC.data || [])[0]?.fecha || "");
      if (!(rC.data || []).length) setCargando(false);
    })();
  }, []);

  // Dispo del corte elegido (por cuenta y mes)
  useEffect(() => {
    if (!fecha) return;
    setCargando(true);
    (async () => {
      const r = await leerTodo((d, h) => supabase.from("dispo_mensual").select("cuenta_finat, periodo, presupuesto, gasto, comprometido, precomprometido, disponible").eq("fecha", fecha).order("cuenta_finat").order("periodo").range(d, h));
      if (r.error) setMsg("No se pudo leer la dispo: " + r.error.message);
      setMensual(r.data || []); setCargando(false);
    })();
  }, [fecha]);

  const prei2finat = useMemo(() => { const m = {}; for (const p of partidas) if (p.cuenta_prei && p.cuenta_finat) m[p.cuenta_prei] = p.cuenta_finat; return m; }, [partidas]);
  const partidaDe = useMemo(() => { const m = {}; for (const p of partidas) if (p.cuenta_finat && !m[p.cuenta_finat]) m[p.cuenta_finat] = p; return m; }, [partidas]);

  // Por cuenta: dispo + pasivo/devengado de SIGAF
  const porCuenta = useMemo(() => {
    const m = {};
    const get = (c) => (m[c] ||= { ...cero(), facturas: [] });
    for (const r of mensual) { const o = get(r.cuenta_finat); for (const c of ["presupuesto", "gasto", "comprometido", "precomprometido", "disponible"]) o[c] += Number(r[c]) || 0; }
    for (const f of facturas) { const c = f.partidas?.cuenta_finat; if (!c) continue; const o = get(c); const imp = Number(f.importe_factura) || 0; if (f.es_pasivo) o.pasivo += imp; else o.devengado += imp; o.facturas.push(f); }
    for (const a of ajustes) { const c = a.contratos?.partidas?.cuenta_finat; if (!c) continue; get(c).devengado += Number(a.importe) || 0; }
    return m;
  }, [mensual, facturas, ajustes]);

  // Estructura de la cédula: bloques en orden + cuentas no clasificadas
  const estructura = useMemo(() => {
    const out = []; const vistos = new Set(); let actual = null;
    for (const b of bloques) {
      const finat = b.cuenta_finat || prei2finat[b.cuenta_prei] || "";
      if (!actual || actual.bloque !== b.bloque) { actual = { bloque: b.bloque, grupo: b.grupo, filas: [] }; out.push(actual); }
      if (finat) vistos.add(finat);
      actual.filas.push(aplicarModo({ finat, prei: b.cuenta_prei, nombre: b.nombre, ...(porCuenta[finat] || { ...cero(), facturas: [] }) }, b.modo));
    }
    const resto = Object.keys(porCuenta).filter((c) => !vistos.has(c) && CAMPOS.some((k) => Math.abs(porCuenta[c][k] || 0) >= 0.5)).sort();
    if (resto.length) out.push({ bloque: "CUENTAS NO CLASIFICADAS (el sistema las trae y la cédula no las listaba)", grupo: null, filas: resto.map((c) => aplicarModo({ finat: c, prei: partidaDe[c]?.cuenta_prei || "", nombre: partidaDe[c]?.nombre || "", ...porCuenta[c] }, porCuenta[c].facturas.length ? "facturas" : "vacio")) });
    return out;
  }, [bloques, porCuenta, prei2finat, partidaDe]);

  const corte = cortes.find((c) => c.fecha === fecha);
  const diaDelAnio = fecha ? Math.round((new Date(fecha + "T00:00:00") - new Date(fecha.slice(0, 4) + "-01-01T00:00:00")) / 86400000) + 1 : 0;

  // ---------- Exportar como cédula ----------
  const exportar = () => {
    const wb = XLSX.utils.book_new();
    if (tab === "resumen") {
      const enc = ["CUENTA CONTABLE (FINAT)", "CUENTA ANTERIOR (PREI)", "NOMBRE", "PRESUPUESTO", "GASTO", "COMPROMETIDO", "PRE-COMPROMETIDO", "DISPONIBLE", "AVANCE GASTO", "PASIVO", "DEVENGADO 2026", "TOTAL GASTO", "AVANCE GASTO DEVENGADO", "CUENTAS POR PAGAR"];
      const fila = (a, b, c, t) => { const v = t.modo === "vacio"; return [a, b, c, t.presupuesto, t.gasto, t.comprometido, t.precomprometido, t.disponible, pct(t.gasto, t.presupuesto), v ? "" : t.pasivo, v ? "" : t.devengado, v ? "" : t.pasivo + t.devengado, v ? "" : pct(t.pasivo + t.devengado, t.presupuesto), v ? "" : t.cxp]; };
      const aoa = [["", "AVANCE PRESUPUESTAL HGZ 2 (SIGAF)"], ["", `Disponibilidad al ${fechaTxt(fecha)}`], []];
      for (const g of estructura) { aoa.push(enc); for (const f of g.filas) aoa.push(fila(f.finat, f.prei, f.nombre, f)); aoa.push(fila("", "", g.bloque, suma(g.filas))); aoa.push([]); }
      aoa.push(fila("", "", "TOTAL GENERAL", suma(estructura.flatMap((g) => g.filas))));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "resumen");
    } else {
      const aoa = [["CUENTA FIAT", "CUENTA ANTERIOR", "NOMBRE", "PRESUPUESTO INICIAL", "PRESUPUESTO MODIFICADO", "DIF"]];
      for (const r of filasPto) aoa.push([r.finat, r.prei, r.nombre, r.inicial, r.modificado, r.modificado - r.inicial]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "pto");
    }
    XLSX.writeFile(wb, `CEDULA SIGAF ${tab.toUpperCase()} ${fecha}.xlsx`);
  };

  // ---------- Pestaña Presupuesto (hoja pto) ----------
  const filasPto = useMemo(() => {
    const ini = {}; for (const p of pptoIni) ini[p.cuenta_finat] = p;
    const vistos = new Set(); const out = [];
    for (const g of estructura) for (const f of g.filas) {
      if (!f.finat || vistos.has(f.finat)) continue; vistos.add(f.finat);
      out.push({ finat: f.finat, prei: f.prei, nombre: f.nombre, inicial: Number(ini[f.finat]?.importe) || 0, modificado: f.presupuesto });
    }
    for (const p of pptoIni) if (!vistos.has(p.cuenta_finat)) out.push({ finat: p.cuenta_finat, prei: p.cuenta_prei, nombre: p.nombre, inicial: Number(p.importe) || 0, modificado: porCuenta[p.cuenta_finat]?.presupuesto || 0 });
    return out.filter((r) => Math.abs(r.inicial) >= 0.5 || Math.abs(r.modificado) >= 0.5);
  }, [estructura, pptoIni, porCuenta]);

  // ---------- estilos (forma de la cédula) ----------
  const th = { background: "var(--verde)", color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "6px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,.25)", whiteSpace: "normal", lineHeight: 1.15 };
  const td = { padding: "4px 8px", borderBottom: "1px solid var(--borde)", borderRight: "1px solid var(--borde)", fontSize: 12.5, whiteSpace: "nowrap" };
  const tdN = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const totalRow = { background: "var(--verde-claro)", fontWeight: 700 };
  const barra = (x) => (
    <div style={{ position: "relative", height: 16, background: "#fde2e2", borderRadius: 2 }}>
      <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, Math.max(0, x * 100))}%`, background: x > 1 ? "#dc2626" : "#f87171", borderRadius: 2 }} />
      <span style={{ position: "relative", fontSize: 11, fontWeight: 700, paddingLeft: 4 }}>{pctTxt(x)}</span>
    </div>
  );
  const celdas = (t) => {
    const total = t.pasivo + t.devengado; const cxp = t.cxp;
    const vacio = t.modo === "vacio"; const tip = t.modo ? MODO_TXT[t.modo] : undefined;
    const sist = t.modo === "sistema" ? { color: "var(--texto-suave)", fontStyle: "italic" } : {};
    return (<>
      <td style={tdN}>{money(t.presupuesto)}</td><td style={tdN}>{money(t.gasto)}</td><td style={tdN}>{money(t.comprometido)}</td>
      <td style={tdN}>{money(t.precomprometido)}</td><td style={tdN}>{money(t.disponible)}</td>
      <td style={{ ...td, minWidth: 70 }}>{barra(pct(t.gasto, t.presupuesto))}</td>
      <td style={{ ...tdN, ...sist }} title={tip}>{vacio ? "" : money2(t.pasivo)}</td>
      <td style={{ ...tdN, ...sist }} title={tip}>{vacio ? "" : money2(t.devengado)}</td>
      <td style={{ ...tdN, background: "#e0f2fe", ...sist }} title={tip}>{vacio ? "" : money2(total)}</td>
      <td style={{ ...td, minWidth: 70 }}>{vacio ? "" : barra(pct(total, t.presupuesto))}</td>
      <td style={{ ...tdN, color: cxp < -0.5 ? "var(--rojo)" : undefined }} title={tip}>{vacio ? "" : cxp.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </>);
  };
  // Cuenta, cuenta anterior y nombre se quedan fijos a la izquierda; los encabezados, fijos arriba.
  const ANCHOS = [78, 78, 250], IZQ = [0, 78, 156];
  const fija = (i, bg) => ({ position: "sticky", left: IZQ[i], minWidth: ANCHOS[i], maxWidth: ANCHOS[i], zIndex: 1, background: bg || "var(--blanco)", boxShadow: i === 2 ? "2px 0 0 var(--borde)" : undefined });
  const encabezado = (
    <tr>{["CUENTA CONTABLE (FINAT)", "CUENTA ANTERIOR (PREI)", "NOMBRE", "PRESUPUESTO", "GASTO", "COMPROMETIDO", "PRE-COMPROMETIDO", "DISPONIBLE", "AVANCE GASTO", "PASIVO", "DEVENGADO 2026", "TOTAL GASTO", "AVANCE GASTO DEVENGADO", "CUENTAS POR PAGAR"].map((h, i) => (
      <th key={h} style={{ ...th, position: "sticky", top: 0, zIndex: i < 3 ? 3 : 2, ...(i < 3 ? { left: IZQ[i], minWidth: ANCHOS[i], maxWidth: ANCHOS[i] } : {}) }}>{h}</th>
    ))}</tr>
  );

  const detalleCuenta = (f) => {
    const porEtapa = {}; for (const x of f.facturas) { const e = etapaDe(x); (porEtapa[e] ||= { n: 0, imp: 0 }); porEtapa[e].n++; porEtapa[e].imp += Number(x.importe_factura) || 0; }
    const p = partidaDe[f.finat];
    return (
      <tr><td colSpan={14} style={{ padding: "10px 14px", background: "var(--fondo, #f7f8f7)", borderBottom: "2px solid var(--verde)" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
          <strong style={{ fontSize: 13 }}>{f.finat} · {f.nombre}</strong>
          {Object.entries(porEtapa).map(([e, v]) => <span key={e} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 99, background: "var(--verde-claro)" }}>{e}: {v.n} · {money2(v.imp)}</span>)}
          {p && <Link href={`/disponibilidad/${p.id}`} style={{ fontSize: 12, color: "var(--verde)" }}>Ver tablero de la cuenta →</Link>}
        </div>
        {f.facturas.length ? (
          <div style={{ maxHeight: 280, overflow: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr>{["¿Dónde está?", "Folio ingreso", "Factura", "Proveedor", "Importe", "Pasivo", "CR", "Fecha de pago"].map((h) => <th key={h} style={{ ...th, background: "#4b5563" }}>{h}</th>)}</tr></thead>
              <tbody>{f.facturas.slice(0, 400).map((x) => (
                <tr key={x.id}>
                  <td style={td}>{etapaDe(x)}</td>
                  <td style={td}><Link href={`/facturas/${x.id}`} style={{ color: "var(--verde)" }}>{x.folio_ingreso}</Link></td>
                  <td style={td}>{x.folio_proveedor}</td><td style={td}>{x.proveedores?.razon_social || "—"}</td>
                  <td style={tdN}>{money2(x.importe_factura)}</td><td style={td}>{x.es_pasivo ? "Sí" : ""}</td>
                  <td style={td}>{x.cr_contrarecibo || ""}</td><td style={td}>{x.fecha_pago ? fechaTxt(x.fecha_pago) : ""}</td>
                </tr>))}</tbody>
            </table>
          </div>
        ) : <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: 0 }}>Sin facturas registradas en SIGAF para esta cuenta.</p>}
      </td></tr>
    );
  };

  const btnTab = (k, t) => <button key={k} onClick={() => setTab(k)} className={tab === k ? "boton" : "boton secundario"} style={{ fontSize: 13, padding: "6px 14px" }}>{t}</button>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Cédula de gasto 2026</h1>
          <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>AVANCE PRESUPUESTAL HGZ 2 · disponibilidad (IMKK022) al {fechaTxt(fecha)}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {btnTab("resumen", "Resumen")}{btnTab("pto", "Presupuesto")}
          <select value={fecha} onChange={(e) => { setFecha(e.target.value); setAbierta(null); }} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 13 }}>
            {cortes.map((c) => <option key={c.fecha} value={c.fecha}>Dispo del {fechaTxt(c.fecha)}</option>)}
          </select>
          <button className="boton secundario" onClick={exportar} disabled={!fecha} style={{ fontSize: 13 }}>⬇ Descargar como cédula</button>
          <Link href="/disponibilidad/cargar" className="boton secundario" style={{ fontSize: 13, textDecoration: "none" }}>Cargar dispo</Link>
        </div>
      </div>
      {msg && <p style={{ color: "var(--rojo)", fontSize: 13 }}>{msg}</p>}
      {!cortes.length && !msg && <p style={{ fontSize: 14 }}>Todavía no hay disponibilidad cargada. <Link href="/disponibilidad/cargar" style={{ color: "var(--verde)" }}>Cárgala aquí</Link> (puedes subir varias fechas a la vez).</p>}
      {cargando && cortes.length > 0 && <p style={{ fontSize: 13 }}>Cargando…</p>}

      {!cargando && fecha && tab === "resumen" && (
        <div style={{ overflow: "auto", maxHeight: "calc(100vh - 160px)", marginTop: 12, border: "1px solid var(--borde)", borderRadius: 8, background: "var(--blanco)" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
            <tbody>
              {(() => {
                const filas = []; let grupoAct = null; let acumGrupo = [];
                const cerrarGrupo = () => { if (grupoAct && acumGrupo.length) filas.push(<tr key={"g-" + grupoAct} style={{ ...totalRow, background: "#b7e1cd" }}><td style={{ ...td, ...fija(0, "#b7e1cd") }} /><td style={{ ...td, ...fija(1, "#b7e1cd"), fontWeight: 800, overflow: "visible" }}>{grupoAct}</td><td style={{ ...td, ...fija(2, "#b7e1cd") }} />{celdas(suma(acumGrupo))}</tr>); acumGrupo = []; };
                for (const g of estructura) {
                  if (g.grupo !== grupoAct) { cerrarGrupo(); grupoAct = g.grupo; }
                  filas.push(<Fragment key={"h-" + g.bloque}>{encabezado}</Fragment>);
                  for (const f of g.filas) {
                    const k = g.bloque + "|" + (f.finat || f.prei);
                    filas.push(
                      <Fragment key={k}>
                        <tr onClick={() => setAbierta(abierta === k ? null : k)} style={{ cursor: "pointer", background: abierta === k ? "#fff7d6" : undefined }} title="Clic para ver sus facturas">
                          <td style={{ ...td, ...fija(0, abierta === k ? "#fff7d6" : null) }}>{f.finat || "—"}</td><td style={{ ...td, ...fija(1, abierta === k ? "#fff7d6" : null) }}>{f.prei}</td><td style={{ ...td, ...fija(2, abierta === k ? "#fff7d6" : null), overflow: "hidden", textOverflow: "ellipsis" }} title={f.nombre}>{f.nombre}</td>
                          {celdas(f)}
                        </tr>
                        {abierta === k && detalleCuenta(f)}
                      </Fragment>);
                  }
                  filas.push(<tr key={"t-" + g.bloque} style={totalRow}><td style={{ ...td, ...fija(0, "var(--verde-claro)") }} /><td style={{ ...td, ...fija(1, "var(--verde-claro)") }} /><td style={{ ...td, ...fija(2, "var(--verde-claro)"), whiteSpace: "normal" }}>{g.bloque}</td>{celdas(suma(g.filas))}</tr>);
                  if (g.grupo) acumGrupo.push(...g.filas);
                }
                cerrarGrupo();
                const tg = suma(estructura.flatMap((g) => g.filas));
                filas.push(<tr key="tg" style={{ ...totalRow, background: "var(--verde)", color: "#fff" }}><td style={{ ...td, ...fija(0, "var(--verde)") }} /><td style={{ ...td, ...fija(1, "var(--verde)") }} /><td style={{ ...td, ...fija(2, "var(--verde)") }}>TOTAL GENERAL</td>{celdas(tg)}</tr>);
                filas.push(<tr key="dias"><td colSpan={7} style={{ ...td, textAlign: "right" }}>días del año</td><td style={tdN}>{diaDelAnio}</td><td style={tdN}>{pctTxt(diaDelAnio / 365)}</td><td colSpan={5} style={{ ...td, fontSize: 11, color: "var(--texto-suave)" }}>% de avance real del año al {fechaTxt(fecha)}</td></tr>);
                return filas;
              })()}
            </tbody>
          </table>
        </div>
      )}
      {!cargando && fecha && tab === "resumen" && corte && (
        <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>
          Cuadre con el sistema: total del corte {money2(corte.presupuesto)} de presupuesto y {money2(corte.disponible)} de disponible (unidad 10102).
          Pasivo y Devengado 2026 = facturas registradas en SIGAF (sin anuladas ni devueltas) + ajustes de devengo. Cuentas por pagar = Total gasto − Gasto del sistema.
        </p>
      )}

      {!cargando && fecha && tab === "pto" && (
        <div style={{ marginTop: 12 }}>
          {(() => { const ti = filasPto.reduce((a, r) => a + r.inicial, 0), tm = filasPto.reduce((a, r) => a + r.modificado, 0); return (
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10, fontSize: 14 }}>
              <span>Presupuesto inicial: <strong>{money(ti)}</strong></span><span>Modificado al {fechaTxt(fecha)}: <strong>{money(tm)}</strong></span>
              <span>Aumento / Disminución: <strong style={{ color: tm - ti < 0 ? "var(--rojo)" : "var(--verde)" }}>{money(tm - ti)}</strong></span>
            </div>); })()}
          <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 8, background: "var(--blanco)" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr>{["CUENTA FIAT", "CUENTA ANTERIOR", "NOMBRE", "PRESUPUESTO INICIAL", "PRESUPUESTO MODIFICADO", "DIF"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{filasPto.map((r) => { const dif = r.modificado - r.inicial; return (
                <tr key={r.finat}><td style={td}>{r.finat}</td><td style={td}>{r.prei}</td><td style={td}>{r.nombre}</td>
                  <td style={tdN}>{money(r.inicial)}</td><td style={tdN}>{money(r.modificado)}</td><td style={{ ...tdN, color: dif < -0.5 ? "var(--rojo)" : undefined }}>{money(dif)}</td></tr>); })}</tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>Presupuesto inicial: {pptoIni[0]?.fuente || "—"}. Modificado: presupuesto de la dispo del {fechaTxt(fecha)}.</p>
        </div>
      )}
    </div>
  );
}
