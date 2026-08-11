"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import {
  FLUJO_GENERAL, LABEL_GENERAL,
  FLUJO_FIRMAS, LABEL_FIRMAS,
  FLUJO_PEDIDO, LABEL_PEDIDO,
  puedeEnviarOoad,
} from "../../../../lib/estatus";

const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaCorta = (d) =>
  new Date(d).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
const diasEntre = (desde) =>
  Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 86400000));

// Stepper de un eje/circuito. El ✓ se basa en el historial real (no en la
// posición): una etapa está "hecha" solo si existe su renglón en el historial.
function Stepper({ titulo, flujo, labels, actual, historial, circuito, alertasMap }) {
  const fechaEntrada = {};
  const quienDe = {};
  historial
    .filter((h) => h.circuito === circuito)
    .forEach((h) => {
      if (!(h.estatus in fechaEntrada)) {
        fechaEntrada[h.estatus] = h.fecha;
        quienDe[h.estatus] = h.usuarios?.nombre;
      }
    });

  const idxActual = flujo.indexOf(actual);
  const entradaActual = fechaEntrada[actual];
  const dias = entradaActual != null ? diasEntre(entradaActual) : null;
  const lim = alertasMap[`${circuito}:${actual}`];
  const estancada = lim != null && dias != null && dias > lim;

  return (
    <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 240 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{titulo}</div>
      {dias != null && (
        <div style={{ fontSize: 12, color: estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: estancada ? 700 : 400, marginBottom: 10 }}>
          {dias} día(s) en etapa{lim != null ? ` (umbral ${lim})` : ""}{estancada ? " ⚠️ estancada" : ""}
        </div>
      )}
      {flujo.map((st, i) => {
        const registrada = fechaEntrada[st] != null;
        const actualEt = i === idxActual;
        const done = registrada && !actualEt;
        const omitida = !registrada && i < idxActual;
        const color = actualEt ? "var(--verde)" : done ? "var(--verde-oscuro)" : omitida ? "var(--ambar)" : "var(--borde)";
        return (
          <div key={st} style={{ display: "flex", gap: 10, paddingBottom: i < flujo.length - 1 ? 12 : 0, position: "relative" }}>
            {i < flujo.length - 1 && (
              <div style={{ position: "absolute", left: 8, top: 18, bottom: 0, width: 2, background: done ? "var(--verde-oscuro)" : "var(--borde)" }} />
            )}
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: done || actualEt ? color : "var(--blanco)", border: `2px solid ${color}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: done ? "#fff" : "var(--ambar)", fontSize: 11, fontWeight: 700, zIndex: 1 }}>
              {done ? "✓" : omitida ? "!" : ""}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: actualEt ? 700 : 400, color: actualEt || done ? "var(--texto)" : omitida ? "var(--ambar)" : "var(--texto-suave)" }}>
                {labels[st]}
                {actualEt && <span style={{ fontSize: 10, color: "var(--verde)", marginLeft: 6 }}>● actual</span>}
                {omitida && <span style={{ fontSize: 10, color: "var(--ambar)", marginLeft: 6 }}>omitida</span>}
              </div>
              {registrada && (
                <div style={{ fontSize: 11, color: "var(--texto-suave)" }}>
                  {fechaCorta(fechaEntrada[st])}{quienDe[st] ? ` · ${quienDe[st]}` : ""}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Control de cambio de un eje.
function Control({ label, flujo, labels, actual, sel, setSel, onGuardar, guardando, disabled, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
      <label style={{ fontSize: 13, color: "var(--texto-suave)", minWidth: 130 }}>{label}:</label>
      <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--borde)" }}>
        {flujo.map((st) => <option key={st} value={st}>{labels[st]}</option>)}
      </select>
      <button className="boton" onClick={onGuardar} disabled={guardando || sel === actual || disabled}>
        {guardando ? "Guardando…" : "Cambiar"}
      </button>
      {hint && <span style={{ fontSize: 12, color: "var(--ambar)" }}>{hint}</span>}
    </div>
  );
}

const siguiente = (flujo, actual) => flujo[Math.min(flujo.indexOf(actual) + 1, flujo.length - 1)];

export default function FacturaEstatusPage() {
  const facturaId = useParams().id;

  const [factura, setFactura] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [alertasMap, setAlertasMap] = useState({});
  const [selGen, setSelGen] = useState("");
  const [selFir, setSelFir] = useState("");
  const [selPed, setSelPed] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null); // qué eje se está guardando
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    const [rFac, rHist, rAlertas] = await Promise.all([
      supabase.from("facturas").select(
        "id, folio_ingreso, folio_proveedor, importe_factura, validacion_ok, diferencia_importe, periodo_inicio, periodo_fin, vigencia_alerta, estatus_general, estatus_firmas, estatus_pedido_recepcion, contratos ( numero_interno ), proveedores ( razon_social )"
      ).eq("id", facturaId).single(),
      supabase.from("factura_estatus_historial").select("circuito, estatus, fecha, usuarios ( nombre )").eq("factura_id", facturaId).order("fecha", { ascending: true }),
      supabase.from("alertas_config").select("circuito, estatus, dias_umbral"),
    ]);

    if (rFac.error || !rFac.data) {
      setMensaje("No se pudo cargar la factura: " + (rFac.error?.message || "no existe"));
      setCargando(false);
      return;
    }
    setFactura(rFac.data);
    setHistorial(rHist.data || []);
    const m = {};
    (rAlertas.data || []).forEach((a) => (m[`${a.circuito}:${a.estatus}`] = a.dias_umbral));
    setAlertasMap(m);
    setSelGen(siguiente(FLUJO_GENERAL, rFac.data.estatus_general));
    setSelFir(siguiente(FLUJO_FIRMAS, rFac.data.estatus_firmas));
    setSelPed(siguiente(FLUJO_PEDIDO, rFac.data.estatus_pedido_recepcion));
    setCargando(false);
  }

  useEffect(() => {
    let activo = true;
    (async () => { await cargar(); if (!activo) return; })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturaId]);

  async function cambiar(campo, valor) {
    setMensaje("");
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion?.session) {
      setMensaje("Tu sesión no es válida. Vuelve a iniciar sesión e inténtalo de nuevo.");
      return;
    }
    setGuardando(campo);
    try {
      const { data, error } = await supabase
        .from("facturas")
        .update({ [campo]: valor })
        .eq("id", facturaId)
        .select("id");
      if (error) {
        setMensaje("No se pudo cambiar el estatus: " + error.message);
      } else if (!data || data.length === 0) {
        setMensaje("El cambio NO se guardó (0 filas afectadas). Puede ser sesión o permisos; recarga o vuelve a iniciar sesión.");
      } else {
        await cargar();
      }
    } catch (err) {
      setMensaje("Error al cambiar el estatus: " + err.message);
    } finally {
      setGuardando(null);
    }
  }

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;
  if (!factura) {
    return (
      <div>
        <p style={{ color: "var(--rojo)" }}>{mensaje || "Factura no encontrada."}</p>
        <Link href="/facturas">← Todas las facturas</Link>
      </div>
    );
  }

  const bloqueoOoad = selGen === "enviada_ooad" && !puedeEnviarOoad(factura.estatus_firmas, factura.estatus_pedido_recepcion);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Link href="/facturas" style={{ fontSize: 13, color: "var(--texto-suave)" }}>← Todas las facturas</Link>
      <h1 style={{ fontSize: 22, margin: "6px 0 2px" }}>{factura.folio_ingreso}</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 0 }}>Folio proveedor {factura.folio_proveedor}</p>

      {/* Resumen */}
      <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px", margin: "12px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
        <div><strong>Proveedor:</strong> {factura.proveedores?.razon_social ?? "—"}</div>
        <div><strong>Contrato:</strong> {factura.contratos?.numero_interno ?? "—"}</div>
        <div><strong>Periodo:</strong> {factura.periodo_inicio} → {factura.periodo_fin}</div>
        <div><strong>Importe:</strong> {money(factura.importe_factura)}</div>
        <div><strong>Validación:</strong>{" "}
          {factura.validacion_ok === true ? <span style={{ color: "var(--verde-oscuro)" }}>✓ dentro de tolerancia</span>
            : factura.validacion_ok === false ? <span style={{ color: "var(--rojo)" }}>✗ dif. {money(factura.diferencia_importe)}</span>
            : <span style={{ color: "var(--texto-suave)" }}>sin detalle capturado</span>}
        </div>
        <div><Link href={`/facturas/${factura.id}/detalle`}>Ver / capturar detalle de servicios →</Link></div>
      </div>

      {factura.vigencia_alerta === "sin_vigencia" && (
        <div style={{ background: "var(--rojo-claro)", color: "var(--rojo)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>⚠️ El periodo cae fuera de la vigencia del contrato.</div>
      )}
      {factura.vigencia_alerta === "por_vencer" && (
        <div style={{ background: "var(--ambar-claro)", color: "var(--ambar)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>⚠️ La vigencia del contrato está por vencer.</div>
      )}

      {/* Eje general */}
      <div style={{ marginTop: 6 }}>
        <Stepper titulo="Estatus general" flujo={FLUJO_GENERAL} labels={LABEL_GENERAL} actual={factura.estatus_general} historial={historial} circuito="general" alertasMap={alertasMap} />
      </div>

      {/* Circuitos en paralelo */}
      <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <Stepper titulo="Circuito de firmas" flujo={FLUJO_FIRMAS} labels={LABEL_FIRMAS} actual={factura.estatus_firmas} historial={historial} circuito="firmas" alertasMap={alertasMap} />
        <Stepper titulo="Circuito de pedido-recepción" flujo={FLUJO_PEDIDO} labels={LABEL_PEDIDO} actual={factura.estatus_pedido_recepcion} historial={historial} circuito="pedido_recepcion" alertasMap={alertasMap} />
      </div>

      {/* Controles de cambio (cualquier rol) */}
      <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px", marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Cambiar estatus</div>
        <Control label="General" flujo={FLUJO_GENERAL} labels={LABEL_GENERAL} actual={factura.estatus_general} sel={selGen} setSel={setSelGen} onGuardar={() => cambiar("estatus_general", selGen)} guardando={guardando === "estatus_general"} disabled={bloqueoOoad} hint={bloqueoOoad ? "Requiere firmas y pedido completos para enviar a OOAD" : ""} />
        <Control label="Circuito de firmas" flujo={FLUJO_FIRMAS} labels={LABEL_FIRMAS} actual={factura.estatus_firmas} sel={selFir} setSel={setSelFir} onGuardar={() => cambiar("estatus_firmas", selFir)} guardando={guardando === "estatus_firmas"} />
        <Control label="Pedido-recepción" flujo={FLUJO_PEDIDO} labels={LABEL_PEDIDO} actual={factura.estatus_pedido_recepcion} sel={selPed} setSel={setSelPed} onGuardar={() => cambiar("estatus_pedido_recepcion", selPed)} guardando={guardando === "estatus_pedido_recepcion"} />
        {mensaje && <p style={{ fontSize: 13, color: "var(--rojo)", marginTop: 10 }}>{mensaje}</p>}
      </div>
    </div>
  );
}
