"use client";
// Vista de solo lectura con todo lo capturado de un comprobante (pliego u otro).
import { TIPOS_CONTRATACION, GRUPOS } from "../../../lib/pliegos";
import { money } from "../../../lib/fondoFijo";
import { fCorta, tarjeta, titulo } from "./comun";

const tcNombre = (tc) => TIPOS_CONTRATACION.find((t) => t.clave === tc)?.nombre || tc || "—";
const gjNombre = (gj) => GRUPOS.find((g) => g.clave === gj)?.nombre || gj || "—";
const calidadNombre = (c) => (c === "CHOFER" ? "Chofer" : c === "ACOMPANANTE" ? "Acompañante" : c || "—");
const txt = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const mon = (v) => (Number(v) ? money(v) : "—");

function Fila({ k, v, fuerte }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "6px 0", borderBottom: "1px solid var(--borde)" }}>
      <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{k}</span>
      <span style={{ fontSize: 13.5, fontWeight: fuerte ? 800 : 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}
function Seccion({ titulo: t, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...titulo, marginBottom: 2 }}>{t}</div>
      {children}
    </div>
  );
}

export default function DetalleGasto({ gasto: g, onClose, onEditar }) {
  if (!g) return null;
  const esPliego = g.tipo === "PLIEGO";
  const acompanante = g.calidad === "ACOMPANANTE";
  const extras = Array.isArray(g.avisos) ? g.avisos : [];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, zIndex: 50, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...tarjeta, maxWidth: 580, width: "100%", marginTop: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--texto-suave)", textTransform: "uppercase", letterSpacing: 0.4 }}>{esPliego ? "Pliego de comisión" : g.tipo}</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{g.folio}{g.anio ? `/${g.anio}` : ""}</div>
            <div style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>Viaje {fCorta(g.fecha)}{g.mes_gasto ? ` · ${g.mes_gasto}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {onEditar && !g.reembolso_id && <button className="boton secundario" onClick={onEditar} style={{ fontSize: 13 }}>Editar</button>}
            <button className="boton secundario" onClick={onClose} style={{ fontSize: 13 }}>Cerrar</button>
          </div>
        </div>

        {g.anulado && <div style={{ background: "var(--rojo-claro)", color: "var(--rojo)", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 6 }}>Anulado — no cuenta en reembolsos ni resumen.</div>}

        {/* Importe destacado */}
        <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", borderRadius: 10, padding: "10px 14px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12.5 }}>Total del comprobante</span>
          <span style={{ fontSize: 24, fontWeight: 800 }}>{money(g.total)}</span>
        </div>

        {esPliego ? (
          <>
            <Seccion titulo="COMISIONADO">
              <Fila k="Nombre" v={txt(g.persona)} />
              <Fila k="Matrícula" v={txt(g.matricula)} />
              <Fila k="Tipo de contratación" v={tcNombre(g.tc)} />
              {g.tc && !["02", "03", "08"].includes(g.tc) && <Fila k="Grupo jerárquico" v={gjNombre(g.gj)} />}
              <Fila k="Va como" v={calidadNombre(g.calidad)} />
              {acompanante && <Fila k="Pliego del chofer" v={txt(g.folio_chofer)} />}
              <Fila k="Turno" v={txt(g.turno)} />
            </Seccion>

            <Seccion titulo="VIAJE">
              <Fila k="Destino" v={txt(g.destino)} />
              <Fila k="Unidad" v={txt(g.unidad)} />
              <Fila k="Salida" v={txt(g.salida)} />
              <Fila k="Llegada al destino" v={txt(g.llegada)} />
              <Fila k="Salida del destino" v={txt(g.salida_destino)} />
              <Fila k="Regreso" v={txt(g.regreso)} />
            </Seccion>

            <Seccion titulo="IMPORTES">
              <Fila k="Cuota calculada" v={g.cuota != null ? money(g.cuota) : "—"} />
              <Fila k="Importe a pagar" v={mon(g.importe)} />
              <Fila k="Casetas (peaje)" v={mon(g.casetas)} />
              <Fila k="Boletos de autobús" v={mon(g.boletos)} />
              <Fila k="Total" v={money(g.total)} fuerte />
              {g.motivo && <Fila k="Motivo (importe ≠ cuota)" v={g.motivo} />}
            </Seccion>

            {g.infarto === "SI" && (
              <Seccion titulo="CÓDIGO INFARTO">
                <Fila k="Paciente" v={txt(g.paciente)} />
                <Fila k="Folio TP01" v={txt(g.tp01)} />
              </Seccion>
            )}
          </>
        ) : (
          <Seccion titulo="DATOS">
            <Fila k="Comisionado / proveedor" v={txt(g.persona || g.proveedor)} />
            {g.nss && <Fila k="NSS" v={txt(g.nss)} />}
            {g.paciente && <Fila k="Paciente" v={txt(g.paciente)} />}
            {g.de && <Fila k="Del" v={fCorta(g.de)} />}
            {g.al && <Fila k="Al" v={fCorta(g.al)} />}
            {g.dias != null && <Fila k="Días" v={txt(g.dias)} />}
            <Fila k="Importe" v={mon(g.importe)} />
            <Fila k="Casetas" v={mon(g.casetas)} />
            <Fila k="Total" v={money(g.total)} fuerte />
            {g.observaciones && <Fila k="Observaciones" v={g.observaciones} />}
          </Seccion>
        )}

        <Seccion titulo="CODIFICACIÓN Y TRÁMITE">
          <Fila k="Cuenta" v={txt(g.cuenta)} />
          <Fila k="Centro de costos" v={txt(g.cc)} />
          <Fila k="Recibido en Finanzas" v={g.recibido ? fCorta(g.recibido) : "—"} />
          <Fila k="Fecha de pago" v={g.fecha_pago ? fCorta(g.fecha_pago) : "—"} />
          <Fila k="Reembolso" v={g.reembolso_id ? "Ya en un reembolso" : "Pendiente"} />
        </Seccion>

        {extras.length > 0 && (
          <Seccion titulo="AVISOS AL CAPTURAR">
            {extras.map((a, i) => <div key={i} style={{ background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, marginBottom: 5 }}>{a}</div>)}
          </Seccion>
        )}
      </div>
    </div>
  );
}
