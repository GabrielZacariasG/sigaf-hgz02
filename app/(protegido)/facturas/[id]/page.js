"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import {
  FLUJO_GENERAL, LABEL_GENERAL,
  FLUJO_FIRMAS, LABEL_FIRMAS,
  FLUJO_PEDIDO, LABEL_PEDIDO,
  puedeEnviarOoad,
} from "../../../../lib/estatus";

// Prefijo de folio de ingreso por capítulo (igual que en captura).
const PREFIJO_CAPITULO = { "Integrales": "INT", "Servicios Integrales": "INT", "Área Médica": "AM", "Subrogados": "SS", "Cuadro Básico": "CB", "Compra Emergente": "CE" };
function prefijoDe(nombre) {
  if (PREFIJO_CAPITULO[nombre]) return PREFIJO_CAPITULO[nombre];
  const s = (nombre || "GEN").normalize("NFD").replace(/[^\w\s]/g, "").trim().toUpperCase();
  return s.split(/\s+/).map((w) => w[0]).join("").slice(0, 3) || "GEN";
}
async function generarFolioIngreso(prefijoCap, anio) {
  const prefijo = `HGZ2-${prefijoCap}-${anio}-`;
  const { data, error } = await supabase.from("facturas").select("folio_ingreso").like("folio_ingreso", `${prefijo}%`).order("folio_ingreso", { ascending: false }).limit(1);
  if (error) throw error;
  let consec = 1;
  if (data && data.length > 0) { const n = parseInt(data[0].folio_ingreso.slice(prefijo.length), 10); if (!Number.isNaN(n)) consec = n + 1; }
  return prefijo + String(consec).padStart(6, "0");
}

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

// Control guiado de un eje: solo permite AVANZAR o RETROCEDER un paso (candado),
// para seguir el ciclo correcto sin saltos. Muestra la etapa actual y, si aplica,
// el botón para imprimir el oficio de esa etapa.
function GuidedControl({ label, flujo, labels, actual, onSet, guardando, avanzarBloqueado, hint, oficio }) {
  const idx = flujo.indexOf(actual);
  const next = idx >= 0 && idx < flujo.length - 1 ? flujo[idx + 1] : null;
  const prev = idx > 0 ? flujo[idx - 1] : null;
  return (
    <div style={{ borderTop: "1px solid var(--borde)", paddingTop: 12, marginTop: 12 }}>
      <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{labels[actual] || actual}</span>
        {next ? (
          <button className="boton" disabled={guardando || avanzarBloqueado}
            onClick={() => { if (window.confirm(`¿Seguro que deseas avanzar a "${labels[next]}"?`)) onSet(next); }}>
            {guardando ? "Guardando…" : `Avanzar → ${labels[next]}`}
          </button>
        ) : (
          <span style={{ fontSize: 12, color: "var(--verde-oscuro)", fontWeight: 600 }}>✓ etapa final</span>
        )}
        {prev && (
          <button className="boton secundario" style={{ fontSize: 12, padding: "6px 10px" }} disabled={guardando}
            onClick={() => { if (window.confirm(`¿Regresar a "${labels[prev]}"?`)) onSet(prev); }}>
            ↩ Retroceder
          </button>
        )}
      </div>
      {avanzarBloqueado && next && hint && (
        <div style={{ fontSize: 12, color: "var(--ambar)", marginTop: 6 }}>🔒 {hint}</div>
      )}
      {oficio && <div style={{ marginTop: 8 }}>{oficio}</div>}
    </div>
  );
}

// Botón-enlace para imprimir el oficio de ESTA factura (reusa la generación de la lista).
function BotonOficio({ href, texto }) {
  return (
    <Link href={href} className="boton secundario" style={{ display: "inline-block", fontSize: 13, textDecoration: "none" }}>
      📄 {texto}
    </Link>
  );
}

