"use client";
// Resumen mensual por cuenta, contra la disponibilidad, y proyección al cierre.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLUMNAS_MES, leerTodo, money, proyeccion, resumenMensual } from "../../../lib/fondoFijo";
import { Mensaje, tarjeta, td, th, titulo } from "./comun";

const n0 = (n) => (n ? Math.round(n).toLocaleString("es-MX") : "—");

export default function Resumen({ gastos, reembolsos }) {
  const [dispo, setDispo] = useState([]);
  const [msg, setMsg] = useState(null);
  useEffect(() => { leerTodo(() => supabase.from("dispo_detalle_actual").select("cuenta_finat, centro_costo, periodo, presupuesto, gasto, disponible").in("cuenta_finat", [...new Set(gastos.map((g) => g.cuenta).filter((c) => /^\d{8}$/.test(c || ""))), "52411024", "51371004", "51371007", "51371005", "51391001"]).order("cuenta_finat").order("periodo").order("centro_costo").order("proyecto")).then(setDispo).catch((e) => setMsg({ error: true, t: e.message })); }, [gastos]);
  const filas = useMemo(() => resumenMensual(gastos, dispo), [gastos, dispo]);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Mensaje msg={msg} />
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={titulo}>EJERCIDO POR MES (LO PAGADO POR EL FONDO, SEGÚN CAPTURA)</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Cuenta</th><th style={th}></th>{COLUMNAS_MES.map((m) => <th key={m} style={{ ...th, textAlign: "right" }}>{m.slice(0, 3)}</th>)}<th style={{ ...th, textAlign: "right" }}>Total</th></tr></thead>
          <tbody>
            {filas.map((f) => [
              <tr key={`${f.cuenta}${f.cc}e`}><td style={{ ...td, fontWeight: 600 }} rowSpan={2}>{f.cuenta} · {f.cc}<div style={{ fontSize: 11, fontWeight: 400, color: "var(--texto-suave)" }}>{f.nombre}</div></td><td style={{ ...td, fontSize: 12 }}>Captura</td>{COLUMNAS_MES.map((m) => <td key={m} style={{ ...td, textAlign: "right" }}>{n0(f.ejercido[m])}</td>)}<td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{n0(f.total)}</td></tr>,
              <tr key={`${f.cuenta}${f.cc}s`}><td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>Sistema</td>{COLUMNAS_MES.map((m) => <td key={m} style={{ ...td, textAlign: "right", color: "var(--texto-suave)" }}>{n0(f.sistema[m])}</td>)}<td style={{ ...td, textAlign: "right", color: "var(--texto-suave)" }}>{n0(f.gastoSistema)}</td></tr>,
            ])}
          </tbody>
        </table>
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={titulo}>PROYECCIÓN AL CIERRE</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Cuenta", "Presupuesto", "Gasto sistema", "Pendiente sin CR", "Saldo real", "Promedio mensual", "Cobertura", "% avance", "Falta por gastar", "Economía / necesidad"].map((t) => <th key={t} style={{ ...th, textAlign: t === "Cuenta" ? "left" : "right" }}>{t}</th>)}</tr></thead>
          <tbody>{filas.filter((f) => f.presupuesto || f.total).map((f) => { const p = proyeccion(f, gastos, reembolsos); return <tr key={`${f.cuenta}${f.cc}`}><td style={{ ...td, fontWeight: 600 }}>{f.cuenta} · {f.cc}</td>{[p.presupuesto, p.gasto, p.pendiente, p.saldo, p.promedio].map((n, i) => <td key={i} style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(n)}</td>)}<td style={{ ...td, textAlign: "right" }}>{p.cobertura == null ? "—" : `${p.cobertura} meses`}</td><td style={{ ...td, textAlign: "right" }}>{p.avance == null ? "—" : `${p.avance}%`}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(p.necesidad)}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: p.resultado < 0 ? "var(--rojo)" : "var(--verde-oscuro)" }}>{money(p.resultado)}</td></tr>; })}</tbody>
        </table>
        <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>Saldo real = presupuesto − gasto del sistema − lo pagado por el fondo sin CR. El promedio usa los meses completos del año; "falta por gastar" es ese promedio por los meses que quedan, incluido el actual.</div>
      </div>
    </div>
  );
}
