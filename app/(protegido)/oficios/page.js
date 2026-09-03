"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const TIPO_LABEL = { envio_pago: "Envío a pago (OOAD)", devolucion: "Devolución a proveedor", envio_servicio: "Envío a servicio" };
const TIPO_COLOR = { envio_pago: "#1d4ed8", devolucion: "#b45309", envio_servicio: "#0f766e" };

export default function OficiosPage() {
  const [oficios, setOficios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [abierto, setAbierto] = useState(null);      // id del oficio expandido
  const [facturas, setFacturas] = useState({});      // oficioId -> [facturas]
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("oficios")
        .select("id, tipo, folio, anio, consecutivo, destinatario, total, factura_ids, motivo, created_at")
        .order("created_at", { ascending: false });
      if (error) setMensaje("No pude cargar los oficios: " + error.message + " (¿ya corriste sigaf_oficios.sql?)");
      setOficios(data || []);
      setCargando(false);
    })();
  }, []);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return oficios.filter((o) => {
      if (tipo && o.tipo !== tipo) return false;
      if (t) { const blob = `${o.folio} ${o.destinatario ?? ""}`.toLowerCase(); if (!blob.includes(t)) return false; }
      return true;
    });
  }, [oficios, q, tipo]);

  const verDetalle = async (o) => {
    if (abierto === o.id) { setAbierto(null); return; }
    setAbierto(o.id);
    if (!facturas[o.id]) {
      const { data } = await supabase
        .from("facturas")
        .select("id, folio_proveedor, importe_factura, proveedores ( razon_social ), contratos ( numero_interno )")
        .in("id", o.factura_ids && o.factura_ids.length ? o.factura_ids : ["00000000-0000-0000-0000-000000000000"]);
      setFacturas((p) => ({ ...p, [o.id]: data || [] }));
    }
  };

  const card = { background: "var(--fondo-panel, #fff)", border: "1px solid var(--borde)", borderRadius: 10, padding: 14 };
  const inp = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14 };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "2px solid var(--borde)", textTransform: "uppercase", letterSpacing: 0.3 };
  const td = { padding: "9px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13.5, verticalAlign: "top" };
  const chip = (activo, color) => ({ padding: "5px 12px", borderRadius: 20, border: `1px solid ${activo ? color : "var(--borde)"}`, background: activo ? color : "transparent", color: activo ? "#fff" : "var(--texto)", fontSize: 12.5, cursor: "pointer", fontWeight: 600 });

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Oficios emitidos</h1>
          <p style={{ margin: "4px 0 0", color: "var(--texto-suave)", fontSize: 13 }}>Busca por folio o destinatario. {oficios.length} oficio(s) registrado(s).</p>
        </div>
        <Link href="/facturas" className="boton secundario">← Seguimiento</Link>
      </div>

      {mensaje && <div style={{ ...card, borderColor: "#f0b", color: "#b00", fontSize: 13 }}>{mensaje}</div>}

      <div style={{ ...card, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar folio (ej. SIGAF-EP-0001) o destinatario…" style={{ ...inp, minWidth: 320, flex: 1 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={chip(tipo === "", "#444")} onClick={() => setTipo("")}>Todos</span>
          {Object.keys(TIPO_LABEL).map((k) => (
            <span key={k} style={chip(tipo === k, TIPO_COLOR[k])} onClick={() => setTipo(tipo === k ? "" : k)}>{TIPO_LABEL[k]}</span>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead><tr>
            <th style={th}>Folio</th><th style={th}>Tipo</th><th style={th}>Destinatario</th>
            <th style={th}>Facturas</th><th style={{ ...th, textAlign: "right" }}>Total</th><th style={th}>Fecha</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td style={{ ...td, color: "var(--texto-suave)" }} colSpan={7}>Sin oficios con ese criterio.</td></tr>
            ) : filtrados.map((o) => (
              <Fragment key={o.id}>
                <tr style={{ cursor: "pointer" }} onClick={() => verDetalle(o)}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{o.folio}</td>
                  <td style={td}><span style={{ color: TIPO_COLOR[o.tipo], fontWeight: 600 }}>{TIPO_LABEL[o.tipo] || o.tipo}</span></td>
                  <td style={td}>{o.destinatario || "—"}</td>
                  <td style={td}>{(o.factura_ids || []).length}</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(o.total)}</td>
                  <td style={td}>{new Date(o.created_at).toLocaleDateString("es-MX")}</td>
                  <td style={{ ...td, color: "var(--texto-suave)" }}>{abierto === o.id ? "▲" : "▼"}</td>
                </tr>
                {abierto === o.id && (
                  <tr>
                    <td style={{ ...td, background: "var(--fondo, #f8f8f8)" }} colSpan={7}>
                      {o.motivo && <div style={{ marginBottom: 8, fontSize: 13 }}><strong>Motivo:</strong> {o.motivo}</div>}
                      {!facturas[o.id] ? <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>Cargando facturas…</span> : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead><tr><th style={th}>Folio factura</th><th style={th}>Proveedor</th><th style={th}>Contrato</th><th style={{ ...th, textAlign: "right" }}>Importe</th></tr></thead>
                          <tbody>
                            {facturas[o.id].map((f) => (
                              <tr key={f.id}><td style={td}>{f.folio_proveedor}</td><td style={td}>{f.proveedores?.razon_social || "—"}</td><td style={td}>{f.contratos?.numero_interno || "—"}</td><td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
