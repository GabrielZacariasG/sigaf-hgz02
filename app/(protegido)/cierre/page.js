"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const TOL = 1.0; // tolerancia de cuadre ($1)

// --- Parseo del reporte FINAT IMKK022 (CSV). Suma GASTO/DISPONIBLE por cuenta. ---
function parseDispo(texto) {
  const lineas = texto.split(/\r?\n/);
  let fecha = null;
  const mFecha = texto.match(/Fecha Ejec:\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (mFecha) fecha = `${mFecha[3]}-${mFecha[2]}-${mFecha[1]}`;
  const hi = lineas.findIndex((l) => /^Cuenta,/i.test(l));
  if (hi < 0) return { fecha, cuentas: null, error: "No se encontró el encabezado 'Cuenta,...' — ¿es el reporte IMKK022?" };
  const agg = new Map();
  for (let i = hi + 1; i < lineas.length; i++) {
    const c = lineas[i].split(",");
    if (c.length < 11) continue;
    const cta = (c[0] || "").trim();
    if (!/^\d+$/.test(cta)) continue;
    const o = agg.get(cta) || { cuenta_finat: cta, presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 };
    o.presupuesto += Number(c[6]) || 0;
    o.gasto += Number(c[7]) || 0;
    o.comprometido += Number(c[8]) || 0;
    o.precomprometido += Number(c[9]) || 0;
    o.disponible += Number(c[10]) || 0;
    agg.set(cta, o);
  }
  return { fecha, cuentas: [...agg.values()], error: null };
}

export default function CierrePage() {
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [fecha, setFecha] = useState("");        // fecha de la dispo subida
  const [fechaPrev, setFechaPrev] = useState(""); // fecha anterior comparada
  const [movs, setMovs] = useState([]);          // [{cuenta, nombre, capitulo, gastoPrev, gastoHoy, delta}]
  const [partidasMap, setPartidasMap] = useState({});
  const [abierto, setAbierto] = useState(null);  // cuenta expandida
  const [facs, setFacs] = useState({});          // cuenta -> facturas candidatas | "load"
  const [sel, setSel] = useState(() => new Set());
  const [crMap, setCrMap] = useState({});        // factura_id -> CR capturado
  const [aplicando, setAplicando] = useState(false);

  // Catálogo de partidas para nombrar cuentas.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("partidas").select("cuenta_finat, nombre, capitulos ( nombre )");
      const m = {};
      (data || []).forEach((p) => { if (p.cuenta_finat) m[p.cuenta_finat] = { nombre: p.nombre, capitulo: p.capitulos?.nombre }; });
      setPartidasMap(m);
    })();
  }, []);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMensaje(""); setMovs([]); setAbierto(null); setSubiendo(true);
    try {
      const texto = await file.text();
      const { fecha: f, cuentas, error } = parseDispo(texto);
      if (error) { setMensaje(error); setSubiendo(false); return; }
      if (!f) { setMensaje("No pude leer la fecha del reporte (línea 'Fecha Ejec:'). Verifica el archivo."); setSubiendo(false); return; }
      // 1) Guardar la foto del día (upsert)
      const filas = cuentas.map((c) => ({ fecha: f, ...c }));
      const { error: eUp } = await supabase.from("disponibilidad_diaria").upsert(filas, { onConflict: "fecha,cuenta_finat" });
      if (eUp) { setMensaje("No se pudo guardar la foto del día: " + eUp.message); setSubiendo(false); return; }
      setFecha(f);
      // Si esta dispo es la MÁS RECIENTE, también actualiza el módulo de
      // Disponibilidad presupuestal (misma agregación) para no cargar dos veces.
      const { data: maxRows } = await supabase.from("disponibilidad_diaria").select("fecha").order("fecha", { ascending: false }).limit(1);
      if ((maxRows?.[0]?.fecha || f) <= f) {
        const payloadPres = cuentas.map((c) => ({
          cuenta_prei: c.cuenta_finat, periodo: "2026",
          presupuesto: c.presupuesto, gasto: c.gasto, comprometido: c.comprometido,
          precomprometido: c.precomprometido, disponible: c.disponible, actualizado_at: new Date().toISOString(),
        }));
        await supabase.from("disponibilidad_presupuestal").upsert(payloadPres, { onConflict: "cuenta_prei,periodo" });
      }
      // 2) Buscar la foto anterior (fecha < f)
      const { data: prevRows } = await supabase.from("disponibilidad_diaria").select("fecha").lt("fecha", f).order("fecha", { ascending: false }).limit(1);
      const fp = prevRows?.[0]?.fecha || null;
      setFechaPrev(fp || "");
      if (!fp) { setMensaje("Foto guardada. Aún no hay un día anterior para comparar — sube la del día siguiente para ver los movimientos."); setSubiendo(false); return; }
      const { data: prevData } = await supabase.from("disponibilidad_diaria").select("cuenta_finat, gasto").eq("fecha", fp);
      const prevMap = {}; (prevData || []).forEach((r) => (prevMap[r.cuenta_finat] = Number(r.gasto) || 0));
      // 3) Variación de GASTO por cuenta
      const lista = [];
      for (const c of cuentas) {
        const gp = prevMap[c.cuenta_finat] ?? 0;
        const d = Math.round((c.gasto - gp) * 100) / 100;
        if (Math.abs(d) >= 0.01) lista.push({ cuenta: c.cuenta_finat, gastoPrev: gp, gastoHoy: c.gasto, delta: d });
      }
      lista.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      setMovs(lista);
      if (lista.length === 0) setMensaje("Foto guardada. No hubo movimientos de gasto respecto al " + fp + ".");
    } catch (err) {
      setMensaje("Error al procesar el archivo: " + err.message);
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  }

  async function abrirCuenta(mov) {
    if (abierto === mov.cuenta) { setAbierto(null); return; }
    setAbierto(mov.cuenta); setSel(new Set()); setCrMap({});
    if (facs[mov.cuenta] == null) {
      setFacs((p) => ({ ...p, [mov.cuenta]: "load" }));
      const pago = mov.delta > 0;
      const estados = pago ? ["enviada_ooad", "en_tramite_ooad"] : ["gasto_reflejado"];
      const { data } = await supabase
        .from("facturas")
        .select("id, folio_ingreso, folio_proveedor, importe_factura, estatus_general, cr_contrarecibo, fecha_pago, proveedores ( razon_social ), partidas!inner ( cuenta_finat )")
        .eq("partidas.cuenta_finat", mov.cuenta)
        .in("estatus_general", estados)
        .neq("anulada", true);
      setFacs((p) => ({ ...p, [mov.cuenta]: data || [] }));
    }
  }

  function toggle(id) { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function aplicar(mov) {
    const pago = mov.delta > 0;
    const ids = [...sel];
    if (ids.length === 0) { setMensaje("Selecciona al menos una factura."); return; }
    setAplicando(true); setMensaje("");
    try {
      if (pago) {
        for (const id of ids) {
          const patch = { estatus_general: "gasto_reflejado", fecha_pago: fecha };
          const cr = (crMap[id] || "").trim();
          if (cr) patch.cr_contrarecibo = cr;
          const { error } = await supabase.from("facturas").update(patch).eq("id", id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("facturas").update({ estatus_general: "en_tramite_ooad", fecha_pago: null }).in("id", ids);
        if (error) throw error;
      }
      setMensaje(`✅ ${ids.length} factura(s) ${pago ? "marcadas como gasto reflejado" : "revertidas a en trámite"}.`);
      // recargar las facturas de la cuenta
      setSel(new Set()); setCrMap({});
      const estados = pago ? ["enviada_ooad", "en_tramite_ooad"] : ["gasto_reflejado"];
      const { data } = await supabase.from("facturas")
        .select("id, folio_ingreso, folio_proveedor, importe_factura, estatus_general, cr_contrarecibo, fecha_pago, proveedores ( razon_social ), partidas!inner ( cuenta_finat )")
        .eq("partidas.cuenta_finat", mov.cuenta).in("estatus_general", estados).neq("anulada", true);
      setFacs((p) => ({ ...p, [mov.cuenta]: data || [] }));
    } catch (err) {
      setMensaje("No se pudo aplicar: " + err.message);
    } finally {
      setAplicando(false);
    }
  }

  const resumen = useMemo(() => {
    let inc = 0, dec = 0, sInc = 0, sDec = 0;
    movs.forEach((m) => { if (m.delta > 0) { inc++; sInc += m.delta; } else { dec++; sDec += m.delta; } });
    return { inc, dec, sInc, sDec, neto: sInc + sDec };
  }, [movs]);

  const sumaSel = useMemo(() => {
    if (!abierto || !Array.isArray(facs[abierto])) return 0;
    return facs[abierto].filter((f) => sel.has(f.id)).reduce((s, f) => s + (Number(f.importe_factura) || 0), 0);
  }, [abierto, facs, sel]);

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px" };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13.5, verticalAlign: "middle" };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Cierre por disponibilidad</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 4 }}>
        Sube la disponibilidad del día (reporte FINAT IMKK022). SIGAF la compara con el día anterior y te muestra, por cuenta, dónde <strong>subió el gasto</strong> (se pagó) o <strong>bajó</strong> (se canceló un CR), y te sugiere las facturas que lo explican. Tú capturas el contra‑recibo y confirmas.
      </p>

      {/* Cargar */}
      <div style={{ ...card, marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <label className="boton" style={{ cursor: "pointer" }}>
          {subiendo ? "Procesando…" : "＋ Subir disponibilidad (CSV)"}
          <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={subiendo} style={{ display: "none" }} />
        </label>
        {fecha && <div style={{ fontSize: 13 }}>Foto del <strong>{fecha}</strong>{fechaPrev ? <> · comparada contra <strong>{fechaPrev}</strong></> : ""}</div>}
      </div>

      {mensaje && <p style={{ fontSize: 13, color: mensaje.startsWith("✅") ? "var(--verde-oscuro)" : "var(--rojo)", marginTop: 10 }}>{mensaje}</p>}

      {/* Resumen */}
      {movs.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ ...card, flex: 1, minWidth: 170 }}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Con pago (gasto ↑)</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--verde-oscuro)" }}>{resumen.inc}</div><div style={{ fontSize: 12 }}>{money(resumen.sInc)}</div></div>
          <div style={{ ...card, flex: 1, minWidth: 170 }}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Con reversa (gasto ↓)</div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--rojo)" }}>{resumen.dec}</div><div style={{ fontSize: 12 }}>{money(resumen.sDec)}</div></div>
          <div style={{ ...card, flex: 1, minWidth: 170 }}><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Variación neta</div><div style={{ fontSize: 20, fontWeight: 800 }}>{money(resumen.neto)}</div></div>
        </div>
      )}

      {/* Movimientos por cuenta */}
      {movs.length > 0 && (
        <div style={{ ...card, marginTop: 14, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Cuenta</th><th style={th}>Capítulo</th>
                <th style={{ ...th, textAlign: "right" }}>Gasto {fechaPrev}</th>
                <th style={{ ...th, textAlign: "right" }}>Gasto {fecha}</th>
                <th style={{ ...th, textAlign: "right" }}>Movimiento</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {movs.map((m) => {
                  const nom = partidasMap[m.cuenta];
                  const pago = m.delta > 0;
                  return (
                    <Fragment key={m.cuenta}>
                      <tr style={{ cursor: "pointer", background: abierto === m.cuenta ? "var(--fondo)" : undefined }} onClick={() => abrirCuenta(m)}>
                        <td style={{ ...td, fontWeight: 600 }}>{m.cuenta}<div style={{ fontSize: 11, color: "var(--texto-suave)", fontWeight: 400 }}>{nom?.nombre || "—"}</div></td>
                        <td style={{ ...td, fontSize: 12 }}>{nom?.capitulo || "—"}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(m.gastoPrev)}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(m.gastoHoy)}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: pago ? "var(--verde-oscuro)" : "var(--rojo)" }}>{pago ? "▲ " : "▼ "}{money(m.delta)}</td>
                        <td style={{ ...td, fontSize: 12, color: "var(--verde)" }}>{abierto === m.cuenta ? "Cerrar" : "Ver facturas"}</td>
                      </tr>
                      {abierto === m.cuenta && (
                        <tr>
                          <td style={{ ...td, background: "var(--fondo)" }} colSpan={6}>
                            {facs[m.cuenta] === "load" || facs[m.cuenta] == null ? (
                              <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>Cargando facturas…</div>
                            ) : facs[m.cuenta].length === 0 ? (
                              <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
                                No hay facturas {pago ? "pendientes de pago (enviadas/en trámite)" : "con gasto reflejado"} en esta cuenta.
                                {pago && " (Puede ser una cuenta que SIGAF no factura, o falta enviarlas a OOAD.)"}
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontSize: 13, marginBottom: 8 }}>
                                  {pago ? "Marca las facturas que suman el pago del día:" : "Marca las facturas a revertir (se canceló su CR):"}
                                  {" "}<strong>Seleccionado: {money(sumaSel)}</strong> / Movimiento {money(Math.abs(m.delta))}{" "}
                                  {Math.abs(sumaSel - Math.abs(m.delta)) <= TOL ? <span style={{ color: "var(--verde-oscuro)", fontWeight: 700 }}>✓ cuadra</span> : <span style={{ color: "var(--texto-suave)" }}>(dif. {money(sumaSel - Math.abs(m.delta))})</span>}
                                </div>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <thead><tr>
                                    <th style={th}></th><th style={th}>Folio ingreso</th><th style={th}>Proveedor</th>
                                    <th style={{ ...th, textAlign: "right" }}>Importe</th><th style={th}>Estatus</th>
                                    {pago && <th style={th}>Contra‑recibo</th>}
                                  </tr></thead>
                                  <tbody>
                                    {facs[m.cuenta].map((f) => (
                                      <tr key={f.id}>
                                        <td style={td}><input type="checkbox" checked={sel.has(f.id)} onChange={() => toggle(f.id)} /></td>
                                        <td style={{ ...td, fontWeight: 600 }}>{f.folio_ingreso}<div style={{ fontSize: 11, color: "var(--texto-suave)", fontWeight: 400 }}>{f.folio_proveedor}</div></td>
                                        <td style={{ ...td, fontSize: 12 }}>{f.proveedores?.razon_social || "—"}</td>
                                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(f.importe_factura)}</td>
                                        <td style={{ ...td, fontSize: 12 }}>{f.estatus_general === "gasto_reflejado" ? "Gasto reflejado" : f.estatus_general === "en_tramite_ooad" ? "En trámite OOAD" : "Enviada a OOAD"}</td>
                                        {pago && <td style={td}>
                                          <input type="text" value={crMap[f.id] ?? (f.cr_contrarecibo || "")} onChange={(e) => setCrMap((p) => ({ ...p, [f.id]: e.target.value }))}
                                            placeholder="CR…" style={{ width: 110, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--borde)", fontSize: 13 }} />
                                        </td>}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div style={{ marginTop: 10 }}>
                                  <button className="boton" disabled={aplicando || sel.size === 0} onClick={() => aplicar(m)}>
                                    {aplicando ? "Aplicando…" : pago ? "Marcar seleccionadas como gasto reflejado" : "Revertir seleccionadas"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
