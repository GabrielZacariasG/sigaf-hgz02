"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import {
  FLUJO_GENERAL, LABEL_GENERAL,
  FLUJO_FIRMAS, LABEL_FIRMAS,
  FLUJO_PEDIDO, LABEL_PEDIDO,
} from "../../../lib/estatus";

const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const diasEntre = (desde) =>
  Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 86400000));

// Info de un eje: días en etapa actual, umbral, estancamiento, progreso.
function ejeInfo(hist, circuito, flujo, valor, alertasMap) {
  const propias = hist.filter((h) => h.circuito === circuito && h.estatus === valor);
  const entrada = propias.length
    ? propias.reduce((m, h) => (h.fecha > m ? h.fecha : m), propias[0].fecha)
    : null;
  const dias = entrada != null ? diasEntre(entrada) : null;
  const lim = alertasMap[`${circuito}:${valor}`];
  const estancada = lim != null && dias != null && dias > lim;
  return { dias, lim, estancada, idx: flujo.indexOf(valor), total: flujo.length - 1 };
}

export default function FacturasListaPage() {
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let activo = true;
    async function cargar() {
      const [rFac, rAlertas, rHist] = await Promise.all([
        supabase
          .from("facturas")
          .select(
            "id, folio_ingreso, folio_proveedor, importe_factura, validacion_ok, estatus_general, estatus_firmas, estatus_pedido_recepcion, contratos ( numero_interno ), proveedores ( razon_social )"
          ),
        supabase.from("alertas_config").select("circuito, estatus, dias_umbral"),
        supabase.from("factura_estatus_historial").select("factura_id, circuito, estatus, fecha"),
      ]);

      if (!activo) return;
      const err = rFac.error || rAlertas.error || rHist.error;
      if (err) {
        setMensaje("No se pudieron cargar las facturas: " + err.message);
        setCargando(false);
        return;
      }

      const alertasMap = {};
      (rAlertas.data || []).forEach((a) => (alertasMap[`${a.circuito}:${a.estatus}`] = a.dias_umbral));

      const histPorFactura = {};
      (rHist.data || []).forEach((h) => (histPorFactura[h.factura_id] ||= []).push(h));

      const filas = (rFac.data || []).map((f) => {
        const hist = histPorFactura[f.id] || [];
        const gen = ejeInfo(hist, "general", FLUJO_GENERAL, f.estatus_general, alertasMap);
        const fir = ejeInfo(hist, "firmas", FLUJO_FIRMAS, f.estatus_firmas, alertasMap);
        const ped = ejeInfo(hist, "pedido_recepcion", FLUJO_PEDIDO, f.estatus_pedido_recepcion, alertasMap);
        const estancada = gen.estancada || fir.estancada || ped.estancada;
        return { ...f, gen, fir, ped, estancada };
      });

      filas.sort((a, b) => {
        if (a.estancada !== b.estancada) return a.estancada ? -1 : 1;
        return (b.gen.dias ?? -1) - (a.gen.dias ?? -1);
      });

      setFacturas(filas);
      setCargando(false);
    }
    cargar();
    return () => { activo = false; };
  }, []);

  const totalEstancadas = useMemo(() => facturas.filter((f) => f.estancada).length, [facturas]);

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "10px 12px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontSize: 14, verticalAlign: "top" };

  // Celda de circuito: etiqueta actual + progreso + días si está estancado.
  const celdaCircuito = (eje, label) => (
    <div>
      <div>{label}</div>
      <div style={{ fontSize: 11, color: eje.estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: eje.estancada ? 700 : 400 }}>
        {eje.idx}/{eje.total}
        {eje.estancada && ` · ${eje.dias}d ⚠️`}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Seguimiento de facturas</h1>
        <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
          {facturas.length} factura(s)
          {totalEstancadas > 0 && (
            <span style={{ color: "var(--rojo)", fontWeight: 600 }}>{" · "}{totalEstancadas} estancada(s)</span>
          )}
        </div>
      </div>

      {mensaje && <p style={{ color: "var(--rojo)", fontSize: 13 }}>{mensaje}</p>}

      {facturas.length === 0 ? (
        <p style={{ color: "var(--texto-suave)", marginTop: 16 }}>
          No hay facturas capturadas todavía. <Link href="/facturas/nueva">Capturar una</Link>.
        </p>
      ) : (
        <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden", marginTop: 14 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Folio de ingreso</th>
                  <th style={th}>Proveedor</th>
                  <th style={th}>General</th>
                  <th style={th}>Circuito de firmas</th>
                  <th style={th}>Pedido-recepción</th>
                  <th style={{ ...th, textAlign: "right" }}>Importe</th>
                  <th style={th}>Valid.</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id} style={f.estancada ? { background: "var(--rojo-claro)" } : {}}>
                    <td style={td}>
                      <Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>
                        {f.folio_ingreso}
                      </Link>
                      <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{f.folio_proveedor}</div>
                    </td>
                    <td style={td}>{f.proveedores?.razon_social ?? "—"}</td>
                    <td style={td}>
                      <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "var(--verde-claro)", color: "var(--verde-oscuro)", whiteSpace: "nowrap" }}>
                        {LABEL_GENERAL[f.estatus_general] || f.estatus_general}
                      </span>
                      <div style={{ fontSize: 11, color: f.gen.estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: f.gen.estancada ? 700 : 400, marginTop: 3 }}>
                        {f.gen.dias == null ? "—" : `${f.gen.dias}d`}
                        {f.gen.lim != null ? ` / ${f.gen.lim}` : ""}
                        {f.gen.estancada && " ⚠️"}
                      </div>
                    </td>
                    <td style={td}>{celdaCircuito(f.fir, LABEL_FIRMAS[f.estatus_firmas])}</td>
                    <td style={td}>{celdaCircuito(f.ped, LABEL_PEDIDO[f.estatus_pedido_recepcion])}</td>
                    <td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td>
                    <td style={td}>
                      {f.validacion_ok === true ? (
                        <span style={{ color: "var(--verde-oscuro)" }}>✓</span>
                      ) : f.validacion_ok === false ? (
                        <span style={{ color: "var(--rojo)" }}>✗</span>
                      ) : (
                        <span style={{ color: "var(--texto-suave)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 12 }}>
        Renglones en rojo: algún eje supera su umbral de <code>alertas_config</code>. Cada circuito
        (firmas y pedido-recepción) avanza y se vigila de forma independiente. Progreso = paso actual / total.
      </p>
    </div>
  );
}
