"use client";

// Fase 3b (29/10/2026) · Dictámenes FINAT dentro de SIGAF.
// Lista cada dictamen con lo que FINAT asigna al HGZ 2 (UI 010102), lo pagado y el disponible, y lo que tienen
// otras unidades (para oficio de apoyo). Se actualiza subiendo los PDF del IMKK036 "Rep. Disponibilidad Dictamen":
// SIGAF los lee, valida cada uno contra su renglón TOTALES y, al guardar, iguala el enlace del contrato a lo
// asignado por FINAT (renglón "Ajuste para igualar al dictamen FINAT" en Amp o red; el máximo no se toca).
// Nada se guarda hasta "Guardar".
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { resumenUI } from "../../../lib/imkk036";
import { cargarDatosDictamenes, cargarDatosVivos, contratosDelDictamen, enlaceDe as enlaceDeContrato, revisarDictamenes, guardarDictamenes, aGuardar } from "../../../lib/dictamenesCarga";
import { saldoVivo, cuadreDispo, generarSugerencias, pendientesDe, disponibleLibre } from "../../../lib/dictamenVivo";
import RevisionDictamenes from "../../../lib/RevisionDictamenes";
import { ANIO, UI_HGZ2, saldoDelMes, corteViejo, descuentoApoyos } from "../../../lib/contratos";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaTxt = (f) => (f ? new Date(String(f).slice(0, 10) + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const diasDesde = (f) => (f ? Math.floor((Date.now() - new Date(String(f).slice(0, 10) + "T00:00:00")) / 86400000) : null);
const detalleDe = (saldos = []) => [...saldos].sort((a, b) => a.ui.localeCompare(b.ui) || a.centro.localeCompare(b.centro) || a.cuenta.localeCompare(b.cuenta) || a.anio - b.anio || a.mes - b.mes);

export default function DictamenesPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [archivos, setArchivos] = useState([]);
  const [revision, setRevision] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busca, setBusca] = useState("");
  const [abierto, setAbierto] = useState(null);

  const [mov, setMov] = useState(null);

  const cargar = async () => {
    try {
      const d = await cargarDatosDictamenes(); setDatos(d);
      try { setMov(await cargarDatosVivos(d)); } catch { setMov(null); }
    } catch (e) { setError("No se pudo cargar: " + e.message); }
  };
  useEffect(() => { cargar(); }, []);

  const contratosDe = (num) => contratosDelDictamen(datos, num);
  const enlaceDe = (c) => enlaceDeContrato(datos, c);

  // Saldo al día, cuadre contra la dispo y sugerencias: se recalculan solos con cada 1043 y dispo que se carga
  const vivo = useMemo(() => {
    if (!datos || !mov) return null;
    const hoy = new Date(), porNum = {}, filasV = [];
    for (const d of datos.dictamenes) {
      const sal = datos.saldos[d.numero] || [];
      if (!sal.some((s) => s.ui === UI_HGZ2)) continue;
      const cs = contratosDelDictamen(datos, d.numero);
      const propios = cs.filter((c) => !c.ligaPasivo), base = propios.length ? propios : cs;
      const v = saldoVivo({ numero: d.numero, corte: d.corte, saldos: sal, contratos: base.flatMap((c) => [c.numero_interno, c.numero_alterno]).filter(Boolean), comprobantes: mov.comprobantes, apoyos: datos.apoyos?.[d.numero] || [], hoy });
      const ids = new Set(base.map((c) => c.id));
      const pendientes = pendientesDe(mov.facturas.filter((f) => ids.has(f.contrato_id) && !!f.es_pasivo === !propios.length), mov.ppto);
      porNum[d.numero] = v;
      filasV.push({ vivo: v, contrato: base[0]?.numero_interno || null, vigenciaFin: base[0]?.vigencia_fin || null, pendientes });
    }
    return {
      porNum,
      sugerencias: generarSugerencias(filasV, mov.detalle, hoy),
      cuadre: cuadreDispo(filasV.map((x) => x.vivo), datos.saldos, mov.detalle, mov.comprobantes),
      libre: disponibleLibre(mov.detalle, [...new Set(filasV.flatMap((x) => x.vivo.claves))], hoy),
    };
  }, [datos, mov]);

  // Lista de dictámenes cargados + los que tienen contrato pero aún no tienen IMKK036
  const filas = useMemo(() => {
    if (!datos) return [];
    const q = busca.trim().toLowerCase();
    const lista = datos.dictamenes.map((d) => {
      const sal = datos.saldos[d.numero] || [];
      const hg = resumenUI(sal, UI_HGZ2);
      const sm = saldoDelMes(sal); const viejo = corteViejo(d.corte);
      const cs = contratosDe(d.numero);
      const apoyosDesc = descuentoApoyos(datos.apoyos?.[d.numero], d.corte);
      return { d, hg, viejo, apoyosDesc, saldoMes: Math.max(0, sm.disponible - apoyosDesc), otras: sm.otras.map((o) => [o.ui, o.disponible]), otrasDisp: sm.otrasDisp, cs, enlace: cs.length === 1 && !cs[0].ligaPasivo ? enlaceDe(cs[0]) : null };
    });
    const sinCarga = [...new Set(datos.contratos.map((c) => c.dictamen_numero).filter((n) => /^\d{10}-\d{4}$/.test(n || "") && !datos.dictamenes.some((d) => d.numero === n)))]
      .map((n) => ({ sinCarga: true, d: { numero: n }, cs: contratosDe(n) }));
    return [...lista, ...sinCarga].filter((x) => !q || [x.d.numero, ...x.cs.map((c) => `${c.numero_interno} ${c.numero_alterno || ""} ${c.concepto || ""} ${c.proveedores?.razon_social || ""}`)].join(" ").toLowerCase().includes(q));
  }, [datos, busca]);

  // ---------- Revisar PDF ----------
  const revisar = async () => {
    setProcesando(true); setError(""); setOk(""); setRevision(null);
    try { setRevision(await revisarDictamenes(archivos, datos)); } catch (e) { setError("No se pudo revisar: " + e.message); }
    setProcesando(false);
  };

  // ---------- Guardar ----------
  const guardar = async () => {
    setGuardando(true); setError(""); setOk("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no iniciada.");
      const r = await guardarDictamenes(revision);
      setOk(`Listo: ${r.n} dictámenes actualizados (${r.renglones} renglones) · ${r.igualados} contratos con el enlace igual a FINAT.`);
      setRevision(null); setArchivos([]); await cargar();
    } catch (e) { setError("No se pudo guardar: " + e.message); }
    setGuardando(false);
  };

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "12px 14px" };
  const th = { textAlign: "left", fontSize: 12, padding: "6px 8px", borderBottom: "1px solid var(--borde)", color: "var(--texto-suave)", whiteSpace: "nowrap", position: "sticky", top: 0, background: "var(--blanco)" };
  const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid var(--borde)", verticalAlign: "top" };
  const tdN = { ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const nGuardar = aGuardar(revision).length;

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/contratos" style={{ color: "var(--verde)" }}>← Contratos</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Dictámenes FINAT</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 950 }}>
        Lo que FINAT asigna al HGZ 2 en cada dictamen, lo pagado y el disponible acumulado, y lo que tienen otras unidades del mismo dictamen (para oficio de apoyo).
        Para actualizar, sube los PDF del <strong>IMKK036 "Rep. Disponibilidad Dictamen"</strong> (varios a la vez). SIGAF los lee, revisa que cada uno cuadre con su renglón TOTALES
        y, al guardar, deja el enlace del contrato igual a lo que asigna FINAT. <strong>No guarda nada hasta que revises.</strong>{" "}
        También puedes subirlos junto con los demás reportes en <Link href="/comprobantes" style={{ color: "var(--verde)", fontWeight: 600 }}>Cargar reportes</Link>.
      </p>

      <div style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <input type="file" accept=".pdf" multiple onChange={(e) => { setArchivos([...(e.target.files || [])]); setRevision(null); setOk(""); setError(""); }} />
        <button className="boton" onClick={revisar} disabled={!archivos.length || procesando || guardando || !datos}>{procesando ? "Leyendo PDF…" : `Revisar ${archivos.length || ""} PDF`}</button>
      </div>
      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}
      {ok && <p style={{ color: "var(--verde)", fontSize: 14, marginTop: 12, fontWeight: 600 }}>{ok}</p>}

      {revision && (
        <div style={{ ...card, marginTop: 12, overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <strong>Revisión de {revision.length} PDF</strong>
            <button className="boton" onClick={guardar} disabled={!nGuardar || guardando}>{guardando ? "Guardando…" : `Guardar ${nGuardar} dictamen(es)`}</button>
          </div>
          <RevisionDictamenes items={revision} />
        </div>
      )}

      {!datos && !error && <p>Cargando dictámenes…</p>}
      {vivo && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
            <strong>Cuadre diario contra la dispo</strong>
            <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>Saldo de los dictámenes de {ANIO} del HGZ 2 contra el Comprometido{vivo.cuadre[0]?.fechaDispo ? ` de la dispo del ${fechaTxt(vivo.cuadre[0].fechaDispo)}` : ""}. Si cuadra, no hace falta descargar el IMKK036.</span>
          </div>
          <div style={{ overflowX: "auto", marginTop: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Centro", "Cuenta", "Saldo dictámenes", "Comprometido dispo", "Diferencia", "Qué significa"].map((h) => <th key={h} style={{ ...th, position: "static" }}>{h}</th>)}</tr></thead>
              <tbody>{vivo.cuadre.map((q) => (
                <tr key={`${q.centro}|${q.cuenta}`}>
                  <td style={td}>{q.centro}</td><td style={td}>{q.cuenta}</td>
                  <td style={tdN}>{money(q.saldo)}</td><td style={tdN}>{money(q.comprometido)}</td>
                  <td style={{ ...tdN, fontWeight: 700, color: q.estado === "ok" ? "var(--verde)" : q.estado === "espera" ? "#b7791f" : "var(--rojo)" }}>{money(q.diferencia)}</td>
                  <td style={{ ...td, fontSize: 12.5 }}>{q.texto}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {vivo.libre.length > 0 && <div style={{ fontSize: 12.5, marginTop: 8 }}><strong>Disponible libre:</strong> {vivo.libre.map((o) => `${o.cuenta} (CC ${o.centro}): ${money(o.total)}`).join(" · ")}. La CPIP puede reducir lo no comprometido (Norma 7.5.18.5).</div>}
        </div>
      )}

      {datos && (
        <div style={{ ...card, marginTop: 12, padding: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", flexWrap: "wrap" }}>
            <strong>{filas.filter((x) => !x.sinCarga).length} dictámenes cargados</strong>
            {filas.some((x) => x.sinCarga) && <span style={{ color: "#b7791f", fontSize: 13 }}>· {filas.filter((x) => x.sinCarga).length} con contrato pero sin IMKK036</span>}
            <input placeholder="Buscar dictamen, contrato, proveedor…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--borde)", minWidth: 240 }} />
          </div>
          <div style={{ overflow: "auto", maxHeight: "calc(100vh - 330px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Dictamen", "Contrato", "Proveedor / concepto", "Corte FINAT", "Asignado HGZ 2", "Gasto HGZ 2", "Disponible acumulado HGZ 2", "Saldo al día", "Pendiente", "Disponible acumulado otras unidades", "Enlace SIGAF"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{filas.map((x) => {
                const k = x.d.numero; const sel = abierto === k; const dias = diasDesde(x.d.corte);
                const v = vivo?.porNum[k], su = vivo?.sugerencias[k];
                return (
                  <Fragment key={k}>
                    <tr onClick={() => !x.sinCarga && setAbierto(sel ? null : k)} style={{ cursor: x.sinCarga ? "default" : "pointer", background: sel ? "#fff7d6" : undefined }}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{k}{x.d.origen ? <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}> {x.d.origen}</span> : ""}</td>
                      <td style={td}>{x.cs.map((c) => c.numero_interno + (c.ligaPasivo ? " (pasivo)" : "")).join(", ") || <span style={{ color: "var(--texto-suave)" }}>sin contrato</span>}</td>
                      <td style={{ ...td, maxWidth: 320 }}>{x.cs[0]?.proveedores?.razon_social || ""}<div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{x.cs[0]?.concepto || ""}</div></td>
                      {x.sinCarga ? <td colSpan={8} style={{ ...td, color: "#b7791f" }}>Sin IMKK036: córrelo en FINAT (control SALDO_DICT) y súbelo aquí</td> : <>
                        <td style={{ ...td, whiteSpace: "nowrap", color: dias > 7 ? "#b7791f" : undefined }} title={dias > 7 ? `Hace ${dias} días: conviene actualizarlo` : ""}>{fechaTxt(x.d.corte)}</td>
                        <td style={tdN}>{money(x.hg.asignado)}</td><td style={tdN}>{money(x.hg.pagado)}</td>
                        <td style={{ ...tdN, fontWeight: 700, color: x.viejo ? "#b7791f" : x.saldoMes < 0.5 ? "var(--rojo)" : "var(--verde)" }} title={x.viejo ? "El IMKK036 cargado es de un mes anterior" : ""}>{x.viejo ? "Falta IMKK036 del mes" : money(x.saldoMes)}</td>
                        <td style={{ ...tdN, fontWeight: 700, color: !v ? undefined : v.saldoHoy < 0.5 ? "var(--rojo)" : "var(--verde)" }} title={v?.gastoPosterior ? `Ya descuenta ${money(v.gastoPosterior)} de CR validados después del corte` : ""}>{v ? money(v.saldoHoy) : ""}</td>
                        <td style={{ ...tdN, color: su?.faltante > 0.5 ? "var(--rojo)" : undefined, fontWeight: su?.faltante > 0.5 ? 700 : 400 }} title={su?.faltante > 0.5 ? `Faltan ${money(su.faltante)} para las facturas pendientes` : ""}>{su?.pendiente ? money(su.pendiente) : su?.avisos.length ? "⚠" : ""}</td>
                        <td style={tdN}>{!x.viejo && x.otrasDisp ? money(x.otrasDisp) : ""}</td>
                        <td style={{ ...tdN, color: x.enlace != null && Math.abs(x.enlace - x.hg.asignado) > 0.5 && Number(k.slice(-4)) === ANIO ? "#b7791f" : undefined }}
                          title={x.enlace != null && Math.abs(x.enlace - x.hg.asignado) > 0.5 && Number(k.slice(-4)) === ANIO ? "Distinto a lo asignado por FINAT" : ""}>{x.enlace != null ? money(x.enlace) : ""}</td>
                      </>}
                    </tr>
                    {sel && (
                      <tr><td colSpan={11} style={{ ...td, background: "#f7f8f7" }}>
                        <div style={{ fontSize: 12.5, marginBottom: 4 }}>Fecha del dictamen {fechaTxt(x.d.fecha_dictamen)} · archivo {x.d.archivo} · total del dictamen {money(x.d.total_definitivo)}, pagado {money(x.d.total_pagos)}, disponible {money(x.d.total_disponible)}</div>
                        {x.apoyosDesc > 0 && <div style={{ fontSize: 12.5 }}>El saldo ya descuenta {money(x.apoyosDesc)} de apoyos que dimos a otras unidades.</div>}
                        {!x.viejo && x.otras.length > 0 && <div style={{ fontSize: 12.5 }}>Disponible acumulado por unidad (oficio de apoyo): {x.otras.map(([ui, v]) => `UI ${ui} ${money(v)}`).join(" · ")}</div>}
                        {v && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, margin: "10px 0" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Saldo al día</div>
                              <div style={{ fontSize: 12.5 }}>Disponible Acum del PDF: {money(v.saldoPdf)}</div>
                              {v.aplicados.length > 0 && <div style={{ fontSize: 12.5 }}>CR válidos después del corte: −{money(v.gastoPosterior)} ({v.aplicados.map((l) => `${l.cbte} ${l.factura_txt || ""}`.trim()).join("; ")})</div>}
                              {v.apoyosDesc > 0 && <div style={{ fontSize: 12.5 }}>Apoyos dados a otras unidades: −{money(v.apoyosDesc)}</div>}
                              <div style={{ fontSize: 13, fontWeight: 700 }}>Saldo al día: {money(v.saldoHoy)}</div>
                              {v.mismoDia.length > 0 && <div style={{ fontSize: 12, color: "#b7791f" }}>Del mismo día del corte, ya en el PDF: {v.mismoDia.map((l) => l.cbte).join(", ")}</div>}
                              <div style={{ fontSize: 12.5, marginTop: 6 }}><strong>Meses siguientes (Disponible del PDF):</strong> {v.futuros.length ? v.futuros.map((m) => `${m.nombre} ${money(m.disponible)}`).join(" · ") : "sin importe"}</div>
                              {v.ritmo > 0.5 && <div style={{ fontSize: 12.5 }}>Gasto promedio de los últimos 3 meses: {money(v.ritmo)}</div>}
                              <div style={{ fontSize: 12.5, marginTop: 6 }}><strong>Ajuste Post:</strong> {v.ajustes.tipo}{v.ajustes.movimientos ? ` · neto ${money(v.ajustes.neto)} (${(v.ajustes.pct * 100).toFixed(2)}% del Previo; tope 20%)` : ""}</div>
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Qué se puede hacer</div>
                              {su?.pendiente > 0 && <div style={{ fontSize: 12.5 }}>Facturas pendientes de validar o en error: {money(su.pendiente)}. {su.faltante > 0.5 ? <strong style={{ color: "var(--rojo)" }}>Faltan {money(su.faltante)}.</strong> : "El saldo alcanza."}</div>}
                              {su?.pasos.map((p, i) => (
                                <div key={i} style={{ fontSize: 12.5, marginTop: 6, paddingLeft: 8, borderLeft: `3px solid ${p.tipo === "caoa" ? "var(--rojo)" : "var(--verde)"}` }}>
                                  <strong>{i + 1}. {p.titulo}: {money(p.importe)}</strong>
                                  <div>{p.detalle}</div>
                                  <div style={{ color: "var(--texto-suave)" }}>Quién: {p.quien} · Tarda: {p.tarda}</div>
                                  <div style={{ color: "var(--texto-suave)" }}>Requiere: {p.requiere} ({p.base})</div>
                                </div>
                              ))}
                              {su?.avisos.map((t, i) => <div key={i} style={{ fontSize: 12.5, color: "#b7791f", marginTop: 6 }}>{t}</div>)}
                              {su && !su.pasos.length && !su.avisos.length && !su.pendiente && <div style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>Sin movimiento sugerido.</div>}
                            </div>
                          </div>
                        )}
                        {/* Detalle de saldos tal cual el PDF IMKK036 (los pagos se guardan en positivo; aquí van con su signo del PDF) */}
                        <div style={{ fontSize: 12.5, fontWeight: 600, margin: "8px 0 4px" }}>Detalle de saldos del IMKK036 (corte {fechaTxt(x.d.corte)})</div>
                        <div style={{ overflow: "auto", maxHeight: 360, background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 8 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead><tr>{["U. Inf.", "Centro", "Cuenta", "Periodo", "Previo", "Ajuste previo", "Ajuste post", "Definitivo", "Pagos", "(n)", "Disponible", "Disponible acum."].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                            <tbody>{detalleDe(datos.saldos[k]).map((s) => (
                              <tr key={`${s.ui}|${s.centro}|${s.cuenta}|${s.anio}|${s.mes}`} style={{ background: s.ui === UI_HGZ2 ? "#eaf4ef" : undefined }}>
                                <td style={td}>{s.ui}</td><td style={td}>{s.centro}</td><td style={td}>{s.cuenta}</td>
                                <td style={{ ...td, whiteSpace: "nowrap" }}>{s.anio}M{String(s.mes).padStart(2, "0")}</td>
                                <td style={tdN}>{money(s.previo)}</td><td style={tdN}>{money(s.ajuste_previo)}</td><td style={tdN}>{money(s.ajuste_post)}</td>
                                <td style={tdN}>{money(s.definitivo)}</td><td style={tdN}>{money(-(Number(s.pagos) || 0))}</td><td style={tdN}>{s.cant_pagos ?? ""}</td>
                                <td style={tdN}>{money(s.disponible)}</td><td style={tdN}>{money(s.disponible_acum)}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
