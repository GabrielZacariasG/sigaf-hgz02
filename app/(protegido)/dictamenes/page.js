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
import { leerTodo } from "../../../lib/paginar";
import { textoPDF, leerIMKK036, resumenUI } from "../../../lib/imkk036";
import { ANIO, UI_HGZ2 } from "../../../lib/contratos";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaTxt = (f) => (f ? new Date(String(f).slice(0, 10) + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const diasDesde = (f) => (f ? Math.floor((Date.now() - new Date(String(f).slice(0, 10) + "T00:00:00")) / 86400000) : null);
const NOTA_AJUSTE = "Ajuste para igualar al dictamen FINAT";

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

  const cargar = async () => {
    const [rD, rS, rC, rA] = await Promise.all([
      supabase.from("dictamenes").select("*").order("numero"),
      leerTodo((d, h) => supabase.from("dictamen_saldos").select("dictamen, ui, definitivo, pagos, disponible").order("dictamen").order("ui").order("anio").order("mes").range(d, h)),
      leerTodo((d, h) => supabase.from("contratos").select("id, numero_interno, numero_alterno, concepto, dictamen_numero, monto_maximo, proveedores ( razon_social )").order("numero_interno").range(d, h)),
      leerTodo((d, h) => supabase.from("contrato_ampliaciones").select("id, contrato_id, importe, nota").order("id").range(d, h)),
    ]);
    const err = [rD, rS, rC, rA].find((r) => r.error);
    if (err) { setError("No se pudo cargar: " + err.error.message + " (¿ya se corrió la migración 049?)"); return; }
    const saldos = {}; for (const s of rS.data || []) (saldos[s.dictamen] ||= []).push(s);
    setDatos({ dictamenes: rD.data || [], saldos, contratos: rC.data || [], amp: rA.data || [] });
  };
  useEffect(() => { cargar(); }, []);

  const contratosDe = (num) => (datos?.contratos || []).filter((c) => c.dictamen_numero === num);
  const enlaceDe = (c) => (Number(c.monto_maximo) || 0) + datos.amp.filter((a) => a.contrato_id === c.id).reduce((s, a) => s + (Number(a.importe) || 0), 0);

  // Lista de dictámenes cargados + los que tienen contrato pero aún no tienen IMKK036
  const filas = useMemo(() => {
    if (!datos) return [];
    const q = busca.trim().toLowerCase();
    const lista = datos.dictamenes.map((d) => {
      const sal = datos.saldos[d.numero] || [];
      const hg = resumenUI(sal, UI_HGZ2);
      const otras = {}; for (const s of sal) if (s.ui !== UI_HGZ2) otras[s.ui] = (otras[s.ui] || 0) + (Number(s.disponible) || 0);
      const cs = contratosDe(d.numero);
      return { d, hg, otras: Object.entries(otras).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]), otrasDisp: Object.values(otras).filter((v) => v > 0.5).reduce((s, v) => s + v, 0), cs, enlace: cs.length === 1 ? enlaceDe(cs[0]) : null };
    });
    const sinCarga = [...new Set(datos.contratos.map((c) => c.dictamen_numero).filter((n) => /^\d{10}-\d{4}$/.test(n || "") && !datos.dictamenes.some((d) => d.numero === n)))]
      .map((n) => ({ sinCarga: true, d: { numero: n }, cs: contratosDe(n) }));
    return [...lista, ...sinCarga].filter((x) => !q || [x.d.numero, ...x.cs.map((c) => `${c.numero_interno} ${c.numero_alterno || ""} ${c.concepto || ""} ${c.proveedores?.razon_social || ""}`)].join(" ").toLowerCase().includes(q));
  }, [datos, busca]);

  // ---------- Revisar PDF ----------
  const revisar = async () => {
    setProcesando(true); setError(""); setOk(""); setRevision(null);
    try {
      const leidos = [];
      for (const f of archivos) {
        try { leidos.push({ archivo: f.name, ...leerIMKK036(await textoPDF(await f.arrayBuffer())) }); }
        catch (e) { leidos.push({ archivo: f.name, ok: false, problema: "No se pudo leer el PDF: " + e.message }); }
      }
      // Por dictamen, el más reciente
      const mejor = {};
      for (const r of leidos.filter((x) => x.ok)) if (!mejor[r.dictamen] || mejor[r.dictamen].ejec < r.ejec) mejor[r.dictamen] = r;
      const items = leidos.map((r) => {
        if (!r.ok) return { ...r, accion: "error" };
        if (mejor[r.dictamen] !== r) return { ...r, accion: "repetido" };
        const actual = datos.dictamenes.find((d) => d.numero === r.dictamen);
        if (actual?.corte && r.corte < actual.corte) return { ...r, accion: "viejo", actual, cs: contratosDe(r.dictamen) };
        const hgNuevo = resumenUI(r.filas, UI_HGZ2);
        const hgAntes = actual ? resumenUI(datos.saldos[r.dictamen] || [], UI_HGZ2) : null;
        const cs = contratosDe(r.dictamen);
        let igualar = null;
        if (cs.length === 1 && Number(r.dictamen.slice(-4)) === ANIO) {
          const c = cs[0];
          const ampSin = datos.amp.filter((a) => a.contrato_id === c.id && !String(a.nota || "").startsWith(NOTA_AJUSTE)).reduce((s, a) => s + (Number(a.importe) || 0), 0);
          const maximo = Number(c.monto_maximo) || 0;
          igualar = { contrato: c, maximo, ampSin, enlaceAntes: enlaceDe(c), enlaceNuevo: hgNuevo.asignado, ajuste: maximo ? Math.round((hgNuevo.asignado - maximo - ampSin) * 100) / 100 : 0, nuevoMaximo: maximo ? null : Math.round((hgNuevo.asignado - ampSin) * 100) / 100 };
        }
        return { ...r, accion: actual ? "actualiza" : "nuevo", actual, hgNuevo, hgAntes, cs, igualar };
      });
      setRevision(items);
    } catch (e) { setError("No se pudo revisar: " + e.message); }
    setProcesando(false);
  };

  // ---------- Guardar ----------
  const guardar = async () => {
    setGuardando(true); setError(""); setOk("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no iniciada.");
      const aGuardar = revision.filter((r) => r.accion === "nuevo" || r.accion === "actualiza");
      let renglones = 0, igualados = 0;
      for (const r of aGuardar) {
        const { error: e1 } = await supabase.from("dictamenes").upsert({
          numero: r.dictamen, origen: r.origen, fecha_dictamen: r.fecha_dictamen, corte: r.corte, archivo: r.archivo,
          total_definitivo: r.totales.definitivo, total_pagos: r.totales.pagos, total_disponible: r.totales.disponible, actualizado_at: new Date().toISOString(),
        });
        if (e1) throw new Error(`${r.dictamen}: ${e1.message}`);
        const { error: e2 } = await supabase.from("dictamen_saldos").delete().eq("dictamen", r.dictamen);
        if (e2) throw new Error(`${r.dictamen}: ${e2.message}`);
        const { error: e3 } = await supabase.from("dictamen_saldos").insert(r.filas.map((f) => ({ dictamen: r.dictamen, ...f })));
        if (e3) throw new Error(`${r.dictamen}: ${e3.message}`);
        renglones += r.filas.length;
        // Igualar el enlace del contrato a FINAT
        const g = r.igualar;
        if (g) {
          const { error: e4 } = await supabase.from("contrato_ampliaciones").delete().eq("contrato_id", g.contrato.id).like("nota", `${NOTA_AJUSTE}%`);
          if (e4) throw new Error(`${g.contrato.numero_interno}: ${e4.message}`);
          if (g.nuevoMaximo != null) {
            const { error: e5 } = await supabase.from("contratos").update({ monto_maximo: g.nuevoMaximo }).eq("id", g.contrato.id);
            if (e5) throw new Error(`${g.contrato.numero_interno}: ${e5.message}`);
          } else if (Math.abs(g.ajuste) > 0.5) {
            const { error: e6 } = await supabase.from("contrato_ampliaciones").insert({ contrato_id: g.contrato.id, fecha: r.corte, importe: g.ajuste, nota: `${NOTA_AJUSTE} ${r.dictamen} (IMKK036 al ${fechaTxt(r.corte)})` });
            if (e6) throw new Error(`${g.contrato.numero_interno}: ${e6.message}`);
          }
          igualados++;
        }
      }
      await supabase.from("cargas_nap").insert({
        archivo: revision.map((r) => r.archivo).join(" | "), renglones, comprobantes: aGuardar.length, aplicadas: igualados, confirmadas: 0,
        detalle: { reporte: "IMKK036", dictamenes: aGuardar.map((r) => ({ dictamen: r.dictamen, corte: r.corte, archivo: r.archivo, disponible_hgz2: r.hgNuevo.disponible, ajuste_enlace: r.igualar?.ajuste ?? null })) },
      });
      setOk(`Listo: ${aGuardar.length} dictámenes actualizados (${renglones} renglones) · ${igualados} contratos con el enlace igual a FINAT.`);
      setRevision(null); setArchivos([]); await cargar();
    } catch (e) { setError("No se pudo guardar: " + e.message); }
    setGuardando(false);
  };

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "12px 14px" };
  const th = { textAlign: "left", fontSize: 12, padding: "6px 8px", borderBottom: "1px solid var(--borde)", color: "var(--texto-suave)", whiteSpace: "nowrap", position: "sticky", top: 0, background: "var(--blanco)" };
  const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid var(--borde)", verticalAlign: "top" };
  const tdN = { ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const ACCION = { nuevo: ["Nuevo", "var(--verde)"], actualiza: ["Se actualiza", "var(--verde)"], viejo: ["Más viejo que el cargado: se ignora", "#d69e2e"], repetido: ["Repetido: se usa el más reciente", "var(--texto-suave)"], error: ["No se puede cargar", "var(--rojo)"] };
  const nGuardar = revision ? revision.filter((r) => r.accion === "nuevo" || r.accion === "actualiza").length : 0;

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/contratos" style={{ color: "var(--verde)" }}>← Contratos</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Dictámenes FINAT</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 950 }}>
        Lo que FINAT asigna al HGZ 2 en cada dictamen, lo pagado y lo disponible, y lo que tienen otras unidades del mismo dictamen (para oficio de apoyo).
        Para actualizar, sube los PDF del <strong>IMKK036 "Rep. Disponibilidad Dictamen"</strong> (varios a la vez). SIGAF los lee, revisa que cada uno cuadre con su renglón TOTALES
        y, al guardar, deja el enlace del contrato igual a lo que asigna FINAT. <strong>No guarda nada hasta que revises.</strong>
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
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Archivo", "Dictamen", "Contrato", "Qué pasa", "Corte", "Disponible HGZ 2", "Enlace del contrato"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{revision.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td, fontSize: 12 }}>{r.archivo}</td>
                <td style={td}>{r.dictamen || "—"}{r.origen ? ` (${r.origen})` : ""}</td>
                <td style={td}>{(r.cs || []).map((c) => c.numero_interno).join(", ") || (r.ok ? <span style={{ color: "var(--texto-suave)" }}>sin contrato en SIGAF</span> : "")}</td>
                <td style={{ ...td, color: ACCION[r.accion][1], fontWeight: 600 }}>{ACCION[r.accion][0]}{r.problema ? <div style={{ fontWeight: 400, fontSize: 12 }}>{r.problema}</div> : null}</td>
                <td style={td}>{r.actual?.corte && r.accion !== "nuevo" ? `${fechaTxt(r.actual.corte)} → ` : ""}{fechaTxt(r.corte)}</td>
                <td style={tdN}>{r.hgNuevo ? <>{r.hgAntes ? `${money(r.hgAntes.disponible)} → ` : ""}<strong>{money(r.hgNuevo.disponible)}</strong></> : ""}</td>
                <td style={{ ...td, fontSize: 12 }}>
                  {r.igualar ? (r.igualar.nuevoMaximo != null ? `Sin máximo: se toma ${money(r.igualar.nuevoMaximo)} del dictamen`
                    : Math.abs(r.igualar.enlaceAntes - r.igualar.enlaceNuevo) > 0.5 ? `${money(r.igualar.enlaceAntes)} → ${money(r.igualar.enlaceNuevo)} (ajuste ${money(r.igualar.ajuste)})` : "Ya es igual a FINAT")
                    : r.hgNuevo ? <span style={{ color: "var(--texto-suave)" }}>{(r.cs || []).length > 1 ? "Dictamen en varios contratos: no se iguala" : Number(String(r.dictamen).slice(-4)) !== ANIO ? "Dictamen de otro año: no cambia el enlace" : "—"}</span> : ""}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {!datos && !error && <p>Cargando dictámenes…</p>}
      {datos && (
        <div style={{ ...card, marginTop: 12, padding: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", flexWrap: "wrap" }}>
            <strong>{filas.filter((x) => !x.sinCarga).length} dictámenes cargados</strong>
            {filas.some((x) => x.sinCarga) && <span style={{ color: "#b7791f", fontSize: 13 }}>· {filas.filter((x) => x.sinCarga).length} con contrato pero sin IMKK036</span>}
            <input placeholder="Buscar dictamen, contrato, proveedor…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--borde)", minWidth: 240 }} />
          </div>
          <div style={{ overflow: "auto", maxHeight: "calc(100vh - 330px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Dictamen", "Contrato", "Proveedor / concepto", "Corte FINAT", "Asignado HGZ 2", "Pagado HGZ 2", "Disponible HGZ 2", "Disponible otras unidades", "Enlace SIGAF"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{filas.map((x) => {
                const k = x.d.numero; const sel = abierto === k; const dias = diasDesde(x.d.corte);
                return (
                  <Fragment key={k}>
                    <tr onClick={() => !x.sinCarga && setAbierto(sel ? null : k)} style={{ cursor: x.sinCarga ? "default" : "pointer", background: sel ? "#fff7d6" : undefined }}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{k}{x.d.origen ? <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}> {x.d.origen}</span> : ""}</td>
                      <td style={td}>{x.cs.map((c) => c.numero_interno).join(", ") || <span style={{ color: "var(--texto-suave)" }}>sin contrato</span>}</td>
                      <td style={{ ...td, maxWidth: 320 }}>{x.cs[0]?.proveedores?.razon_social || ""}<div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{x.cs[0]?.concepto || ""}</div></td>
                      {x.sinCarga ? <td colSpan={6} style={{ ...td, color: "#b7791f" }}>Sin IMKK036: córrelo en FINAT (control SALDO_DICT) y súbelo aquí</td> : <>
                        <td style={{ ...td, whiteSpace: "nowrap", color: dias > 7 ? "#b7791f" : undefined }} title={dias > 7 ? `Hace ${dias} días: conviene actualizarlo` : ""}>{fechaTxt(x.d.corte)}</td>
                        <td style={tdN}>{money(x.hg.asignado)}</td><td style={tdN}>{money(x.hg.pagado)}</td>
                        <td style={{ ...tdN, fontWeight: 700, color: x.hg.disponible < 0.5 ? "var(--rojo)" : "var(--verde)" }}>{money(x.hg.disponible)}</td>
                        <td style={tdN}>{x.otrasDisp ? money(x.otrasDisp) : ""}</td>
                        <td style={{ ...tdN, color: x.enlace != null && Math.abs(x.enlace - x.hg.asignado) > 0.5 && Number(k.slice(-4)) === ANIO ? "#b7791f" : undefined }}
                          title={x.enlace != null && Math.abs(x.enlace - x.hg.asignado) > 0.5 && Number(k.slice(-4)) === ANIO ? "Distinto a lo asignado por FINAT" : ""}>{x.enlace != null ? money(x.enlace) : ""}</td>
                      </>}
                    </tr>
                    {sel && (
                      <tr><td colSpan={9} style={{ ...td, background: "#f7f8f7" }}>
                        <div style={{ fontSize: 12.5, marginBottom: 4 }}>Fecha del dictamen {fechaTxt(x.d.fecha_dictamen)} · archivo {x.d.archivo} · total del dictamen {money(x.d.total_definitivo)}, pagado {money(x.d.total_pagos)}, disponible {money(x.d.total_disponible)}</div>
                        {x.otras.length > 0 && <div style={{ fontSize: 12.5 }}>Disponible por unidad (oficio de apoyo): {x.otras.map(([ui, v]) => `UI ${ui} ${money(v)}`).join(" · ")}</div>}
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
