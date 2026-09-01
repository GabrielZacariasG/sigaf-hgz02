"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import {
  FLUJO_GENERAL, LABEL_GENERAL,
  FLUJO_FIRMAS, LABEL_FIRMAS,
  FLUJO_PEDIDO, LABEL_PEDIDO,
} from "../../../lib/estatus";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const moneyK = (n) => { const v = Number(n) || 0; return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}k` : money(v); };
const diasEntre = (desde) => Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 86400000));

function ejeInfo(hist, circuito, flujo, valor, alertasMap) {
  const propias = hist.filter((h) => h.circuito === circuito && h.estatus === valor);
  const entrada = propias.length ? propias.reduce((m, h) => (h.fecha > m ? h.fecha : m), propias[0].fecha) : null;
  const dias = entrada != null ? diasEntre(entrada) : null;
  const lim = alertasMap[`${circuito}:${valor}`];
  const estancada = lim != null && dias != null && dias > lim;
  return { dias, lim, estancada, idx: flujo.indexOf(valor), total: flujo.length - 1 };
}

const ESTATUS_COLOR = {
  capturada: "#6b7280", en_revision: "#b45309", enviada_ooad: "#7c3aed",
  en_tramite_ooad: "#2563eb", gasto_reflejado: "#15803d",
};

export default function FacturasListaPage() {
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [fProv, setFProv] = useState("");
  const [fContrato, setFContrato] = useState("");
  const [fEstatus, setFEstatus] = useState(null);
  const [fCapitulo, setFCapitulo] = useState(null);
  const [soloCR, setSoloCR] = useState(false);
  const [soloEstancadas, setSoloEstancadas] = useState(false);
  const [soloDiscrep, setSoloDiscrep] = useState(false);
  const [ocultarCompl, setOcultarCompl] = useState(false);
  const [agrupar, setAgrupar] = useState("none");
  const [abiertos, setAbiertos] = useState({});

  useEffect(() => {
    let activo = true;
    async function cargar() {
      let todas = [], desde = 0, rAlertas, rHist;
      for (;;) {
        const [rFac, a, h] = await Promise.all([
          supabase.from("facturas").select(
            "id, folio_ingreso, folio_proveedor, importe_factura, validacion_ok, cr_contrarecibo, estatus_general, estatus_firmas, estatus_pedido_recepcion, contratos ( numero_interno ), proveedores ( razon_social ), capitulos ( nombre )"
          ).range(desde, desde + 999),
          desde === 0 ? supabase.from("alertas_config").select("circuito, estatus, dias_umbral") : Promise.resolve({ data: rAlertas }),
          desde === 0 ? supabase.from("factura_estatus_historial").select("factura_id, circuito, estatus, fecha") : Promise.resolve({ data: rHist }),
        ]);
        if (!activo) return;
        if (rFac.error) { setMensaje("No se pudieron cargar las facturas: " + rFac.error.message); setCargando(false); return; }
        if (desde === 0) { rAlertas = a.data; rHist = h.data; }
        todas = todas.concat(rFac.data || []);
        if (!rFac.data || rFac.data.length < 1000) break;
        desde += 1000;
      }
      const alertasMap = {};
      (rAlertas || []).forEach((a) => (alertasMap[`${a.circuito}:${a.estatus}`] = a.dias_umbral));
      const histPorFactura = {};
      (rHist || []).forEach((h) => (histPorFactura[h.factura_id] ||= []).push(h));
      const filas = todas.map((f) => {
        const hist = histPorFactura[f.id] || [];
        const gen = ejeInfo(hist, "general", FLUJO_GENERAL, f.estatus_general, alertasMap);
        const fir = ejeInfo(hist, "firmas", FLUJO_FIRMAS, f.estatus_firmas, alertasMap);
        const generaPR = ["Integrales", "Servicios Integrales"].includes(f.capitulos?.nombre);
        const ped = ejeInfo(hist, "pedido_recepcion", FLUJO_PEDIDO, f.estatus_pedido_recepcion, alertasMap);
        const estancada = gen.estancada || fir.estancada || (generaPR && ped.estancada);
        return {
          ...f, capNom: f.capitulos?.nombre || "—", prov: f.proveedores?.razon_social || "—",
          contrato: f.contratos?.numero_interno || "—", tieneCR: !!String(f.cr_contrarecibo ?? "").trim(),
          gen, fir, ped, generaPR, estancada,
        };
      });
      setFacturas(filas);
      setCargando(false);
    }
    cargar();
    return () => { activo = false; };
  }, []);

  const resumen = useMemo(() => {
    const porEstatus = {}, porCapitulo = {};
    let estancadas = 0, montoTotal = 0, conCR = 0;
    for (const f of facturas) {
      const e = (porEstatus[f.estatus_general] ||= { n: 0, monto: 0 });
      e.n++; e.monto += Number(f.importe_factura) || 0;
      const c = (porCapitulo[f.capNom] ||= { n: 0, monto: 0, refl: 0 });
      c.n++; c.monto += Number(f.importe_factura) || 0;
      if (f.estatus_general === "gasto_reflejado") c.refl++;
      if (f.estancada) estancadas++;
      if (f.tieneCR) conCR++;
      montoTotal += Number(f.importe_factura) || 0;
    }
    return { porEstatus, porCapitulo, estancadas, montoTotal, conCR };
  }, [facturas]);

  const capitulos = useMemo(() => Object.keys(resumen.porCapitulo).sort(), [resumen]);
  const proveedores = useMemo(() => [...new Set(facturas.map((f) => f.prov))].sort(), [facturas]);
  const contratos = useMemo(() => [...new Set(facturas.map((f) => f.contrato))].sort(), [facturas]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const pv = fProv.trim().toLowerCase();
    const ct = fContrato.trim().toLowerCase();
    return facturas.filter((f) => {
      if (fEstatus && f.estatus_general !== fEstatus) return false;
      if (fCapitulo && f.capNom !== fCapitulo) return false;
      if (soloCR && !f.tieneCR) return false;
      if (soloEstancadas && !f.estancada) return false;
      if (soloDiscrep && f.validacion_ok !== false) return false;
      if (ocultarCompl && f.estatus_general === "gasto_reflejado") return false;
      if (pv && !f.prov.toLowerCase().includes(pv)) return false;
      if (ct && !f.contrato.toLowerCase().includes(ct)) return false;
      if (q) {
        const blob = `${f.folio_ingreso} ${f.folio_proveedor} ${f.prov} ${f.contrato} ${f.cr_contrarecibo ?? ""} ${f.importe_factura}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (a.estancada !== b.estancada ? (a.estancada ? -1 : 1)
      : (a.estatus_general === "gasto_reflejado") !== (b.estatus_general === "gasto_reflejado") ? (a.estatus_general === "gasto_reflejado" ? 1 : -1)
      : (b.gen.dias ?? -1) - (a.gen.dias ?? -1)));
  }, [facturas, busqueda, fProv, fContrato, fEstatus, fCapitulo, soloCR, soloEstancadas, soloDiscrep, ocultarCompl]);

  // Agrupación
  const grupos = useMemo(() => {
    if (agrupar === "none") return null;
    const key = agrupar === "prov" ? "prov" : agrupar === "contrato" ? "contrato" : "capNom";
    const g = {};
    for (const f of filtradas) { (g[f[key]] ||= { filas: [], monto: 0 }); g[f[key]].filas.push(f); g[f[key]].monto += Number(f.importe_factura) || 0; }
    return Object.entries(g).sort((a, b) => b[1].filas.length - a[1].filas.length);
  }, [filtradas, agrupar]);

  const hayFiltro = fEstatus || fCapitulo || busqueda || fProv || fContrato || soloCR || soloEstancadas || soloDiscrep || ocultarCompl;
  const montoFiltrado = useMemo(() => filtradas.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0), [filtradas]);

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "9px 12px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "9px 12px", borderBottom: "1px solid var(--borde)", fontSize: 14, verticalAlign: "top" };
  const inp = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14 };
  const celdaCircuito = (eje, label) => (
    <div><div>{label}</div><div style={{ fontSize: 11, color: eje.estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: eje.estancada ? 700 : 400 }}>{eje.idx}/{eje.total}{eje.estancada && ` · ${eje.dias}d ⚠️`}</div></div>
  );
  const chipBtn = (activo, color) => ({
    cursor: "pointer", border: `1px solid ${activo ? (color || "var(--verde)") : "var(--borde)"}`,
    background: activo ? (color ? `color-mix(in srgb, ${color} 14%, transparent)` : "var(--verde-claro)") : "var(--blanco)",
    borderRadius: 10, padding: "8px 12px", minWidth: 118, textAlign: "left",
  });
  const filtroChip = (activo) => ({
    cursor: "pointer", fontSize: 12, padding: "6px 11px", borderRadius: 999,
    border: `1px solid ${activo ? "var(--verde)" : "var(--borde)"}`,
    background: activo ? "var(--verde-claro)" : "var(--blanco)", color: activo ? "var(--verde-oscuro)" : "var(--texto)",
  });

  const Tabla = ({ filas }) => (
    <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden", marginTop: 8 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Folio / CR</th><th style={th}>Proveedor</th><th style={th}>Contrato</th>
            <th style={th}>General</th><th style={th}>Firmas</th><th style={th}>Pedido-recep.</th>
            <th style={{ ...th, textAlign: "right" }}>Importe</th><th style={th}>Valid.</th>
          </tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} style={f.estancada ? { background: "var(--rojo-claro)" } : f.estatus_general === "gasto_reflejado" ? { opacity: 0.72 } : {}}>
                <td style={td}>
                  <Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>{f.folio_ingreso}</Link>
                  <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}{f.tieneCR ? <span style={{ color: "var(--verde-oscuro)" }}> · CR {f.cr_contrarecibo}</span> : ""}</div>
                </td>
                <td style={{ ...td, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.prov}</td>
                <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.contrato}<div>{f.capNom}</div></td>
                <td style={td}>
                  <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "color-mix(in srgb, " + (ESTATUS_COLOR[f.estatus_general] || "#888") + " 16%, transparent)", color: ESTATUS_COLOR[f.estatus_general] || "#555", whiteSpace: "nowrap" }}>{LABEL_GENERAL[f.estatus_general] || f.estatus_general}</span>
                  <div style={{ fontSize: 11, color: f.gen.estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: f.gen.estancada ? 700 : 400, marginTop: 3 }}>{f.gen.dias == null ? "—" : `${f.gen.dias}d`}{f.gen.lim != null ? ` / ${f.gen.lim}` : ""}{f.gen.estancada && " ⚠️"}</div>
                </td>
                <td style={td}>{celdaCircuito(f.fir, LABEL_FIRMAS[f.estatus_firmas])}</td>
                <td style={td}>{f.generaPR ? celdaCircuito(f.ped, LABEL_PEDIDO[f.estatus_pedido_recepcion]) : <span style={{ color: "var(--texto-suave)", fontSize: 12 }}>no aplica</span>}</td>
                <td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td>
                <td style={td}>{f.validacion_ok === true ? <span style={{ color: "var(--verde-oscuro)" }}>✓</span> : f.validacion_ok === false ? <span style={{ color: "var(--rojo)" }}>✗</span> : <span style={{ color: "var(--texto-suave)" }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Seguimiento de facturas</h1>
        <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
          {facturas.length} facturas · {money(resumen.montoTotal)} · {resumen.conCR} con CR
          {resumen.estancadas > 0 && <span style={{ color: "var(--rojo)", fontWeight: 600 }}>{" · "}{resumen.estancadas} estancada(s)</span>}
        </div>
      </div>
      {mensaje && <p style={{ color: "var(--rojo)", fontSize: 13 }}>{mensaje}</p>}

      {/* Resumen por estatus */}
      <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 14, marginBottom: 4 }}>Por estatus (clic para filtrar)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FLUJO_GENERAL.map((e) => {
          const r = resumen.porEstatus[e] || { n: 0, monto: 0 };
          return (
            <button key={e} style={chipBtn(fEstatus === e, ESTATUS_COLOR[e])} onClick={() => setFEstatus(fEstatus === e ? null : e)}>
              <div style={{ fontSize: 12, color: ESTATUS_COLOR[e], fontWeight: 600 }}>{LABEL_GENERAL[e] || e}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{r.n}</div>
              <div style={{ fontSize: 11, color: "var(--texto-suave)" }}>{moneyK(r.monto)}</div>
            </button>
          );
        })}
      </div>

      {/* Resumen por capítulo */}
      <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 14, marginBottom: 4 }}>Por capítulo (clic para filtrar)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {capitulos.map((c) => {
          const r = resumen.porCapitulo[c];
          const pct = r.n ? Math.round((100 * r.refl) / r.n) : 0;
          return (
            <button key={c} style={chipBtn(fCapitulo === c)} onClick={() => setFCapitulo(fCapitulo === c ? null : c)}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{c}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{r.n} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--texto-suave)" }}>{moneyK(r.monto)}</span></div>
              <div style={{ height: 5, background: "var(--borde)", borderRadius: 3, marginTop: 4, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "var(--verde)" }} /></div>
              <div style={{ fontSize: 10, color: "var(--texto-suave)", marginTop: 2 }}>{pct}% reflejadas</div>
            </button>
          );
        })}
      </div>

      {/* Buscador + facetas */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar folio, CR, importe…" style={{ ...inp, flex: 2, minWidth: 200 }} />
        <input value={fProv} onChange={(e) => setFProv(e.target.value)} placeholder="Proveedor…" list="lst-prov" style={{ ...inp, flex: 1, minWidth: 160 }} />
        <datalist id="lst-prov">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
        <input value={fContrato} onChange={(e) => setFContrato(e.target.value)} placeholder="Contrato…" list="lst-cont" style={{ ...inp, flex: 1, minWidth: 150 }} />
        <datalist id="lst-cont">{contratos.map((c) => <option key={c} value={c} />)}</datalist>
      </div>

      {/* Chips de filtro rápido + agrupar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
        <button style={filtroChip(soloCR)} onClick={() => setSoloCR((v) => !v)}>Con contrarecibo ({resumen.conCR})</button>
        <button style={filtroChip(soloEstancadas)} onClick={() => setSoloEstancadas((v) => !v)}>Estancadas ({resumen.estancadas})</button>
        <button style={filtroChip(soloDiscrep)} onClick={() => setSoloDiscrep((v) => !v)}>Con discrepancia ✗</button>
        <button style={filtroChip(ocultarCompl)} onClick={() => setOcultarCompl((v) => !v)}>Ocultar completadas</button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--texto-suave)" }}>Agrupar por:</span>
        <select value={agrupar} onChange={(e) => { setAgrupar(e.target.value); setAbiertos({}); }} style={{ ...inp, padding: "7px 10px" }}>
          <option value="none">Ninguno</option>
          <option value="prov">Proveedor</option>
          <option value="contrato">Contrato</option>
          <option value="capNom">Capítulo</option>
        </select>
        {hayFiltro && <button className="boton secundario" onClick={() => { setFEstatus(null); setFCapitulo(null); setBusqueda(""); setFProv(""); setFContrato(""); setSoloCR(false); setSoloEstancadas(false); setSoloDiscrep(false); setOcultarCompl(false); }}>Limpiar</button>}
      </div>

      <div style={{ marginTop: 14, fontSize: 14, fontWeight: 700 }}>{filtradas.length} factura(s) · {money(montoFiltrado)}</div>

      {filtradas.length === 0 ? (
        <p style={{ color: "var(--texto-suave)", fontSize: 13, marginTop: 8 }}>Ninguna factura con estos filtros. <Link href="/facturas/nueva">Capturar una</Link>.</p>
      ) : grupos ? (
        <div style={{ marginTop: 8 }}>
          {grupos.map(([nombre, g]) => {
            const open = abiertos[nombre];
            return (
              <div key={nombre} style={{ marginTop: 8 }}>
                <button onClick={() => setAbiertos((p) => ({ ...p, [nombre]: !p[nombre] }))}
                  style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{open ? "▾" : "▸"} {nombre}</span>
                  <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>{g.filas.length} · {money(g.monto)}</span>
                </button>
                {open && <Tabla filas={g.filas} />}
              </div>
            );
          })}
        </div>
      ) : (
        <Tabla filas={filtradas} />
      )}

      <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 14 }}>
        Nada se borra: las completadas se atenúan pero siguen aquí (y buscables por CR). Renglones en rojo = algún eje supera su umbral.
      </p>
    </div>
  );
}
