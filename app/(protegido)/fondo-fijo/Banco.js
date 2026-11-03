"use client";
// Banco: ingresos y egresos de la cuenta del fondo. Arqueo: conteo del efectivo contra lo esperado.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { hoyLocal, leerTodo, money } from "../../../lib/fondoFijo";
import { Mensaje, dos, et, fCorta, inp, rejilla, tarjeta, td, th, titulo } from "./comun";

const DENOMINACIONES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
const VACIO = { fecha_ingreso: "", fecha_pago: "", ingreso: "", egreso: "", concepto: "" };

export default function Banco() {
  const [movs, setMovs] = useState([]);
  const [arqueos, setArqueos] = useState([]);
  const [m, setM] = useState(VACIO);
  const [conteo, setConteo] = useState({});
  const [esperado, setEsperado] = useState("");
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState(null);
  const leer = useCallback(async () => {
    try {
      setMovs(await leerTodo(() => supabase.from("ff_banco").select("*").order("fecha_ingreso", { nullsFirst: false }).order("created_at").order("id")));
      setArqueos(await leerTodo(() => supabase.from("ff_arqueos").select("*").order("fecha", { ascending: false }).order("id")));
    } catch (e) { setMsg({ error: true, t: e.message }); }
  }, []);
  useEffect(() => { leer(); }, [leer]);
  const conSaldo = useMemo(() => { let s = 0; return movs.map((x) => { s = Math.round((s + Number(x.ingreso) - Number(x.egreso)) * 100) / 100; return { ...x, saldo: s }; }); }, [movs]);
  const contado = DENOMINACIONES.reduce((s, d) => s + d * (Number(conteo[d]) || 0), 0);
  const dif = Math.round((contado - (Number(esperado) || 0)) * 100) / 100;
  const puedeMov = (Number(m.ingreso) > 0 || Number(m.egreso) > 0) && m.fecha_ingreso && String(m.concepto).trim();
  const guardarMov = async () => {
    const { error } = await supabase.from("ff_banco").insert({ fecha_ingreso: m.fecha_ingreso, fecha_pago: m.fecha_pago || null, ingreso: Number(m.ingreso) || 0, egreso: Number(m.egreso) || 0, concepto: m.concepto.trim() });
    setMsg(error ? { error: true, t: error.message } : { t: "Movimiento guardado." });
    if (!error) { setM(VACIO); await leer(); }
  };
  const guardarArqueo = async () => {
    const { error } = await supabase.from("ff_arqueos").insert({ fecha: hoyLocal(), conteo, contado, esperado: Number(esperado) || 0, nota: nota.trim() || null });
    setMsg(error ? { error: true, t: error.message } : { t: "Arqueo guardado." });
    if (!error) { setConteo({}); setEsperado(""); setNota(""); await leer(); }
  };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Mensaje msg={msg} />
      <div style={dos}>
        <div style={{ ...tarjeta, display: "grid", gap: 10 }}>
          <div style={{ ...titulo, marginBottom: 0 }}>NUEVO MOVIMIENTO DE BANCO</div>
          <div style={rejilla(130)}>
            <label><span style={et}>Fecha de ingreso</span><input type="date" style={inp} value={m.fecha_ingreso} onChange={(e) => setM((x) => ({ ...x, fecha_ingreso: e.target.value }))} /></label>
            <label><span style={et}>Fecha de pago</span><input type="date" style={inp} value={m.fecha_pago} onChange={(e) => setM((x) => ({ ...x, fecha_pago: e.target.value }))} /></label>
            <label><span style={et}>Ingreso</span><input style={inp} inputMode="decimal" value={m.ingreso} onChange={(e) => setM((x) => ({ ...x, ingreso: e.target.value }))} /></label>
            <label><span style={et}>Egreso</span><input style={inp} inputMode="decimal" value={m.egreso} onChange={(e) => setM((x) => ({ ...x, egreso: e.target.value }))} /></label>
          </div>
          <label><span style={et}>Concepto</span><input style={inp} value={m.concepto} onChange={(e) => setM((x) => ({ ...x, concepto: e.target.value }))} /></label>
          <button className="boton" style={{ opacity: puedeMov ? 1 : 0.5 }} disabled={!puedeMov} onClick={guardarMov}>Guardar movimiento</button>
        </div>
        <div style={{ ...tarjeta, display: "grid", gap: 10 }}>
          <div style={{ ...titulo, marginBottom: 0 }}>ARQUEO DE HOY</div>
          <div style={rejilla(90)}>{DENOMINACIONES.map((d) => <label key={d}><span style={et}>${d}</span><input style={inp} inputMode="numeric" value={conteo[d] || ""} onChange={(e) => setConteo((c) => ({ ...c, [d]: e.target.value }))} /></label>)}</div>
          <label><span style={et}>Efectivo esperado</span><input style={inp} inputMode="decimal" value={esperado} onChange={(e) => setEsperado(e.target.value)} /></label>
          <label><span style={et}>Nota</span><input style={inp} value={nota} onChange={(e) => setNota(e.target.value)} /></label>
          <div style={{ fontSize: 14 }}>Contado: <strong>{money(contado)}</strong> · Diferencia: <strong style={{ color: dif ? "var(--rojo)" : "var(--verde-oscuro)" }}>{money(dif)}</strong></div>
          <button className="boton" style={{ opacity: contado ? 1 : 0.5 }} disabled={!contado} onClick={guardarArqueo}>Guardar arqueo</button>
        </div>
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={titulo}>MOVIMIENTOS</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Ingreso", "Pago", "Ingreso $", "Egreso $", "Saldo", "Concepto"].map((t) => <th key={t} style={th}>{t}</th>)}</tr></thead>
          <tbody>{[...conSaldo].reverse().map((x) => <tr key={x.id}><td style={td}>{fCorta(x.fecha_ingreso)}</td><td style={td}>{fCorta(x.fecha_pago)}</td><td style={{ ...td, textAlign: "right" }}>{Number(x.ingreso) ? money(x.ingreso) : "—"}</td><td style={{ ...td, textAlign: "right" }}>{Number(x.egreso) ? money(x.egreso) : "—"}</td><td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{money(x.saldo)}</td><td style={td}>{x.concepto || "—"}</td></tr>)}
            {!conSaldo.length && <tr><td colSpan={6} style={td}>Sin movimientos.</td></tr>}</tbody>
        </table>
      </div>
      {!!arqueos.length && <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={titulo}>ARQUEOS</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Fecha", "Contado", "Esperado", "Diferencia", "Nota"].map((t) => <th key={t} style={th}>{t}</th>)}</tr></thead>
          <tbody>{arqueos.map((a) => <tr key={a.id}><td style={td}>{fCorta(a.fecha)}</td><td style={td}>{money(a.contado)}</td><td style={td}>{money(a.esperado)}</td><td style={td}>{money(Number(a.contado) - Number(a.esperado))}</td><td style={td}>{a.nota || "—"}</td></tr>)}</tbody>
        </table>
      </div>}
    </div>
  );
}
