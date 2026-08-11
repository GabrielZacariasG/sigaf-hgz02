"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

// Flujo de estatus confirmado (contexto §4), en orden.
const FLUJO = [
  "capturada",
  "en_revision",
  "en_firmas",
  "pedido_generado",
  "en_espera_recepcion",
  "recepcionado",
  "enviada_ooad",
  "en_tramite_ooad",
  "gasto_reflejado",
];

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

const ROLES_CAMBIO = ["jefe_presupuesto", "jefa_finanzas"];

const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const fechaCorta = (d) =>
  new Date(d).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

const diasEntre = (desde) =>
  Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);

export default function FacturaEstatusPage() {
  const facturaId = useParams().id;

  const [factura, setFactura] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [umbral, setUmbral] = useState({});
  const [rol, setRol] = useState(null);
  const [nuevoEstatus, setNuevoEstatus] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    const [rFac, rHist, rAlertas, rUser] = await Promise.all([
      supabase
        .from("facturas")
        .select(
          "id, folio_ingreso, folio_proveedor, importe_factura, estatus_actual, validacion_ok, total_calculado, diferencia_importe, periodo_inicio, periodo_fin, vigencia_alerta, contratos ( numero_interno, adquisicion_servicio ), proveedores ( razon_social )"
        )
        .eq("id", facturaId)
        .single(),
      supabase
        .from("factura_estatus_historial")
        .select("estatus, fecha, usuarios ( nombre )")
        .eq("factura_id", facturaId)
        .order("fecha", { ascending: true }),
      supabase.from("alertas_config").select("estatus, dias_umbral"),
      supabase.auth.getUser(),
    ]);

    if (rFac.error || !rFac.data) {
      setMensaje("No se pudo cargar la factura: " + (rFac.error?.message || "no existe"));
      setCargando(false);
      return;
    }

    setFactura(rFac.data);
    setHistorial(rHist.data || []);
    const u = {};
    (rAlertas.data || []).forEach((a) => (u[a.estatus] = a.dias_umbral));
    setUmbral(u);

    // Rol del usuario actual (para gatear la UI de cambio).
    const authId = rUser.data?.user?.id;
    if (authId) {
      const { data: perfil } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("auth_id", authId)
        .maybeSingle();
      setRol(perfil?.rol ?? null);
    }

    // Estatus destino por defecto: el siguiente del flujo.
    const idx = FLUJO.indexOf(rFac.data.estatus_actual);
    setNuevoEstatus(FLUJO[Math.min(idx + 1, FLUJO.length - 1)]);
    setCargando(false);
  }

  useEffect(() => {
    let activo = true;
    (async () => {
      await cargar();
      if (!activo) return;
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturaId]);

  // Mapa estatus -> fecha de entrada (primera vez que apareció en el historial).
  const fechaEntrada = useMemo(() => {
    const m = {};
    historial.forEach((h) => {
      if (!(h.estatus in m)) m[h.estatus] = h.fecha;
    });
    return m;
  }, [historial]);

  const idxActual = factura ? FLUJO.indexOf(factura.estatus_actual) : -1;
  const diasEnEtapa =
    factura && fechaEntrada[factura.estatus_actual] != null
      ? diasEntre(fechaEntrada[factura.estatus_actual])
      : null;
  const lim = factura ? umbral[factura.estatus_actual] : undefined;
  const estancada = lim != null && diasEnEtapa != null && diasEnEtapa > lim;
  const puedeCambiar = ROLES_CAMBIO.includes(rol);

  async function cambiarEstatus() {
    setMensaje("");
    setGuardando(true);
    try {
      const { error } = await supabase
        .from("facturas")
        .update({ estatus_actual: nuevoEstatus })
        .eq("id", facturaId);
      if (error) {
        setMensaje("No se pudo cambiar el estatus: " + error.message);
      } else {
        await cargar(); // refresca factura + historial (nueva entrada del trigger)
      }
    } catch (err) {
      setMensaje("Error al cambiar el estatus: " + err.message);
    } finally {
      setGuardando(false);
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

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link href="/facturas" style={{ fontSize: 13, color: "var(--texto-suave)" }}>
        ← Todas las facturas
      </Link>

      <h1 style={{ fontSize: 22, margin: "6px 0 2px" }}>{factura.folio_ingreso}</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 0 }}>
        Folio proveedor {factura.folio_proveedor}
      </p>

      {/* Resumen */}
      <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px", margin: "12px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
        <div><strong>Proveedor:</strong> {factura.proveedores?.razon_social ?? "—"}</div>
        <div><strong>Contrato:</strong> {factura.contratos?.numero_interno ?? "—"}</div>
        <div><strong>Periodo:</strong> {factura.periodo_inicio} → {factura.periodo_fin}</div>
        <div><strong>Importe:</strong> {money(factura.importe_factura)}</div>
        <div>
          <strong>Validación:</strong>{" "}
          {factura.validacion_ok === true ? (
            <span style={{ color: "var(--verde-oscuro)" }}>✓ dentro de tolerancia</span>
          ) : factura.validacion_ok === false ? (
            <span style={{ color: "var(--rojo)" }}>✗ diferencia {money(factura.diferencia_importe)}</span>
          ) : (
            <span style={{ color: "var(--texto-suave)" }}>sin detalle capturado</span>
          )}
        </div>
        <div>
          <Link href={`/facturas/${factura.id}/detalle`}>Ver / capturar detalle de servicios →</Link>
        </div>
      </div>

      {factura.vigencia_alerta === "sin_vigencia" && (
        <div style={{ background: "var(--rojo-claro)", color: "var(--rojo)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
          ⚠️ El periodo cae fuera de la vigencia del contrato.
        </div>
      )}
      {factura.vigencia_alerta === "por_vencer" && (
        <div style={{ background: "var(--ambar-claro)", color: "var(--ambar)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
          ⚠️ La vigencia del contrato está por vencer.
        </div>
      )}

      {/* Etapa actual + alerta */}
      <div style={{ margin: "6px 0 4px", fontSize: 14 }}>
        Etapa actual: <strong>{ESTATUS_LABEL[factura.estatus_actual]}</strong>
        {diasEnEtapa != null && (
          <span style={{ color: estancada ? "var(--rojo)" : "var(--texto-suave)", fontWeight: estancada ? 700 : 400 }}>
            {" · "}{diasEnEtapa} día(s) en etapa{lim != null ? ` (umbral ${lim})` : ""}
            {estancada ? " ⚠️ estancada" : ""}
          </span>
        )}
      </div>

      {/* Stepper */}
      <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "16px 18px", marginTop: 8 }}>
        {FLUJO.map((st, i) => {
          const done = i < idxActual;
          const actual = i === idxActual;
          const fecha = fechaEntrada[st];
          const quien = historial.find((h) => h.estatus === st)?.usuarios?.nombre;
          const color = actual ? "var(--verde)" : done ? "var(--verde-oscuro)" : "var(--borde)";
          return (
            <div key={st} style={{ display: "flex", gap: 12, paddingBottom: i < FLUJO.length - 1 ? 14 : 0, position: "relative" }}>
              {/* línea vertical */}
              {i < FLUJO.length - 1 && (
                <div style={{ position: "absolute", left: 9, top: 20, bottom: 0, width: 2, background: done ? "var(--verde-oscuro)" : "var(--borde)" }} />
              )}
              {/* punto */}
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: done || actual ? color : "var(--blanco)", border: `2px solid ${color}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, zIndex: 1 }}>
                {done ? "✓" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: actual ? 700 : 400, color: actual || done ? "var(--texto)" : "var(--texto-suave)" }}>
                  {ESTATUS_LABEL[st]}
                  {actual && <span style={{ fontSize: 11, color: "var(--verde)", marginLeft: 8 }}>● actual</span>}
                </div>
                {fecha && (
                  <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>
                    {fechaCorta(fecha)}{quien ? ` · ${quien}` : ""}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cambio de estatus */}
      <div style={{ marginTop: 16 }}>
        {puedeCambiar ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, color: "var(--texto-suave)" }}>Cambiar estatus a:</label>
            <select
              value={nuevoEstatus}
              onChange={(e) => setNuevoEstatus(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--borde)" }}
            >
              {FLUJO.map((st) => (
                <option key={st} value={st}>{ESTATUS_LABEL[st]}</option>
              ))}
            </select>
            <button
              className="boton"
              onClick={cambiarEstatus}
              disabled={guardando || nuevoEstatus === factura.estatus_actual}
            >
              {guardando ? "Guardando…" : "Cambiar estatus"}
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--texto-suave)" }}>
            Solo Presupuesto o Finanzas pueden cambiar el estatus. Tu rol
            {rol ? ` (${rol})` : ""} tiene acceso de solo lectura al seguimiento.
          </p>
        )}
        {mensaje && (
          <p style={{ fontSize: 13, color: "var(--rojo)", marginTop: 10 }}>{mensaje}</p>
        )}
      </div>
    </div>
  );
}
