"use client";
// Reembolsos enviados a OOAD: su CR, su estado de pago y lo que no cuadra con los comprobantes cargados.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { armarReembolso } from "../../../lib/reembolsos";
import { gastoParaReembolso, leerTodo, ligarComprobantes, money } from "../../../lib/fondoFijo";
import { Mensaje, chico, fCorta, inp, tarjeta, td, th } from "./comun";
import Formatos from "./Formatos";
import { folioOficio } from "./Reembolsos";

const PAGO = { P: "Pagado", N: "Sin pagar", X: "Cancelado" };

export default function Enviados({ gastos, reembolsos, recargar }) {
  const [comps, setComps] = useState([]);
  const [msg, setMsg] = useState(null);
  const [formato, setFormato] = useState(null);
  const [busca, setBusca] = useState("");
  const [cancelados, setCancelados] = useState(false);
  useEffect(() => { leerTodo(() => supabase.from("comprobantes_ooad").select("cbte, factura_txt, importe, estado_entrada, estado_pago, fecha_prog_pago, fecha_emision").ilike("no_proveedor", "%49051").order("cbte").order("linea")).then(setComps).catch((e) => setMsg({ error: true, t: e.message })); }, []);
  const ligas = useMemo(() => ligarComprobantes(reembolsos, comps), [reembolsos, comps]);
  const lista = useMemo(() => {
    const k = busca.trim().toUpperCase();
    return [...reembolsos].reverse().filter((r) => (cancelados || r.estatus !== "cancelado") && (!k || `${r.solicitud} ${r.cr || ""}`.toUpperCase().includes(k)));
  }, [reembolsos, busca, cancelados]);
  const verFormatos = (r) => {
    const suyos = gastos.filter((g) => g.reembolso_id === r.id && !g.anulado).map((g) => ({ ...gastoParaReembolso(g), reembolso: null }));
    setFormato({ r, datos: armarReembolso(suyos, { numero: r.numero, anio: r.anio, fecha: r.fecha, acumuladoAnterior: r.acumulado_anterior }) });
  };
  const guardarCR = async (r, cbte) => {
    const { error } = await supabase.from("ff_reembolsos").update({ cr: cbte }).eq("id", r.id);
    setMsg(error ? { error: true, t: error.message } : { t: `${r.solicitud} ligado al CR ${cbte}.` });
    if (!error) await recargar();
  };
  const cancelar = async (r) => {
    if (!window.confirm(`¿Cancelar ${r.solicitud}? Sus comprobantes vuelven a quedar por reembolsar.`)) return;
    const { error } = await supabase.rpc("ff_cancelar_reembolso", { p_id: r.id });
    setMsg(error ? { error: true, t: error.message } : { t: `${r.solicitud} cancelado.` });
    if (!error) await recargar();
  };
  if (formato) return <Formatos reembolso={formato.datos} folio={formato.r.folio_oficio || folioOficio(formato.r.numero, formato.r.anio)} acciones={<><button className="boton secundario" onClick={() => setFormato(null)}>← Volver</button><button className="boton secundario" onClick={() => window.print()}>Imprimir / Guardar PDF</button></>} />;
  return (
    <div style={{ ...tarjeta, overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <input style={{ ...inp, maxWidth: 260 }} placeholder="Buscar solicitud o CR" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={cancelados} onChange={(e) => setCancelados(e.target.checked)} /> Ver cancelados</label>
        <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>El estado sale de los comprobantes cargados en "Cargar reportes"; hoy hay {new Set(comps.map((c) => c.cbte)).size}.</span>
      </div>
      <Mensaje msg={msg} />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Solicitud", "Fecha", "Compr.", "Total", "CR", "Pago", "Observación", ""].map((t) => <th key={t} style={th}>{t}</th>)}</tr></thead>
        <tbody>
          {lista.map((r) => {
            const c = ligas.get(r.id);
            const notas = [...(c?.avisos || [])];
            if (r.total_excel != null && Number(r.total_excel) && Math.abs(Number(r.total_excel) - Number(r.total)) > 0.01) notas.push(`El Excel decía ${money(r.total_excel)}.`);
            return (
              <tr key={r.id} style={{ opacity: r.estatus === "cancelado" ? 0.55 : 1 }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.solicitud}{c?.texto && <div style={{ fontSize: 11, fontWeight: 400, color: "var(--texto-suave)" }}>{c.texto}</div>}</td>
                <td style={td}>{fCorta(r.fecha)}</td><td style={td}>{r.comprobantes}</td><td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(r.total)}</td>
                <td style={td}>{r.cr || (c ? <span>{c.cbte} <span style={{ fontSize: 11, color: "var(--texto-suave)" }}>(sin guardar)</span></span> : r.estatus === "cancelado" ? "—" : <span style={{ color: "#92400e" }}>Esperando</span>)}</td>
                <td style={td}>{c ? PAGO[c.pago] || c.pago || "—" : "—"}{c?.programado && c.pago !== "P" && <div style={{ fontSize: 11, color: "var(--texto-suave)" }}>Prog. {fCorta(c.programado)}</div>}</td>
                <td style={{ ...td, color: notas.length ? "#92400e" : "inherit" }}>{notas.join(" ") || "—"}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {r.numero != null && r.estatus !== "cancelado" && r.origen === "sigaf" && <button className="boton secundario" style={chico} onClick={() => verFormatos(r)}>Formatos</button>}{" "}
                  {c?.nuevo && !r.cr && <button className="boton secundario" style={chico} onClick={() => guardarCR(r, c.cbte)}>Guardar CR</button>}{" "}
                  {r.estatus !== "cancelado" && r.origen === "sigaf" && <button className="boton secundario" style={chico} onClick={() => cancelar(r)}>Cancelar</button>}
                </td>
              </tr>
            );
          })}
          {!lista.length && <tr><td colSpan={8} style={td}>No hay reembolsos.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