export default function FacturaEstatusPage() {
  const facturaId = useParams().id;
  const router = useRouter();

  const [factura, setFactura] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [alertasMap, setAlertasMap] = useState({});

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null); // qué eje se está guardando
  const [mensaje, setMensaje] = useState("");

  // Resolución de devolución
  const [accionDev, setAccionDev] = useState(null); // null | 'refactura'
  const [rfFolio, setRfFolio] = useState("");       // nuevo folio del proveedor
  const [rfImporte, setRfImporte] = useState("");   // nuevo importe (total con IVA)
  const [rfIni, setRfIni] = useState("");
  const [rfFin, setRfFin] = useState("");

  async function cargar() {
    const [rFac, rHist, rAlertas] = await Promise.all([
      supabase.from("facturas").select(
        "id, folio_ingreso, folio_proveedor, importe_factura, validacion_ok, diferencia_importe, periodo_inicio, periodo_fin, vigencia_alerta, estatus_general, estatus_firmas, estatus_pedido_recepcion, capitulo_id, partida_id, contrato_id, proveedor_id, orden_compra, motivo_devolucion, fecha_devolucion, reingresos, anulada, sustituida_por_id, sustituye_a_id, contratos ( numero_interno ), proveedores ( razon_social ), capitulos ( nombre )"
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

  // Reingreso: la MISMA factura vuelve a "en_revision" (editable) y se cuenta.
  async function reingresar() {
    if (!window.confirm("¿Reingresar la MISMA factura? Volverá a 'En revisión' y podrás corregir su detalle.")) return;
    setMensaje(""); setGuardando("dev");
    try {
      const { error } = await supabase.from("facturas").update({
        estatus_general: "en_revision",
        reingresos: (factura.reingresos || 0) + 1,
        fecha_reingreso: new Date().toISOString(),
      }).eq("id", facturaId);
      if (error) throw error;
      await cargar();
      setMensaje("");
    } catch (err) { setMensaje("No se pudo reingresar: " + err.message); }
    finally { setGuardando(null); }
  }

  // Re-factura: se crea una factura NUEVA (folio nuevo) enlazada; la original se anula.
  async function crearRefactura() {
    setMensaje("");
    if (!rfFolio.trim()) { setMensaje("Captura el folio de la NUEVA factura del proveedor."); return; }
    const imp = parseFloat(rfImporte);
    if (Number.isNaN(imp) || imp <= 0) { setMensaje("Captura el importe de la nueva factura."); return; }
    if (!rfIni || !rfFin) { setMensaje("Indica el periodo de la nueva factura."); return; }
    if (rfFin < rfIni) { setMensaje("La fecha fin no puede ser anterior a la inicio."); return; }
    setGuardando("dev");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const authId = userData?.user?.id ?? null;
      let createdBy = null;
      if (authId) { const { data: perfil } = await supabase.from("usuarios").select("id").eq("auth_id", authId).maybeSingle(); createdBy = perfil?.id ?? null; }
      if (!createdBy) { setMensaje("Tu usuario no está dado de alta en 'usuarios'."); setGuardando(null); return; }

      const anio = new Date(rfIni + "T00:00:00").getFullYear();
      const folioIngreso = await generarFolioIngreso(prefijoDe(factura.capitulos?.nombre), anio);

      const { data: nueva, error: eIns } = await supabase.from("facturas").insert({
        folio_ingreso: folioIngreso,
        folio_proveedor: rfFolio.trim(),
        capitulo_id: factura.capitulo_id,
        partida_id: factura.partida_id,
        contrato_id: factura.contrato_id,
        proveedor_id: factura.proveedor_id,
        orden_compra: factura.orden_compra || null,
        periodo_inicio: rfIni,
        periodo_fin: rfFin,
        importe_factura: imp,
        estatus_general: "capturada",
        sustituye_a_id: factura.id,
        created_by: createdBy,
      }).select("id, folio_ingreso").single();
      if (eIns) throw eIns;

      // Anular la original y enlazarla a la re-factura
      const { error: eUpd } = await supabase.from("facturas").update({
        anulada: true, sustituida_por_id: nueva.id,
      }).eq("id", factura.id);
      if (eUpd) throw eUpd;

      router.push(`/facturas/${nueva.id}/detalle`);
    } catch (err) { setMensaje("No se pudo crear la re-factura: " + err.message); setGuardando(null); }
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

  // Solo Integrales (PREI II, módulo de compras) genera pedido-recepción.
  // Los demás capítulos (PREI I: Área Médica, Subrogados, Compra Emergente) no.
  const generaPR = ["Integrales", "Servicios Integrales"].includes(factura.capitulos?.nombre);
  // Candado cruzado: solo se puede AVANZAR general a "enviada_ooad" si firmas (y pedido en Integrales) están completos.
  const idxGen = FLUJO_GENERAL.indexOf(factura.estatus_general);
  const nextGen = idxGen >= 0 && idxGen < FLUJO_GENERAL.length - 1 ? FLUJO_GENERAL[idxGen + 1] : null;
  const bloqueoOoad = nextGen === "enviada_ooad" && !puedeEnviarOoad(factura.estatus_firmas, generaPR ? factura.estatus_pedido_recepcion : "generado");

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

      {/* Enlaces de re-factura */}
      {factura.anulada && (
        <div style={{ background: "var(--ambar-claro)", color: "var(--ambar)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
          🚫 Esta factura fue <strong>anulada</strong> (re-facturada). No cuenta en montos.
          {factura.sustituida_por_id && <> Sustituida por <Link href={`/facturas/${factura.sustituida_por_id}`}>la nueva factura →</Link></>}
        </div>
      )}
      {factura.sustituye_a_id && (
        <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
          🔁 Esta factura <strong>sustituye</strong> a una devuelta. <Link href={`/facturas/${factura.sustituye_a_id}`}>Ver la factura original →</Link>
        </div>
      )}

      {/* Panel: RESOLVER DEVOLUCIÓN (solo si está devuelta y no anulada) */}
      {factura.estatus_general === "devuelta_proveedor" && !factura.anulada && (
        <div style={{ background: "var(--blanco)", border: "2px solid var(--ambar)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>↩ Resolver devolución</div>
          <div style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 2 }}>
            Devuelta el {factura.fecha_devolucion ? fechaCorta(factura.fecha_devolucion) : "—"}
            {factura.reingresos > 0 ? ` · ${factura.reingresos} reingreso(s) previo(s)` : ""}.
          </div>
          {factura.motivo_devolucion && <div style={{ fontSize: 13, marginTop: 6 }}><strong>Motivo:</strong> {factura.motivo_devolucion}</div>}

          {accionDev !== "refactura" ? (
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button className="boton" onClick={reingresar} disabled={guardando === "dev"}>
                {guardando === "dev" ? "Aplicando…" : "Reingreso (misma factura)"}
              </button>
              <button className="boton secundario" disabled={guardando === "dev"}
                onClick={() => { setAccionDev("refactura"); setRfFolio(""); setRfImporte(String(factura.importe_factura || "")); setRfIni(factura.periodo_inicio || ""); setRfFin(factura.periodo_fin || ""); }}>
                Re-factura (CFDI nuevo)
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--borde)", paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nueva factura (sustituye a {factura.folio_ingreso})</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ fontSize: 12, color: "var(--texto-suave)" }}>Folio del proveedor (nuevo)
                  <input type="text" value={rfFolio} onChange={(e) => setRfFolio(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--borde)", marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, color: "var(--texto-suave)" }}>Importe (total con IVA)
                  <input type="number" step="0.01" min="0" value={rfImporte} onChange={(e) => setRfImporte(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--borde)", marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, color: "var(--texto-suave)" }}>Periodo — inicio
                  <input type="date" value={rfIni} onChange={(e) => setRfIni(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--borde)", marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, color: "var(--texto-suave)" }}>Periodo — fin
                  <input type="date" value={rfFin} onChange={(e) => setRfFin(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--borde)", marginTop: 4 }} />
                </label>
              </div>
              <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>Se creará con folio de ingreso nuevo; esta factura quedará anulada y enlazada. Luego capturarás su subtotal/desglose.</div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button className="boton" onClick={crearRefactura} disabled={guardando === "dev"}>{guardando === "dev" ? "Creando…" : "Crear re-factura"}</button>
                <button className="boton secundario" onClick={() => setAccionDev(null)} disabled={guardando === "dev"}>Cancelar</button>
              </div>
            </div>
          )}
          {mensaje && <p style={{ fontSize: 13, color: "var(--rojo)", marginTop: 10 }}>{mensaje}</p>}
        </div>
      )}

      {/* Aviso de la etapa en que se encuentra la factura */}
      {(() => {
        const g = factura.estatus_general, f = factura.estatus_firmas;
        let msg = null;
        if (g === "gasto_reflejado") msg = "✅ Esta factura ya tiene el gasto reflejado (pagada).";
        else if (g === "en_tramite_ooad") msg = "🏛️ Esta factura está en trámite en la OOAD.";
        else if (g === "enviada_ooad") msg = "📤 Esta factura fue enviada a la OOAD para su pago.";
        else if (f === "autorizada_admin_contrato") msg = "✍️ Autorizada por el Administrador del Contrato.";
        else if (f === "envio_firmas_admin_contrato") msg = "📤 Enviada a firma del Administrador del Contrato.";
        else if (f === "autorizada_servicio") msg = "✍️ Validada por el servicio.";
        else if (f === "envio_firmas_servicio") msg = "📤 Esta factura se encuentra en validación por el servicio.";
        return msg ? (
          <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{msg}</div>
        ) : null;
      })()}

      {/* Eje general */}
      <div style={{ marginTop: 6 }}>
        <Stepper titulo="Estatus general" flujo={FLUJO_GENERAL} labels={LABEL_GENERAL} actual={factura.estatus_general} historial={historial} circuito="general" alertasMap={alertasMap} />
      </div>

      {/* Circuitos en paralelo */}
      <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <Stepper titulo="Circuito de firmas" flujo={FLUJO_FIRMAS} labels={LABEL_FIRMAS} actual={factura.estatus_firmas} historial={historial} circuito="firmas" alertasMap={alertasMap} />
        {generaPR && <Stepper titulo="Circuito de pedido-recepción" flujo={FLUJO_PEDIDO} labels={LABEL_PEDIDO} actual={factura.estatus_pedido_recepcion} historial={historial} circuito="pedido_recepcion" alertasMap={alertasMap} />}
      </div>

      {/* Avance guiado (candados: solo un paso a la vez) */}
      <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px", marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Avanzar la factura</div>
        <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 2 }}>Sigue el ciclo paso a paso. Cada eje solo avanza (o retrocede) una etapa a la vez.</div>

        <GuidedControl
          label="Estatus general"
          flujo={FLUJO_GENERAL} labels={LABEL_GENERAL} actual={factura.estatus_general}
          onSet={(v) => cambiar("estatus_general", v)} guardando={guardando === "estatus_general"}
          avanzarBloqueado={bloqueoOoad}
          hint={generaPR ? "Requiere firmas y pedido-recepción completos para enviar a OOAD" : "Requiere firmas completas para enviar a OOAD"}
          oficio={factura.estatus_general === "enviada_ooad"
            ? <BotonOficio href={`/facturas?accion=pago&id=${factura.id}`} texto="Imprimir oficio de envío a pago (OOAD)" />
            : null}
        />

        <GuidedControl
          label="Circuito de firmas"
          flujo={FLUJO_FIRMAS} labels={LABEL_FIRMAS} actual={factura.estatus_firmas}
          onSet={(v) => cambiar("estatus_firmas", v)} guardando={guardando === "estatus_firmas"}
          oficio={factura.estatus_firmas === "envio_firmas_servicio"
            ? <BotonOficio href={`/facturas?accion=memo&id=${factura.id}`} texto="Imprimir memo de envío al servicio" />
            : null}
        />

        {generaPR ? (
          <GuidedControl
            label="Circuito de pedido-recepción"
            flujo={FLUJO_PEDIDO} labels={LABEL_PEDIDO} actual={factura.estatus_pedido_recepcion}
            onSet={(v) => cambiar("estatus_pedido_recepcion", v)} guardando={guardando === "estatus_pedido_recepcion"}
          />
        ) : (
          <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 12, borderTop: "1px solid var(--borde)", paddingTop: 12 }}>Este capítulo no genera pedido-recepción (no aplica módulo de compras / PREI II).</p>
        )}

        {mensaje && <p style={{ fontSize: 13, color: "var(--rojo)", marginTop: 10 }}>{mensaje}</p>}
      </div>
    </div>
  );
}
