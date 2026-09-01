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
  const [fEstatus, setFEstatus] = useState(null);
  const [fCapitulo, setFCapitulo] = useState(null);
  const [verCompletadas, setVerCompletadas] = useState(false);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      // paginar por si hay >1000
      let todas = [], desde = 0;
      let rAlertas, rHist;
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
        return { ...f, capNom: f.capitulos?.nombre || "—", gen, fir, ped, generaPR, estancada };
      });
      setFacturas(filas);
      setCargando(false);
    }
    cargar();
    return () => { activo = false; };
  }, []);

  // Resúmenes globales
  const resumen = useMemo(() => {
    const porEstatus = {}, porCapitulo = {};
    let estancadas = 0, montoTotal = 0;
    for (const f of facturas) {
      const e = (porEstatus[f.estatus_general] ||= { n: 0, monto: 0 });
      e.n++; e.monto += Number(f.importe_factura) || 0;
      const c = (porCapitulo[f.capNom] ||= { n: 0, monto: 0, refl: 0 });
      c.n++; c.monto += Number(f.importe_factura) || 0;
      if (f.estatus_general === "gasto_reflejado") c.refl++;
      if (f.estancada) estancadas++;
      montoTotal += Number(f.importe_factura) || 0;
    }
    return { porEstatus, porCapitulo, estancadas, montoTotal };
  }, [facturas]);

  const capitulos = useMemo(() => Object.keys(resumen.porCapitulo).sort(), [resumen]);

  // Filtro + búsqueda
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return facturas.filter((f) => {
      if (fEstatus && f.estatus_general !== fEstatus) return false;
      if (fCapitulo && f.capNom !== fCapitulo) return false;
      if (q) {
        const blob = `${f.folio_ingreso} ${f.folio_proveedor} ${f.proveedores?.razon_social ?? ""} ${f.contratos?.numero_interno ?? ""} ${f.importe_factura}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [facturas, busqueda, fEstatus, fCapitulo]);

  const activas = useMemo(() => filtradas.filter((f) => f.estatus_general !== "gasto_reflejado")
    .sort((a, b) => (a.estancada !== b.estancada ? (a.estancada ? -1 : 1) : (b.gen.dias ?? -1) - (a.gen.dias ?? -1))), [filtradas]);
  const completadas = useMemo(() => filtradas.filter((f) => f.estatus_general === "gasto_reflejado"), [filtradas]);

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "9px 12px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "9px 12px", borderBottom: "1px solid var(--borde)", fontSize: 14, verticalAlign: "top" };
  const celdaCircuito = (eje, label) => (
    <div><div>{label}</div><div style={{ fontSize: 11, color: eje.estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: eje.estancada ? 700 : 400 }}>{eje.idx}/{eje.total}{eje.estancada && ` · ${eje.dias}d ⚠️`}</div></div>
  );
  const chip = (activo, color) => ({
    cursor: "pointer", border: `1px solid ${activo ? (color || "var(--verde)") : "var(--borde)"}`,
    background: activo ? (color ? `color-mix(in srgb, ${color} 14%, transparent)` : "var(--verde-claro)") : "var(--blanco)",
    borderRadius: 10, padding: "8px 12px", minWidth: 120, textAlign: "left",
  });

  const Tabla = ({ filas }) => (
    <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden", marginTop: 10 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Folio de ingreso</th><th style={th}>Proveedor</th><th style={th}>Capítulo</th>
            <th style={th}>General</th><th style={th}>Firmas</th><th style={th}>Pedido-recep.</th>
            <th style={{ ...th, textAlign: "right" }}>Importe</th><th style={th}>Valid.</th>
          </tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} style={f.estancada ? { background: "var(--rojo-claro)" } : {}}>
                <td style={td}>
                  <Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>{f.folio_ingreso}</Link>
                  <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}{f.cr_contrarecibo ? ` · CR ${f.cr_contrarecibo}` : ""}</div>
                </td>
                <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.proveedores?.razon_social ?? "—"}</td>
                <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>{f.capNom}</td>
                <td style={td}>
                  <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "color-mix(in srgb, " + (ESTATUS_COLOR[f.estatus_general] || "#888") + " 16%, transparent)", color: ESTATUS_COLOR[f.estatus_general] || "#555", whiteSpace: "nowrap" }}>
                    {LABEL_GENERAL[f.estatus_general] || f.estatus_general}
                  </span>
                  <div style={{ fontSize: 11, color: f.gen.estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: f.gen.estancada ? 700 : 400, marginTop: 3 }}>
                    {f.gen.dias == null ? "—" : `${f.gen.dias}d`}{f.gen.lim != null ? ` / ${f.gen.lim}` : ""}{f.gen.estancada && " ⚠️"}
                  </div>
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
          {facturas.length} facturas · {money(resumen.montoTotal)}
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
            <button key={e} style={chip(fEstatus === e, ESTATUS_COLOR[e])} onClick={() => setFEstatus(fEstatus === e ? null : e)}>
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
            <button key={c} style={chip(fCapitulo === c)} onClick={() => setFCapitulo(fCapitulo === c ? null : c)}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{c}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{r.n} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--texto-suave)" }}>{moneyK(r.monto)}</span></div>
              <div style={{ height: 5, background: "var(--borde)", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--verde)" }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--texto-suave)", marginTop: 2 }}>{pct}% reflejadas</div>
            </button>
          );
        })}
      </div>

      {/* Buscador + filtros activos */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar folio, proveedor, contrato o importe…"
          style={{ flex: 1, minWidth: 260, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14 }} />
        {(fEstatus || fCapitulo || busqueda) && (
          <button className="boton secundario" onClick={() => { setFEstatus(null); setFCapitulo(null); setBusqueda(""); }}>Limpiar filtros</button>
        )}
      </div>
      {(fEstatus || fCapitulo) && (
        <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 6 }}>
          Filtrando: {fEstatus && <strong>{LABEL_GENERAL[fEstatus]}</strong>}{fEstatus && fCapitulo && " · "}{fCapitulo && <strong>{fCapitulo}</strong>}
        </div>
      )}

      {/* Activas */}
      <div style={{ marginTop: 14, fontSize: 14, fontWeight: 700 }}>En proceso ({activas.length})</div>
      {activas.length === 0
        ? <p style={{ color: "var(--texto-suave)", fontSize: 13, marginTop: 8 }}>Nada en proceso con estos filtros.</p>
        : <Tabla filas={activas} />}

      {/* Completadas (plegadas, nunca se borran) */}
      <div style={{ marginTop: 20 }}>
        <button className="boton secundario" onClick={() => setVerCompletadas((v) => !v)}>
          {verCompletadas ? "▾" : "▸"} Completadas / gasto reflejado ({completadas.length})
        </button>
        {verCompletadas && (completadas.length === 0
          ? <p style={{ color: "var(--texto-suave)", fontSize: 13, marginTop: 8 }}>Ninguna completada con estos filtros.</p>
          : <Tabla filas={completadas} />)}
      </div>

      <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 14 }}>
        Las facturas nunca se borran: al reflejarse el gasto pasan a &ldquo;Completadas&rdquo; (siempre consultables). Renglones en rojo = algún eje supera su umbral.
      </p>
    </div>
  );
}
