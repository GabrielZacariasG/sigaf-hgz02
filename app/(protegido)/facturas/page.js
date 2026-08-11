"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

// Etiquetas legibles para el enum estatus_factura (flujo, sección 4 del contexto).
const ESTATUS_LABEL = {
  capturada: "Capturada",
  en_revision: "En revisión",
  en_firmas: "En firmas",
  pedido_generado: "Pedido generado",
  en_espera_recepcion: "En espera de recepción",
  recepcionado: "Recepcionado",
  enviada_ooad: "Enviada a OOAD",
  en_tramite_ooad: "En trámite OOAD",
  gasto_reflejado: "Gasto reflejado",
};

const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const diasEntre = (desde) =>
  Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);

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
            "id, folio_ingreso, folio_proveedor, importe_factura, estatus_actual, validacion_ok, contratos ( numero_interno ), proveedores ( razon_social )"
          ),
        supabase.from("alertas_config").select("estatus, dias_umbral"),
        supabase.from("factura_estatus_historial").select("factura_id, estatus, fecha"),
      ]);

      if (!activo) return;

      const err = rFac.error || rAlertas.error || rHist.error;
      if (err) {
        setMensaje("No se pudieron cargar las facturas: " + err.message);
        setCargando(false);
        return;
      }

      // Umbral de días por estatus.
      const umbral = {};
      (rAlertas.data || []).forEach((a) => (umbral[a.estatus] = a.dias_umbral));

      // Historial agrupado por factura.
      const histPorFactura = {};
      (rHist.data || []).forEach((h) => {
        (histPorFactura[h.factura_id] ||= []).push(h);
      });

      const filas = (rFac.data || []).map((f) => {
        // Entrada a la etapa actual = fecha más reciente del historial cuyo
        // estatus coincide con el estatus_actual (el estatus solo avanza).
        const propias = (histPorFactura[f.id] || []).filter(
          (h) => h.estatus === f.estatus_actual
        );
        const entrada = propias.length
          ? propias.reduce((max, h) => (h.fecha > max ? h.fecha : max), propias[0].fecha)
          : null;
        const dias = entrada != null ? diasEntre(entrada) : null;
        const lim = umbral[f.estatus_actual]; // puede ser undefined (etapa final)
        const estancada = lim != null && dias != null && dias > lim;
        return { ...f, dias, lim, estancada };
      });

      // Estancadas primero, luego por más días en etapa.
      filas.sort((a, b) => {
        if (a.estancada !== b.estancada) return a.estancada ? -1 : 1;
        return (b.dias ?? -1) - (a.dias ?? -1);
      });

      setFacturas(filas);
      setCargando(false);
    }

    cargar();
    return () => {
      activo = false;
    };
  }, []);

  const totalEstancadas = useMemo(
    () => facturas.filter((f) => f.estancada).length,
    [facturas]
  );

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  const th = {
    textAlign: "left",
    fontSize: 12,
    color: "var(--texto-suave)",
    padding: "10px 12px",
    borderBottom: "1px solid var(--borde)",
    whiteSpace: "nowrap",
  };
  const td = { padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontSize: 14 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Seguimiento de facturas</h1>
        <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
          {facturas.length} factura(s)
          {totalEstancadas > 0 && (
            <span style={{ color: "var(--rojo)", fontWeight: 600 }}>
              {" · "}{totalEstancadas} estancada(s)
            </span>
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
                  <th style={th}>Contrato</th>
                  <th style={{ ...th, textAlign: "right" }}>Importe</th>
                  <th style={th}>Estatus</th>
                  <th style={{ ...th, textAlign: "right" }}>Días en etapa</th>
                  <th style={th}>Validación</th>
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
                    <td style={td}>{f.contratos?.numero_interno ?? "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td>
                    <td style={td}>
                      <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "var(--verde-claro)", color: "var(--verde-oscuro)", whiteSpace: "nowrap" }}>
                        {ESTATUS_LABEL[f.estatus_actual] || f.estatus_actual}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right", color: f.estancada ? "var(--rojo)" : "inherit", fontWeight: f.estancada ? 700 : 400 }}>
                      {f.dias == null ? "—" : `${f.dias} d`}
                      {f.lim != null && (
                        <span style={{ fontSize: 11, color: "var(--texto-suave)", fontWeight: 400 }}> / {f.lim}</span>
                      )}
                      {f.estancada && <span title="Estancada"> ⚠️</span>}
                    </td>
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
        Los renglones en rojo llevan más días de los permitidos en su etapa (umbral de <code>alertas_config</code>).
        La columna “Días en etapa / umbral” muestra los días transcurridos desde que entró al estatus actual.
      </p>
    </div>
  );
}
