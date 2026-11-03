"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { leerTodo } from "../../../lib/paginar";
import { armarResumenServicios } from "../../../lib/resumenServicios";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const hTh = { textAlign: "left", fontSize: 11.5, color: "var(--texto-suave)", padding: "7px 9px", borderBottom: "2px solid var(--borde)", textTransform: "uppercase", letterSpacing: 0.3 };
const hTd = { padding: "7px 9px", borderBottom: "1px solid var(--borde)", fontSize: 13, verticalAlign: "top" };
const der = { textAlign: "right", whiteSpace: "nowrap" };
const nota = { fontSize: 11, color: "var(--texto-suave)" };
const tarjeta = { flex: "1 1 240px", background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 12, padding: "12px 14px" };

function Dias({ fila }) {
  if (fila.dias == null) return <span style={{ color: "var(--rojo)", fontWeight: 600 }}>sin fecha</span>;
  return <span style={{ fontWeight: 700, color: fila.factura.fir?.estancada ? "var(--rojo)" : "inherit" }}>{fila.dias}</span>;
}

function FacturaCelda({ f }) {
  return <Link href={`/facturas/${f.id}`} style={{ fontWeight: 600 }}>{f.folio_proveedor || f.folio_ingreso}</Link>;
}

export function VistaResumenServicios({ resumen, onCerrar, onExcel }) {
  const { pendientes, validadas } = resumen;
  return (
    <div className="hoja-resumen">
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button className="boton secundario" onClick={onCerrar}>← Volver a Seguimiento</button>
        <button className="boton secundario" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        <button className="boton secundario" onClick={onExcel}>Descargar Excel</button>
      </div>

      <h1 style={{ fontSize: 22, margin: 0 }}>Resumen de facturas en servicio</h1>
      <p style={{ margin: "4px 0 14px", fontSize: 13, color: "var(--texto-suave)" }}>
        Al {fecha(new Date().toISOString())} · {resumen.n} facturas · {money(resumen.monto)}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={tarjeta}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0e7490" }}>Con el servicio, por validar</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{pendientes.n}</div>
          <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{money(pendientes.monto)}</div>
        </div>
        <div style={tarjeta}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#15803d" }}>Ya validadas por el servicio</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{validadas.n}</div>
          <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{money(validadas.monto)}</div>
        </div>
      </div>

      <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>Por servicio</h2>
      <div style={{ overflowX: "auto", marginBottom: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={hTh}>Servicio</th>
            <th style={{ ...hTh, ...der }}>Facturas</th>
            <th style={{ ...hTh, ...der }}>Importe</th>
            <th style={{ ...hTh, ...der }}>Días de la más antigua</th>
          </tr></thead>
          <tbody>
            {pendientes.servicios.map((s) => (
              <tr key={s.nombre}>
                <td style={hTd}>{s.nombre}{s.jefatura && <div style={nota}>{s.jefatura}</div>}</td>
                <td style={{ ...hTd, ...der }}>{s.n}</td>
                <td style={{ ...hTd, ...der }}>{money(s.monto)}</td>
                <td style={{ ...hTd, ...der }}>{s.maxDias ?? "sin fecha"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ ...nota, margin: "0 0 18px" }}>
        Una factura enviada a varios jefes aparece con cada uno, así que la suma por servicio puede ser mayor que el total.
        {pendientes.sinOficio > 0 && ` ${pendientes.sinOficio} factura(s) no tienen oficio registrado.`}
        {pendientes.sinFecha > 0 && ` ${pendientes.sinFecha} no tienen fecha de envío en SIGAF: no se puede saber desde cuándo están.`}
      </p>

      {pendientes.servicios.map((s) => (
        <section key={s.nombre} className="bloque-resumen" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>
            {s.nombre}{s.jefatura ? ` · ${s.jefatura}` : ""}
            <span style={{ fontWeight: 400, fontSize: 13, color: "var(--texto-suave)" }}> — {s.n} factura(s), {money(s.monto)}</span>
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={hTh}>Factura</th><th style={hTh}>Proveedor</th><th style={hTh}>Contrato</th>
                <th style={{ ...hTh, ...der }}>Importe</th><th style={hTh}>Oficio</th><th style={hTh}>Desde</th><th style={{ ...hTh, ...der }}>Días</th>
              </tr></thead>
              <tbody>
                {s.filas.map((x) => (
                  <tr key={x.factura.id}>
                    <td style={hTd}><FacturaCelda f={x.factura} />{x.compartida && <div style={nota}>compartida con otro jefe</div>}</td>
                    <td style={hTd}>{x.factura.prov}</td>
                    <td style={hTd}>{x.factura.contrato}</td>
                    <td style={{ ...hTd, ...der }}>{money(x.importe)}</td>
                    <td style={hTd}>{x.oficio || <span style={{ color: "var(--rojo)" }}>sin oficio</span>}</td>
                    <td style={hTd}>{fecha(x.desde)}{x.reenvio && <div style={nota}>1er envío {fecha(x.reenvio)}</div>}</td>
                    <td style={{ ...hTd, ...der }}><Dias fila={x} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {validadas.n > 0 && (
        <section className="bloque-resumen">
          <h2 style={{ fontSize: 15, margin: "0 0 2px" }}>
            Ya validadas por el servicio
            <span style={{ fontWeight: 400, fontSize: 13, color: "var(--texto-suave)" }}> — {validadas.n} factura(s), {money(validadas.monto)}</span>
          </h2>
          <p style={{ ...nota, margin: "0 0 6px" }}>Siguen en esta etapa de Seguimiento, pero ya no dependen del servicio. "Validada" es la fecha en que cambió el estatus.</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={hTh}>Factura</th><th style={hTh}>Proveedor</th><th style={hTh}>Contrato</th>
                <th style={{ ...hTh, ...der }}>Importe</th><th style={hTh}>Oficio</th><th style={hTh}>Validada</th><th style={{ ...hTh, ...der }}>Días</th>
              </tr></thead>
              <tbody>
                {validadas.filas.map((x) => (
                  <tr key={x.factura.id}>
                    <td style={hTd}><FacturaCelda f={x.factura} /></td>
                    <td style={hTd}>{x.factura.prov}</td>
                    <td style={hTd}>{x.factura.contrato}</td>
                    <td style={{ ...hTd, ...der }}>{money(x.importe)}</td>
                    <td style={hTd}>{x.oficio || "sin oficio"}</td>
                    <td style={hTd}>{fecha(x.desde)}</td>
                    <td style={{ ...hTd, ...der }}><Dias fila={x} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .hoja-resumen, .hoja-resumen * { visibility: visible !important; }
          .hoja-resumen { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
          .bloque-resumen { break-before: page; }
        }
      `}</style>
    </div>
  );
}

async function descargarExcel(resumen) {
  const XLSX = await import("xlsx");
  const base = (situacion, servicio, jefatura, x) => ({
    "Situación": situacion, "Servicio": servicio, "Jefatura": jefatura,
    "Factura": x.factura.folio_proveedor || x.factura.folio_ingreso, "Proveedor": x.factura.prov,
    "Contrato": x.factura.contrato, "Capítulo": x.factura.capNom, "Importe": x.importe,
    "Oficio": x.oficio || "sin oficio", "Desde": fecha(x.desde), "Días": x.dias ?? "sin fecha",
    "Nota": [x.compartida && "Compartida con otro jefe", x.reenvio && `1er envío ${fecha(x.reenvio)}`].filter(Boolean).join(" · "),
  });
  const filas = [
    ...resumen.pendientes.servicios.flatMap((s) => s.filas.map((x) => base("Por validar", s.nombre, s.jefatura, x))),
    ...resumen.validadas.filas.map((x) => base("Ya validada", "", "", x)),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), "En servicio");
  XLSX.writeFile(wb, `FACTURAS EN SERVICIO ${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function ResumenServicios({ facturas, provJefes, onCerrar }) {
  const [oficios, setOficios] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    (async () => {
      const { data, error: e } = await leerTodo((d, h) => supabase.from("oficios")
        .select("id, folio, destinatario, factura_ids, created_at")
        .eq("tipo", "envio_servicio").order("created_at").order("id").range(d, h));
      if (!activo) return;
      if (e) setError("No pude leer los oficios: " + e.message);
      else setOficios(data);
    })();
    return () => { activo = false; };
  }, []);

  const resumen = useMemo(() => (oficios ? armarResumenServicios(facturas, oficios, provJefes) : null), [facturas, oficios, provJefes]);

  if (error) return <div><button className="boton secundario" onClick={onCerrar}>← Volver a Seguimiento</button><p style={{ color: "var(--rojo)", fontSize: 13 }}>{error}</p></div>;
  if (!resumen) return <p style={{ padding: 8 }}>Armando el resumen…</p>;
  return <VistaResumenServicios resumen={resumen} onCerrar={onCerrar} onExcel={() => descargarExcel(resumen)} />;
}
