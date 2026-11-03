"use client";
// Carga del histórico desde el Excel "PAGO X FONDO FIJO" y plantilla de comisionados.
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";
import { GRUPOS, TIPOS_CONTRATACION } from "../../../lib/pliegos";
import { TIPOS_GASTO } from "../../../lib/reembolsos";
import { leerHistorico } from "../../../lib/fondoHistorico";
import { leerTodo, money } from "../../../lib/fondoFijo";
import { Mensaje, chico, dos, et, inp, rejilla, tarjeta, td, th, titulo } from "./comun";

const VACIO = { matricula: "", nombre: "", categoria: "", horario: "", jornada: "", tc: "", gj: "" };
const partes = (lista, n = 300) => { const s = []; for (let i = 0; i < lista.length; i += n) s.push(lista.slice(i, i + n)); return s; };

export default function Carga({ gastos, reembolsos, comisionados, recargar }) {
  const [vista, setVista] = useState(null);
  const [nombre, setNombre] = useState("");
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [c, setC] = useState(VACIO);
  const [busca, setBusca] = useState("");
  const archivo = useRef(null);
  const leer = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setMsg(null);
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: false });
      setVista(leerHistorico(XLSX, wb)); setNombre(f.name);
    } catch (err) { setVista(null); setMsg({ error: true, t: err.message }); }
  };
  const cargar = async () => {
    setMsg(null);
    try {
      // Lo que ya se trabajó en SIGAF no se pisa con el Excel.
      setOcupado("Plantilla…");
      for (const p of partes(vista.comisionados)) { const { error } = await supabase.from("ff_comisionados").upsert(p, { onConflict: "matricula" }); if (error) throw error; }
      setOcupado("Reembolsos…");
      const propios = new Set(reembolsos.filter((r) => r.origen === "sigaf").map((r) => r.solicitud));
      const filasR = vista.reembolsos.filter((r) => !propios.has(r.solicitud));
      for (const p of partes(filasR)) { const { error } = await supabase.from("ff_reembolsos").upsert(p, { onConflict: "solicitud" }); if (error) throw error; }
      const ids = new Map((await leerTodo(() => supabase.from("ff_reembolsos").select("id, solicitud").order("id"))).map((r) => [r.solicitud, r.id]));
      setOcupado("Comprobantes…");
      const propiosG = new Set(gastos.filter((g) => g.origen === "sigaf").map((g) => g.clave));
      // Mismas columnas en cada renglón: PostgREST lo exige en una carga por lotes.
      const columnas = [...new Set(vista.gastos.flatMap((g) => Object.keys(g)))].filter((k) => k !== "_reembolso");
      const filasG = vista.gastos.filter((g) => !propiosG.has(g.clave)).map((g) => {
        const fila = {};
        columnas.forEach((k) => { fila[k] = g[k] === undefined ? (k === "anulado" ? false : null) : g[k]; });
        return { ...fila, reembolso_id: g._reembolso ? ids.get(g._reembolso) ?? null : null };
      });
      for (const p of partes(filasG)) { const { error } = await supabase.from("ff_gastos").upsert(p, { onConflict: "clave" }); if (error) throw error; }
      setOcupado("Banco…");
      for (const p of partes(vista.banco)) { const { error } = await supabase.from("ff_banco").upsert(p, { onConflict: "clave" }); if (error) throw error; }
      await recargar();
      setMsg({ t: `Histórico cargado: ${filasG.length} comprobantes, ${filasR.length} reembolsos, ${vista.comisionados.length} comisionados y ${vista.banco.length} movimientos de banco.` });
      setVista(null);
    } catch (err) { setMsg({ error: true, t: `No terminó; puedes volver a cargar el mismo archivo sin duplicar. ${err.message}` }); }
    setOcupado("");
  };
  const guardarPersona = async () => {
    const { error } = await supabase.from("ff_comisionados").upsert({ matricula: c.matricula.trim(), nombre: c.nombre.trim().toUpperCase(), categoria: c.categoria.trim().toUpperCase() || null, horario: c.horario.trim() || null, jornada: c.jornada || null, tc: c.tc || null, gj: c.gj || null, activo: true, actualizado_at: new Date().toISOString() }, { onConflict: "matricula" });
    setMsg(error ? { error: true, t: error.message } : { t: `${c.nombre} guardado en la plantilla.` });
    if (!error) { setC(VACIO); await recargar(); }
  };
  const editar = (p) => setC({ matricula: p.matricula, nombre: p.nombre || "", categoria: p.categoria || "", horario: p.horario || "", jornada: p.jornada || "", tc: p.tc || "", gj: p.gj || "" });
  const lista = useMemo(() => { const k = busca.trim().toUpperCase(); return k ? comisionados.filter((p) => `${p.matricula} ${p.nombre} ${p.categoria}`.toUpperCase().includes(k)) : comisionados; }, [comisionados, busca]);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Mensaje msg={msg} />
      <div style={tarjeta}>
        <div style={titulo}>CARGAR EL HISTÓRICO</div>
        <div style={{ fontSize: 13, marginBottom: 10 }}>Sube el Excel "PAGO X FONDO FIJO". Primero se muestra qué trae; nada se guarda hasta que confirmes. Se puede volver a subir sin duplicar y no pisa lo capturado en SIGAF.</div>
        <button className="boton secundario" onClick={() => archivo.current?.click()}>Elegir Excel</button>
        <input ref={archivo} type="file" accept=".xlsx,.xls,.xlsm" style={{ display: "none" }} onChange={leer} />
        {vista && <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{nombre}</div>
          <table style={{ borderCollapse: "collapse", marginBottom: 10 }}>
            <thead><tr><th style={th}>Tipo</th><th style={th}>Comprobantes</th><th style={th}>Total</th></tr></thead>
            <tbody>{Object.entries(vista.porTipo).map(([k, v]) => <tr key={k}><td style={td}>{TIPOS_GASTO[k].nombre}</td><td style={{ ...td, textAlign: "right" }}>{v.n}</td><td style={{ ...td, textAlign: "right" }}>{money(v.total)}</td></tr>)}</tbody>
          </table>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{vista.reembolsos.length} reembolsos · {vista.sinReembolso} comprobantes por reembolsar · {vista.comisionados.length} comisionados · {vista.banco.length} movimientos de banco</div>
          {!!vista.avisos.length && <div style={{ background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 10 }}><strong>Lo que no cuadra en el Excel ({vista.avisos.length}); se carga tal como está:</strong><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{vista.avisos.map((a) => <li key={a}>{a}</li>)}</ul></div>}
          <button className="boton" disabled={!!ocupado} onClick={cargar}>{ocupado || "Confirmar carga del histórico"}</button>
        </div>}
      </div>
      <div style={dos}>
        <div style={{ ...tarjeta, display: "grid", gap: 10 }}>
          <div style={{ ...titulo, marginBottom: 0 }}>COMISIONADO: ALTA O CAMBIO</div>
          <div style={rejilla(130)}>
            <label><span style={et}>Matrícula</span><input style={inp} value={c.matricula} onChange={(e) => setC((x) => ({ ...x, matricula: e.target.value }))} /></label>
            <label><span style={et}>Nombre (AP/AM/NOMBRE)</span><input style={inp} value={c.nombre} onChange={(e) => setC((x) => ({ ...x, nombre: e.target.value }))} /></label>
            <label><span style={et}>Categoría</span><input style={inp} value={c.categoria} onChange={(e) => setC((x) => ({ ...x, categoria: e.target.value }))} /></label>
            <label><span style={et}>Horario</span><input style={inp} value={c.horario} onChange={(e) => setC((x) => ({ ...x, horario: e.target.value }))} /></label>
            <label><span style={et}>Jornada</span><select style={inp} value={c.jornada} onChange={(e) => setC((x) => ({ ...x, jornada: e.target.value }))}><option value="">Elige…</option>{["MAT", "VESP", "NOCT", "JA", "SUSTITUTO", "SUPLENTE"].map((j) => <option key={j}>{j}</option>)}</select></label>
            <label><span style={et}>TC que se sugiere</span><select style={inp} value={c.tc} onChange={(e) => setC((x) => ({ ...x, tc: e.target.value }))}><option value="">02 Base</option>{TIPOS_CONTRATACION.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}</select></label>
            <label><span style={et}>Grupo jerárquico</span><select style={inp} value={c.gj} onChange={(e) => setC((x) => ({ ...x, gj: e.target.value }))}><option value="">—</option>{GRUPOS.map((g) => <option key={g.clave} value={g.clave}>{g.nombre}</option>)}</select></label>
          </div>
          <button className="boton" style={{ opacity: c.matricula.trim() && c.nombre.trim() ? 1 : 0.5 }} disabled={!c.matricula.trim() || !c.nombre.trim()} onClick={guardarPersona}>Guardar comisionado</button>
        </div>
        <div style={{ ...tarjeta, overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
          <div style={titulo}>PLANTILLA ({comisionados.length})</div>
          <input style={{ ...inp, marginBottom: 8 }} placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
            {lista.map((p) => <tr key={p.matricula}><td style={td}>{p.matricula}</td><td style={td}>{p.nombre}<div style={{ fontSize: 11, color: "var(--texto-suave)" }}>{p.categoria} · {p.jornada || "sin jornada"}</div></td><td style={td}><button className="boton secundario" style={chico} onClick={() => editar(p)}>Editar</button></td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}
