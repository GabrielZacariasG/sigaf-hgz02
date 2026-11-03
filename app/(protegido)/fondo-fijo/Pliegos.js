"use client";
// Pliegos: por llegar (lo que manda Servicios Generales), captura con filtros y lista de capturados.
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";
import { DESTINOS, GRUPOS, TIPOS_CONTRATACION, esTransportes, revisarPliego, tablaDe } from "../../../lib/pliegos";
import { compararConPrecarga, folioNorm, leerControl, leerInforme, unirPrecarga } from "../../../lib/pliegosPrecarga";
import { TIPOS_GASTO } from "../../../lib/reembolsos";
import { claveGasto, deducirImportes, hoyLocal, mesDeFecha, money, pliegoParaFiltro } from "../../../lib/fondoFijo";
import { Mensaje, chico, dos, et, fCorta, inp, pestana, rejilla, tarjeta, td, th, titulo } from "./comun";

const VACIO = { folio: "", fecha: "", matricula: "", tc: "", gj: "", calidad: "", folioChofer: "", destino: "", unidad: "", salida: "", llegada: "", salidaDestino: "", regreso: "", importe: "", casetas: "", boletos: "", motivo: "", infarto: "NO", paciente: "", tp01: "", recibido: "", pago: "" };
const NOMBRE_TABLA = { BASE: "personal de base", OPER: "operativo y Estatuto A", PK: "grupo P/K", JG: "grupo J-G" };
const num = (v) => Number(v) || 0;

