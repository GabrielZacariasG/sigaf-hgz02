"use client";
// Pernoctas, boletos, pasajes y otras cuentas (facturas).
import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { CC_PASAJES, OTRAS_CUENTAS, TIPOS_GASTO, revisarGasto } from "../../../lib/reembolsos";
import { claveGasto, gastoParaFiltro, hoyLocal, mesDeFecha, money } from "../../../lib/fondoFijo";
import { Avisos, Mensaje, chico, dos, et, fCorta, inp, rejilla, tarjeta, td, th, titulo } from "./comun";

const VACIO = { tipo: "PERNOCTA", folio: "", fecha: "", importe: "", nss: "", paciente: "", acompanante: "", destino: "", de: "", al: "", comprobante: "", matricula: "", persona: "", dias: "", cc: "", cuenta: "", proveedor: "", observaciones: "" };
const FOLIO = { PERNOCTA: "Folio TP07", BOLETO: "Folio TP07", PASAJE: "Folio TX", OTRA: "Folio de factura" };

export default function OtrosGastos({ gastos, comisionados, recargar }) {
  const [g, setG] = useState({ ...VACIO, fecha: hoyLocal() });
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState("");
  const otros = useMemo(() => gastos.filter((x) => x.tipo !== "PLIEGO" && !x.anulado), [gastos]);
  const rg = useMemo(() => revisarGasto(g, otros.map(gastoParaFiltro), hoyLocal()), [g, otros]);
  const pon = (k) => (e) => { setMsg(null); setG((x) => ({ ...x, [k]: e.target.value })); };
  const paciente = g.tipo === "PERNOCTA" || g.tipo === "BOLETO";
  const guardar = async () => {
    setOcupado(true); setMsg(null);
    const anio = Number(g.fecha.slice(0, 4)), tipo = TIPOS_GASTO[g.tipo], total = Number(g.importe);
    const fila = {
      clave: claveGasto(g.tipo, g.folio, anio, g.proveedor), tipo: g.tipo, folio: g.folio.trim(), anio, fecha: g.fecha, mes_gasto: mesDeFecha(g.fecha), importe: total, total,
      cuenta: g.cuenta || tipo.cuenta, cc: g.cc || tipo.cc, nss: g.nss || null, paciente: g.paciente || null, acompanante: g.acompanante || null, destino: g.destino || null, de: g.de || null, al: g.al || null, dias: Number(g.dias) || (rg.sugerido?.dias ?? null),
      comprobante: g.comprobante || null, matricula: g.matricula || null, persona: g.persona || null, proveedor: g.proveedor || null, observaciones: g.observaciones || null, avisos: rg.avisos.length ? rg.avisos.map((a) => a.t) : null,
    };
    const { error } = await supabase.from("ff_gastos").insert(fila);
    setOcupado(false);
    if (error) { setMsg({ error: true, t: /ux_ff_gasto_clave|duplicate/i.test(error.message) ? `El folio ${g.folio} ya está capturado.` : error.message }); return; }
    await recargar();
    setMsg({ t: `${g.folio} quedó listo para reembolso.` }); setG({ ...VACIO, tipo: g.tipo, fecha: g.fecha });
  };
  const anular = async (x) => {
    if (!window.confirm(`¿Anular ${x.folio}? Deja de contar en reembolsos y resumen.`)) return;
    const { error } = await supabase.from("ff_gastos").update({ anulado: true, clave: `${x.clave}|ANULADO|${x.id.slice(0, 4)}`, actualizado_at: new Date().toISOString() }).eq("id", x.id);
    setMsg(error ? { error: true, t: error.message } : { t: `${x.folio} anulado.` });
    if (!error) await recargar();
  };
  const lista = useMemo(() => (filtro ? otros.filter((x) => x.tipo === filtro) : otros).slice(0, 40), [otros, filtro]);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={dos}>
        <div style={{ ...tarjeta, display: "grid", gap: 12 }}>
          <label><span style={et}>Tipo de gasto</span><select style={inp} value={g.tipo} onChange={(e) => { setMsg(null); setG({ ...VACIO, tipo: e.target.value, fecha: g.fecha }); }}>{Object.entries(TIPOS_GASTO).filter(([k]) => k !== "PLIEGO").map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}</select></label>
          <div style={rejilla(130)}>
            <label><span style={et}>{FOLIO[g.tipo]}</span><input style={inp} value={g.folio} onChange={pon("folio")} /></label>
            <label><span style={et}>Fecha de pago por fondo fijo</span><input type="date" style={inp} value={g.fecha} onChange={pon("fecha")} /></label>
            <label><span style={et}>Importe</span><input style={inp} inputMode="decimal" value={g.importe} onChange={pon("importe")} /></label>
          </div>
          {paciente && <>
            <div style={rejilla(130)}><label><span style={et}>NSS</span><input style={inp} value={g.nss} onChange={pon("nss")} /></label><label><span style={et}>Paciente</span><input style={inp} value={g.paciente} onChange={pon("paciente")} /></label><label><span style={et}>Acompañante</span><input style={inp} value={g.acompanante} onChange={pon("acompanante")} /></label></div>
            <label><span style={et}>Unidad de destino</span><input style={inp} value={g.destino} onChange={pon("destino")} /></label>
            {g.tipo === "PERNOCTA" ? <div style={rejilla(130)}><label><span style={et}>Del</span><input type="date" style={inp} value={g.de} onChange={pon("de")} /></label><label><span style={et}>Al</span><input type="date" style={inp} value={g.al} onChange={pon("al")} /></label></div> : <label><span style={et}>Boleto o comprobante</span><input style={inp} value={g.comprobante} onChange={pon("comprobante")} /></label>}
            {rg.sugerido && <div style={{ fontSize: 13 }}>Referencia: {rg.sugerido.dias} día(s) × ${rg.sugerido.cuota} = <strong>{money(rg.sugerido.importe)}</strong> <button className="boton secundario" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setG((x) => ({ ...x, importe: String(rg.sugerido.importe) }))}>Usar</button></div>}
          </>}
          {g.tipo === "PASAJE" && <div style={rejilla(130)}>
            <label><span style={et}>Matrícula</span><input style={inp} list="ff-matriculas" value={g.matricula} onChange={(e) => { const c = comisionados.find((x) => x.matricula === e.target.value); setMsg(null); setG((x) => ({ ...x, matricula: e.target.value, persona: c ? c.nombre : x.persona })); }} /></label>
            <datalist id="ff-matriculas">{comisionados.map((c) => <option key={c.matricula} value={c.matricula}>{c.nombre}</option>)}</datalist>
            <label><span style={et}>Persona</span><input style={inp} value={g.persona} onChange={pon("persona")} /></label>
            <label><span style={et}>Días pagados</span><input style={inp} value={g.dias} onChange={pon("dias")} /></label>
            <label><span style={et}>Centro de costo</span><select style={inp} value={g.cc} onChange={pon("cc")}><option value="">Elige…</option>{CC_PASAJES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label><span style={et}>A dónde se trasladó</span><input style={inp} value={g.destino} onChange={pon("destino")} /></label>
          </div>}
          {g.tipo === "OTRA" && <div style={rejilla(130)}>
            <label><span style={et}>Cuenta</span><select style={inp} value={g.cuenta} onChange={(e) => { const o = OTRAS_CUENTAS.find((x) => x.cuenta === e.target.value); setMsg(null); setG((x) => ({ ...x, cuenta: e.target.value, cc: o?.cc || "" })); }}><option value="">Elige…</option>{OTRAS_CUENTAS.map((x) => <option key={x.cuenta} value={x.cuenta}>{x.cuenta} · {x.nombre}</option>)}</select></label>
            <label><span style={et}>Centro de costo</span><input style={inp} value={g.cc} onChange={pon("cc")} /></label>
            <label><span style={et}>Proveedor</span><input style={inp} value={g.proveedor} onChange={pon("proveedor")} /></label>
            <label><span style={et}>Concepto</span><input style={inp} value={g.observaciones} onChange={pon("observaciones")} /></label>
          </div>}
        </div>
        <div style={tarjeta}>
          <div style={titulo}>FILTROS</div>
          <Avisos lista={rg.avisos} />
          {!rg.avisos.length && <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Todo cuadra.</div>}
          <button className="boton" style={{ width: "100%", opacity: rg.puedeGuardar && !ocupado ? 1 : 0.5 }} disabled={!rg.puedeGuardar || ocupado} onClick={guardar}>Guardar</button>
          <Mensaje msg={msg} />
        </div>
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <div style={{ ...titulo, marginBottom: 0 }}>CAPTURADOS ({otros.length})</div>
          <select style={{ ...inp, maxWidth: 240, padding: "5px 8px", fontSize: 13 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="">Todos</option>{Object.entries(TIPOS_GASTO).filter(([k]) => k !== "PLIEGO").map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}</select>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Tipo", "Folio", "Fecha", "Detalle", "Cuenta", "CC", "Importe", "Reembolso", ""].map((t) => <th key={t} style={th}>{t}</th>)}</tr></thead>
          <tbody>{lista.map((x) => <tr key={x.id}><td style={td}>{TIPOS_GASTO[x.tipo].nombre}</td><td style={{ ...td, fontWeight: 600 }}>{x.folio}</td><td style={td}>{fCorta(x.fecha)}</td><td style={td}>{x.tipo === "OTRA" ? x.proveedor : x.tipo === "PASAJE" ? `${x.persona || ""} · ${x.dias || 0} días` : x.paciente}</td><td style={td}>{x.cuenta}</td><td style={td}>{x.cc}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(x.total)}</td><td style={td}>{x.reembolso_id ? "Sí" : "Pendiente"}</td><td style={td}>{!x.reembolso_id && <button className="boton secundario" style={chico} onClick={() => anular(x)}>Anular</button>}</td></tr>)}
            {!lista.length && <tr><td colSpan={9} style={td}>Sin capturas.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
