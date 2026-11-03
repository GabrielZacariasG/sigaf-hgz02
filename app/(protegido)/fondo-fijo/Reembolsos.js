"use client";
// Armar un reembolso: elegir comprobantes, ver oficio y Relación de Gastos, y registrar el envío a OOAD.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { TIPOS_GASTO, armarReembolso } from "../../../lib/reembolsos";
import { gastoParaReembolso, hoyLocal, money } from "../../../lib/fondoFijo";
import { Avisos, Mensaje, et, fCorta, inp, rejilla, tarjeta, td, th, titulo, dos } from "./comun";
import Formatos from "./Formatos";

const detalle = (g) => (g.tipo === "PLIEGO" ? `${g.persona} · ${g.destino}` : g.tipo === "OTRA" ? g.proveedor : g.tipo === "PASAJE" ? `${g.persona || ""} · ${g.dias || 0} días` : g.paciente);
export const folioOficio = (numero, anio) => `SIGAF-RG-${String(numero).padStart(4, "0")}/${anio}`;

export default function Reembolsos({ gastos, reembolsos, recargar }) {
  const hoy = hoyLocal(), anio = hoy.slice(0, 4);
  const vivos = reembolsos.filter((r) => r.estatus !== "cancelado");
  const usados = vivos.filter((r) => r.serie === "CD" && r.numero != null).map((r) => `${r.numero}/${r.anio}`);
  const sigue = Math.max(0, ...vivos.filter((r) => r.serie === "CD" && String(r.anio) === anio).map((r) => r.numero || 0)) + 1;
  // Acumulado: el del último reembolso emitido más su total; sin ninguno, la suma de lo cargado.
  const ultimo = [...vivos].reverse().find((r) => r.origen === "sigaf");
  const acumuladoBase = ultimo ? Number(ultimo.acumulado_anterior) + Number(ultimo.total) : vivos.reduce((s, r) => s + Number(r.total), 0);
  const [sel, setSel] = useState({});
  const [numero, setNumero] = useState(String(sigue));
  const [acumulado, setAcumulado] = useState(String(Math.round(acumuladoBase * 100) / 100));
  const [ver, setVer] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState("V");
  useEffect(() => { setNumero(String(sigue)); setAcumulado(String(Math.round(acumuladoBase * 100) / 100)); }, [sigue, acumuladoBase]);
  const pendientes = useMemo(() => gastos.filter((g) => !g.reembolso_id && !g.anulado).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))), [gastos]);
  const visibles = pendientes.filter((g) => TIPOS_GASTO[g.tipo].prefijo === filtro);
  const elegidos = pendientes.filter((g) => sel[g.id]);
  const r = useMemo(() => armarReembolso(elegidos.map(gastoParaReembolso), { numero: Number(numero) || "", anio, fecha: hoy, acumuladoAnterior: Number(acumulado) || 0, usados }), [elegidos, numero, anio, hoy, acumulado, usados]);
  const folio = folioOficio(numero, anio);
  const confirmar = async () => {
    setOcupado(true); setMsg(null);
    const { error } = await supabase.rpc("ff_crear_reembolso", { p: { solicitud: r.solicitud, numero: Number(numero), anio: Number(anio), prefijo: r.prefijo, folio_oficio: folio, fecha: hoy, periodo_de: r.periodoDe, periodo_al: r.periodoAl, total: r.total, acumulado_anterior: Number(acumulado) || 0 }, p_gastos: elegidos.map((g) => g.id) });
    setOcupado(false);
    if (error) { setMsg({ error: true, t: /ff_reembolsos_solicitud|ux_ff_reembolso|duplicate/i.test(error.message) ? `La solicitud ${r.solicitud} ya existe.` : error.message }); return; }
    setSel({}); setVer(false); setMsg({ t: `${r.solicitud} registrado; queda esperando su CR en "Enviados a OOAD".` });
    await recargar();
  };
  if (ver) return <Formatos reembolso={r} folio={folio} acciones={<>
    <button className="boton secundario" onClick={() => setVer(false)}>← Volver</button>
    <button className="boton secundario" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
    <button className="boton" disabled={ocupado} onClick={confirmar}>Registrar envío a OOAD</button>
    <Mensaje msg={msg} />
  </>} />;
  return (
    <div style={dos}>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <div style={{ ...titulo, marginBottom: 0 }}>POR REEMBOLSAR</div>
          <select style={{ ...inp, maxWidth: 200, padding: "5px 8px", fontSize: 13 }} value={filtro} onChange={(e) => { setFiltro(e.target.value); setSel({}); }}><option value="V">Viáticos (pliegos)</option><option value="T">Traslados</option><option value="O">Otras y pasajes</option></select>
          <button className="boton secundario" style={{ padding: "5px 10px", fontSize: 13 }} onClick={() => setSel(Object.fromEntries(visibles.map((g) => [g.id, true])))}>Todos</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["", "Tipo", "Folio", "Fecha", "Detalle", "Importe"].map((t) => <th key={t} style={th}>{t}</th>)}</tr></thead>
          <tbody>{visibles.map((g) => <tr key={g.id}><td style={td}><input type="checkbox" aria-label={`Elegir ${g.folio}`} checked={!!sel[g.id]} onChange={() => { setMsg(null); setSel((s) => ({ ...s, [g.id]: !s[g.id] })); }} /></td><td style={td}>{TIPOS_GASTO[g.tipo].nombre}</td><td style={{ ...td, fontWeight: 600 }}>{g.folio}</td><td style={td}>{fCorta(g.fecha)}</td><td style={td}>{detalle(g)}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(g.total)}</td></tr>)}
            {!visibles.length && <tr><td colSpan={6} style={td}>No hay comprobantes por reembolsar de este tipo.</td></tr>}</tbody>
        </table>
      </div>
      <div style={tarjeta}>
        <div style={titulo}>REEMBOLSO</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{money(r.total)}</div>
        <div style={{ fontSize: 13, color: "var(--texto-suave)", marginBottom: 10 }}>{r.comprobantes} comprobante(s){r.periodoDe ? ` · ${fCorta(r.periodoDe)} al ${fCorta(r.periodoAl)}` : ""}</div>
        <div style={rejilla(120)}>
          <label><span style={et}>Número de solicitud (CD)</span><input style={inp} value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))} /></label>
          <label><span style={et}>Acumulado anterior</span><input style={inp} inputMode="decimal" value={acumulado} onChange={(e) => setAcumulado(e.target.value)} /></label>
        </div>
        <div style={{ marginTop: 10 }}><Avisos lista={r.avisos} verbo="No deja seguir" /></div>
        <button className="boton" style={{ width: "100%", opacity: r.puedeGenerar ? 1 : 0.5 }} disabled={!r.puedeGenerar} onClick={() => setVer(true)}>Ver oficio y Relación de Gastos</button>
        <Mensaje msg={msg} />
      </div>
    </div>
  );
}