export default function Pliegos({ gastos, precarga, comisionados, recargar }) {
  const [vista, setVista] = useState("porLlegar");
  const [p, setP] = useState(VACIO);
  const [enEdicion, setEnEdicion] = useState(null);
  const [item, setItem] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const archivo = useRef(null);
  const pliegos = useMemo(() => gastos.filter((g) => g.tipo === "PLIEGO" && !g.anulado), [gastos]);
  const capturados = useMemo(() => pliegos.filter((g) => g.id !== enEdicion).map(pliegoParaFiltro), [pliegos, enEdicion]);
  const persona = comisionados.find((c) => c.matricula === p.matricula);
  const destino = DESTINOS.find((x) => x.nombre === p.destino);
  const r = useMemo(() => revisarPliego(p, persona, destino, capturados, hoyLocal()), [p, persona, destino, capturados]);
  const bloqueos = r.avisos.filter((a) => a.nivel === "bloquea"), avisos = r.avisos.filter((a) => a.nivel === "avisa");
  const contraRelacion = useMemo(() => compararConPrecarga(item && { ...item, importe: item.importe == null ? null : Number(item.importe), casetas: Number(item.casetas) }, p), [item, p]);
  const porLlegar = precarga.filter((x) => !x.gasto_id);
  const pon = (c) => (e) => { setMsg(null); setP((x) => ({ ...x, [c]: e.target.value })); };
  // El pliego físico manda: esto solo sugiere tipo de contratación, grupo y calidad al elegir a la persona.
  const sugerir = (matricula) => { const c = comisionados.find((x) => x.matricula === matricula); return c ? { tc: c.tc || "02", gj: c.gj || "", calidad: esTransportes(c.categoria) ? "CHOFER" : "ACOMPANANTE" } : {}; };
  const llego = (it) => {
    setMsg(null); setItem(it); setEnEdicion(null); setVista("captura");
    setP({ ...VACIO, ...sugerir(it.matricula), matricula: it.matricula || "", folio: it.folio, fecha: it.fecha || "", destino: it.destino || "", unidad: it.unidad || "", importe: it.importe == null ? "" : String(it.importe), casetas: Number(it.casetas) ? String(it.casetas) : "", recibido: hoyLocal() });
  };
  const nueva = () => { setMsg(null); setItem(null); setEnEdicion(null); setP({ ...VACIO, recibido: hoyLocal() }); setVista("captura"); };
  const editar = (g) => {
    setMsg(null); setItem(null); setEnEdicion(g.id); setVista("captura");
    setP({ ...VACIO, folio: g.folio, fecha: g.fecha || "", matricula: g.matricula || "", tc: g.tc || sugerir(g.matricula).tc || "", gj: g.gj || "", calidad: g.calidad || sugerir(g.matricula).calidad || "", folioChofer: g.folio_chofer || "", destino: g.destino || "", unidad: g.unidad || "", salida: g.salida || "", llegada: g.llegada || "", salidaDestino: g.salida_destino || "", regreso: g.regreso || "", importe: String(g.importe ?? ""), casetas: Number(g.casetas) ? String(g.casetas) : "", boletos: Number(g.boletos) ? String(g.boletos) : "", motivo: g.motivo || "", infarto: g.infarto || "NO", paciente: g.paciente || "", tp01: g.tp01 || "", recibido: g.recibido || "", pago: g.fecha_pago || "" });
  };
  const guardar = async () => {
    setOcupado(true); setMsg(null);
    const anio = Number(p.fecha.slice(0, 4));
    const fila = {
      clave: claveGasto("PLIEGO", p.folio, anio), tipo: "PLIEGO", folio: p.folio.trim().toUpperCase().split("/")[0], anio, fecha: p.fecha, mes_gasto: mesDeFecha(p.fecha),
      importe: num(p.importe), casetas: num(p.casetas), boletos: num(p.boletos), total: r.total, cuenta: TIPOS_GASTO.PLIEGO.cuenta, cc: TIPOS_GASTO.PLIEGO.cc,
      matricula: p.matricula, persona: persona.nombre, turno: r.turno, tc: p.tc, gj: p.gj || null, calidad: p.calidad || null, folio_chofer: p.folioChofer || null, destino: p.destino, unidad: p.unidad || null,
      salida: p.salida, llegada: p.llegada, salida_destino: p.salidaDestino, regreso: p.regreso, cuota: r.cuota, motivo: p.motivo || null, infarto: p.infarto, paciente: p.paciente || null, tp01: p.tp01 || null,
      recibido: p.recibido || null, fecha_pago: p.pago || null, avisos: r.avisos.length || contraRelacion.length ? [...r.avisos.map((a) => a.t), ...contraRelacion] : null, actualizado_at: new Date().toISOString(),
    };
    const { data, error } = enEdicion ? await supabase.from("ff_gastos").update(fila).eq("id", enEdicion).select("id").single() : await supabase.from("ff_gastos").insert(fila).select("id").single();
    if (error) { setOcupado(false); setMsg({ error: true, t: /ux_ff_gasto_clave|duplicate/i.test(error.message) ? `El folio ${p.folio} ya está capturado.` : error.message }); return; }
    if (item) {
      const { error: e2 } = await supabase.from("ff_precarga").update({ gasto_id: data.id, llego_at: new Date().toISOString() }).eq("clave", item.clave);
      if (e2) { setOcupado(false); setMsg({ error: true, t: `Se guardó el pliego, pero no se marcó su llegada: ${e2.message}` }); return; }
    }
    await recargar();
    setOcupado(false); setMsg({ t: `Folio ${fila.folio} guardado.` }); setP({ ...VACIO, recibido: hoyLocal() }); setEnEdicion(null);
    if (item) { setItem(null); setVista("porLlegar"); }
  };
  const anular = async (g) => {
    if (!window.confirm(`¿Anular el pliego ${g.folio}? Deja de contar en reembolsos y resumen.`)) return;
    const { error } = await supabase.from("ff_gastos").update({ anulado: true, clave: `${g.clave}|ANULADO|${g.id.slice(0, 4)}`, actualizado_at: new Date().toISOString() }).eq("id", g.id);
    setMsg(error ? { error: true, t: error.message } : { t: `Folio ${g.folio} anulado.` });
    if (!error) await recargar();
  };
  const subir = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setOcupado(true); setMsg(null);
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: false });
      let control = [], informe = [];
      wb.SheetNames.forEach((n) => { const g = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }); control = control.concat(leerControl(g) || []); informe = informe.concat(leerInforme(g) || []); });
      if (!control.length && !informe.length) throw new Error("El archivo no parece Control ni Informe de pliegos.");
      const ya = new Set(pliegos.map((x) => `${folioNorm(x.folio)}|${x.anio}`));
      const nuevos = deducirImportes(unirPrecarga(control, informe).filter((x) => x.clave), pliegos);
      const filas = nuevos.filter((x) => !ya.has(`${x.clave}|${x.anio}`) && !precarga.some((c) => c.clave === `${x.clave}|${x.anio}` && c.gasto_id)).map((x) => ({
        clave: `${x.clave}|${x.anio}`, folio: x.folio, anio: x.anio, fecha: x.fecha || null, matricula: x.matricula || null, nombre: x.nombre || null, turno_sg: x.turnoSG || null, lugar: x.lugar || null, destino: x.destino || null,
        importe: x.importe, casetas: x.casetas || 0, unidad: x.unidad || null, estatus_sg: x.estatusSG || null, obs_sg: x.obsSG || null, fuentes: x.fuentes.join(" + "), total_persona: x.totalPersona ?? null, folios_persona: x.foliosPersona ?? null, deducido: x.deducido || null, archivo: f.name, actualizado_at: new Date().toISOString(),
      }));
      if (filas.length) { const { error } = await supabase.from("ff_precarga").upsert(filas, { onConflict: "clave" }); if (error) throw error; }
      await recargar();
      setMsg({ t: `${f.name}: ${filas.length} folio(s) en la lista; ${nuevos.length - filas.length} ya estaban capturados.` });
    } catch (err) { setMsg({ error: true, t: err.message }); }
    setOcupado(false);
  };
  const lista = useMemo(() => { const k = busca.trim().toUpperCase(); return (k ? pliegos.filter((g) => `${g.folio} ${g.persona} ${g.matricula} ${g.destino}`.toUpperCase().includes(k)) : pliegos).slice(0, 60); }, [pliegos, busca]);
  const ok = !r.avisos.length && !contraRelacion.length;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button style={pestana(vista === "porLlegar")} onClick={() => { setMsg(null); setVista("porLlegar"); }}>Por llegar ({porLlegar.length})</button>
        <button style={pestana(vista === "captura" && !item && !enEdicion)} onClick={nueva}>+ Nueva captura</button>
        <button style={pestana(vista === "lista")} onClick={() => { setMsg(null); setVista("lista"); }}>Capturados ({pliegos.length})</button>
        <button className="boton secundario" style={{ marginLeft: "auto" }} disabled={ocupado} onClick={() => archivo.current?.click()}>Subir relación de Servicios Generales</button>
        <input ref={archivo} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={subir} />
      </div>
      <Mensaje msg={msg} />
      {vista === "porLlegar" && (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Folio", "Comisionado", "Fecha", "Destino", "Importe", "Casetas", "Viene de", "Serv. Generales", ""].map((t) => <th key={t} style={th}>{t}</th>)}</tr></thead>
            <tbody>
              {porLlegar.map((it) => (
                <tr key={it.clave}>
                  <td style={{ ...td, fontWeight: 600 }}>{it.folio}</td><td style={td}>{it.nombre}</td>
                  <td style={td}>{it.fecha ? fCorta(it.fecha) : <span style={{ color: "var(--rojo)" }}>falta</span>}</td>
                  <td style={td}>{it.destino || it.lugar || <span style={{ color: "var(--rojo)" }}>falta</span>}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{it.importe == null ? <span style={{ color: "var(--rojo)" }}>falta</span> : money(it.importe)}{it.deducido && <div style={{ fontSize: 11, color: "var(--texto-suave)" }} title={it.deducido}>deducido</div>}</td>
                  <td style={td}>{Number(it.casetas) ? money(it.casetas) : "—"}</td><td style={td}>{it.fuentes}</td><td style={td}>{it.estatus_sg || "—"}</td>
                  <td style={td}><button className="boton" style={chico} onClick={() => llego(it)}>Ya llegó</button></td>
                </tr>
              ))}
              {!porLlegar.length && <tr><td colSpan={9} style={td}>No hay folios por llegar. Sube el Control o el Informe de Servicios Generales.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {vista === "lista" && (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <input style={{ ...inp, maxWidth: 340, marginBottom: 8 }} placeholder="Buscar folio, persona o destino" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Folio", "Viaje", "Comisionado", "Destino", "Total", "Reembolso", ""].map((t) => <th key={t} style={th}>{t}</th>)}</tr></thead>
            <tbody>{lista.map((g) => <tr key={g.id}><td style={{ ...td, fontWeight: 600 }}>{g.folio}</td><td style={td}>{fCorta(g.fecha)}</td><td style={td}>{g.persona}</td><td style={td}>{g.destino}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(g.total)}</td><td style={td}>{g.reembolso_id ? "Sí" : "Pendiente"}</td><td style={{ ...td, whiteSpace: "nowrap" }}>{!g.reembolso_id && <><button className="boton secundario" style={chico} onClick={() => editar(g)}>Editar</button> <button className="boton secundario" style={chico} onClick={() => anular(g)}>Anular</button></>}</td></tr>)}</tbody>
          </table>
          {pliegos.length > lista.length && <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 6 }}>Se muestran {lista.length}; usa la búsqueda para ver los demás.</div>}
        </div>
      )}
      {vista === "captura" && item && <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}><strong>{item.folio} precargado</strong> desde {item.fuentes}. Verifica contra el pliego físico y captura las horas. {item.deducido && <em>Importe deducido: {item.deducido}.</em>}</div>}
      {vista === "captura" && (
        <div style={dos}>
          <div style={{ ...tarjeta, display: "grid", gap: 12 }}>
            <div style={rejilla(130)}>
              <label><span style={et}>Folio</span><input style={inp} value={p.folio} onChange={pon("folio")} placeholder="FP-0000" /></label>
              <label><span style={et}>Fecha del viaje</span><input type="date" style={inp} value={p.fecha} onChange={pon("fecha")} /></label>
              <label><span style={et}>Unidad</span><input style={inp} value={p.unidad} onChange={pon("unidad")} placeholder="A-000" /></label>
            </div>
            <label><span style={et}>Comisionado (matrícula)</span>
              <select style={inp} value={p.matricula} onChange={(e) => { setMsg(null); const matricula = e.target.value; setP((x) => ({ ...x, ...sugerir(matricula), matricula })); }}><option value="">Elige…</option>{comisionados.filter((c) => c.activo || c.matricula === p.matricula).map((c) => <option key={c.matricula} value={c.matricula}>{c.matricula} · {c.nombre}</option>)}</select>
              {persona && <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>{persona.categoria} · {persona.jornada} · {persona.horario}</span>}
            </label>
            <div style={rejilla(150)}>
              <label><span style={et}>Tipo de contratación (TC del pliego)</span><select style={inp} value={p.tc} onChange={pon("tc")}><option value="">Elige…</option>{TIPOS_CONTRATACION.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}</select></label>
              {p.tc && !["02", "03", "08"].includes(p.tc) && <label><span style={et}>Grupo jerárquico</span><select style={inp} value={p.gj} onChange={pon("gj")}><option value="">Elige…</option>{GRUPOS.map((g) => <option key={g.clave} value={g.clave}>{g.nombre}</option>)}</select></label>}
              <label><span style={et}>Va como</span><select style={inp} value={p.calidad} onChange={pon("calidad")}><option value="">Elige…</option><option value="CHOFER">Chofer</option><option value="ACOMPANANTE">Acompañante</option></select></label>
              {p.calidad === "ACOMPANANTE" && <label><span style={et}>Folio del pliego del chofer</span><input style={inp} value={p.folioChofer} onChange={pon("folioChofer")} placeholder="FP-0000" /></label>}
            </div>
            {p.tc && <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: -6 }}>Tabla que se usará: {NOMBRE_TABLA[tablaDe(p.tc, p.gj)] || "falta el grupo jerárquico"}</div>}
            <label><span style={et}>Destino</span><select style={inp} value={p.destino} onChange={pon("destino")}><option value="">Elige…</option>{DESTINOS.map((x) => <option key={x.nombre} value={x.nombre}>{x.nombre}</option>)}</select></label>
            <div style={rejilla(105)}>{[["salida", "Salida"], ["llegada", "Llegada destino"], ["salidaDestino", "Salida destino"], ["regreso", "Regreso"]].map(([c, t]) => <label key={c}><span style={et}>{t}</span><input style={inp} value={p[c]} onChange={pon(c)} placeholder="hh:mm" /></label>)}</div>
            <div style={rejilla(120)}>
              <label><span style={et}>Importe a pagar</span><input style={inp} inputMode="decimal" value={p.importe} onChange={pon("importe")} /></label>
              <label><span style={et}>Casetas</span><input style={inp} inputMode="decimal" value={p.casetas} onChange={pon("casetas")} /></label>
              <label><span style={et}>Boletos de autobús</span><input style={inp} inputMode="decimal" value={p.boletos} onChange={pon("boletos")} /></label>
            </div>
            <label><span style={et}>Motivo, si el importe difiere de la cuota</span><input style={inp} value={p.motivo} onChange={pon("motivo")} /></label>
            <div style={rejilla(130)}>
              <label><span style={et}>Código infarto</span><select style={inp} value={p.infarto} onChange={pon("infarto")}><option>NO</option><option>SI</option></select></label>
              <label><span style={et}>Paciente</span><input style={inp} value={p.paciente} onChange={pon("paciente")} /></label>
              <label><span style={et}>Folio TP01</span><input style={inp} value={p.tp01} onChange={pon("tp01")} /></label>
            </div>
            <div style={rejilla(130)}>
              <label><span style={et}>Recibido en Finanzas</span><input type="date" style={inp} value={p.recibido} onChange={pon("recibido")} /></label>
              <label><span style={et}>Fecha de pago</span><input type="date" style={inp} value={p.pago} onChange={pon("pago")} /></label>
            </div>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={tarjeta}>
              <div style={titulo}>CUOTA CALCULADA</div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>{r.cuota != null ? money(r.cuota) : "—"}</div>
              <div style={{ fontSize: 13, color: "var(--texto-suave)", minHeight: 18 }}>{r.detalle || "Se calcula al elegir comisionado y destino, y capturar el regreso."}</div>
              {r.cuota != null && Number(p.importe) !== r.cuota && <button className="boton secundario" style={{ marginTop: 8, fontSize: 13 }} onClick={() => setP((x) => ({ ...x, importe: String(r.cuota), motivo: "" }))}>Usar esta cuota</button>}
              <div style={{ fontSize: 13, marginTop: 10 }}>Total del pliego: <strong>{money(r.total)}</strong></div>
            </div>
            <div style={tarjeta}>
              <div style={titulo}>FILTROS</div>
              {bloqueos.map((a) => <div key={a.t} style={{ background: "var(--rojo-claro)", color: "var(--rojo)", borderRadius: 8, padding: "7px 10px", fontSize: 13, marginBottom: 6 }}><strong>No deja guardar:</strong> {a.t}</div>)}
              {avisos.map((a) => <div key={a.t} style={{ background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "7px 10px", fontSize: 13, marginBottom: 6 }}><strong>Aviso:</strong> {a.t}</div>)}
              {contraRelacion.map((t) => <div key={t} style={{ background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "7px 10px", fontSize: 13, marginBottom: 6 }}><strong>Contra la relación:</strong> {t}</div>)}
              {ok && <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Todo cuadra.</div>}
              <button className="boton" style={{ width: "100%", marginTop: 4, opacity: r.puedeGuardar && !ocupado ? 1 : 0.5 }} disabled={!r.puedeGuardar || ocupado} onClick={guardar}>{enEdicion ? "Guardar cambios" : item ? "Confirmar llegada y guardar" : "Guardar pliego"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
