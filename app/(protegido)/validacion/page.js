"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const hoy = () => new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

export default function ValidacionServicioPage() {
  const [jefes, setJefes] = useState([]);
  const [jefeId, setJefeId] = useState("");
  const [asignados, setAsignados] = useState(null); // set de proveedor_id del jefe (null = sin cargar)
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [fProv, setFProv] = useState("");
  const [sel, setSel] = useState({});         // facturaId -> bool
  const [dictamen, setDictamen] = useState("cumplimiento");
  const [motivo, setMotivo] = useState("");
  const [oficio, setOficio] = useState(null); // { jefe, dictamen, motivo, filas, folio }
  const [guardando, setGuardando] = useState(false);
  const [esJefeSesion, setEsJefeSesion] = useState(false); // el usuario logueado ES un jefe (bloquea a él)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = (session?.user?.email || "").toLowerCase();
      const [rJ, rF] = await Promise.all([
        supabase.from("jefes_servicio").select("id, nombre, jefatura, email").eq("activo", true).order("nombre"),
        supabase.from("facturas")
          .select("id, folio_ingreso, folio_proveedor, importe_factura, periodo_inicio, periodo_fin, proveedor_id, estatus_firmas, contratos ( numero_interno ), proveedores ( razon_social )")
          .eq("estatus_firmas", "envio_firmas_servicio"),
      ]);
      if (rJ.error) setMensaje("No pude cargar jefes: " + rJ.error.message + " (¿ya corriste sigaf_jefes_servicio.sql?)");
      const lista = rJ.data || [];
      setJefes(lista);
      setFacturas(rF.data || []);
      // Si quien inició sesión es un jefe (por correo), se bloquea a su vista.
      const mio = lista.find((j) => j.email && j.email.toLowerCase() === email);
      if (mio) { setJefeId(mio.id); setEsJefeSesion(true); }
      setCargando(false);
    })();
  }, []);

  // al elegir jefe, cargar sus proveedores asignados
  useEffect(() => {
    if (!jefeId) { setAsignados(null); return; }
    (async () => {
      const { data } = await supabase.from("jefe_proveedor").select("proveedor_id").eq("jefe_id", jefeId);
      setAsignados(new Set((data || []).map((r) => r.proveedor_id)));
    })();
  }, [jefeId]);

  const jefe = useMemo(() => jefes.find((j) => j.id === jefeId), [jefes, jefeId]);
  const sinAsignacion = jefeId && asignados && asignados.size === 0;

  const pendientes = useMemo(() => {
    let base = facturas;
    if (jefeId && asignados && asignados.size > 0) base = facturas.filter((f) => asignados.has(f.proveedor_id));
    const q = busqueda.trim().toLowerCase();
    const pv = fProv.trim().toLowerCase();
    return base.filter((f) => {
      if (pv && !(f.proveedores?.razon_social || "").toLowerCase().includes(pv)) return false;
      if (q) {
        const blob = `${f.folio_ingreso} ${f.folio_proveedor} ${f.proveedores?.razon_social ?? ""} ${f.contratos?.numero_interno ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [facturas, jefeId, asignados, busqueda, fProv]);

  const proveedores = useMemo(() => [...new Set(pendientes.map((f) => f.proveedores?.razon_social).filter(Boolean))].sort(), [pendientes]);
  const seleccionadas = useMemo(() => pendientes.filter((f) => sel[f.id]), [pendientes, sel]);
  const toggle = (id) => setSel((p) => ({ ...p, [id]: !p[id] }));
  const toggleTodas = () => { const all = pendientes.every((f) => sel[f.id]); const n = {}; pendientes.forEach((f) => (n[f.id] = !all)); setSel(n); };

  const generar = () => {
    if (!jefeId) { setMensaje("Elige el jefe de servicio."); return; }
    if (!seleccionadas.length) { setMensaje("Selecciona al menos una factura."); return; }
    if (dictamen === "incumplimiento" && !motivo.trim()) { setMensaje("Captura el motivo del incumplimiento."); return; }
    setMensaje("");
    const folio = `OF-${dictamen === "cumplimiento" ? "CUM" : "INC"}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    setOficio({ jefe, dictamen, motivo, filas: seleccionadas, folio });
  };

  const confirmar = async () => {
    setGuardando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no iniciada.");
      const rows = oficio.filas.map((f) => ({ factura_id: f.id, jefe_id: jefeId, dictamen: oficio.dictamen, motivo: oficio.motivo || null, oficio_folio: oficio.folio }));
      const { error: e1 } = await supabase.from("validaciones_servicio").upsert(rows, { onConflict: "factura_id" });
      if (e1) throw new Error(e1.message);
      // cumplimiento => avanza firmas a autorizada_servicio
      const nuevoFirmas = oficio.dictamen === "cumplimiento" ? "autorizada_servicio" : "pendiente";
      const ids = oficio.filas.map((f) => f.id);
      for (let i = 0; i < ids.length; i += 25) {
        const lote = ids.slice(i, i + 25);
        await Promise.all(lote.map((id) => supabase.from("facturas").update({ estatus_firmas: nuevoFirmas }).eq("id", id)));
      }
      setFacturas((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSel({}); setOficio(null); setMotivo("");
      setMensaje(`Oficio ${oficio.folio} registrado · ${ids.length} factura(s) ${oficio.dictamen === "cumplimiento" ? "validadas (cumplimiento)" : "marcadas por incumplimiento"}.`);
    } catch (e) { setMensaje("No se pudo guardar: " + e.message); }
    setGuardando(false);
  };

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px" };
  const inp = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14 };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13 };

  // ---- Vista del OFICIO (borrador imprimible) ----
  if (oficio) {
    const total = oficio.filas.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0);
    const esCum = oficio.dictamen === "cumplimiento";
    return (
      <div>
        <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="boton secundario" onClick={() => setOficio(null)}>← Volver</button>
          <button className="boton secundario" onClick={() => window.print()}>Imprimir / PDF</button>
          <button className="boton" onClick={confirmar} disabled={guardando}>{guardando ? "Guardando…" : "Confirmar y registrar"}</button>
          <span style={{ fontSize: 12, color: "var(--ambar)", alignSelf: "center" }}>⚠️ BORRADOR — pendiente la plantilla oficial de tu oficina.</span>
        </div>
        <div style={{ ...card, maxWidth: 800, margin: "0 auto", lineHeight: 1.5 }}>
          <div style={{ textAlign: "center", fontWeight: 700 }}>INSTITUTO MEXICANO DEL SEGURO SOCIAL</div>
          <div style={{ textAlign: "center", fontSize: 13, color: "var(--texto-suave)" }}>Hospital General de Zona No. 02 · {oficio.jefe?.jefatura}</div>
          <div style={{ textAlign: "right", marginTop: 16, fontSize: 13 }}>Oficio: <strong>{oficio.folio}</strong><br />Aguascalientes, Ags., a {hoy()}</div>
          <h2 style={{ fontSize: 16, marginTop: 18 }}>Dictamen de {esCum ? "CUMPLIMIENTO" : "INCUMPLIMIENTO"}</h2>
          <p style={{ fontSize: 14 }}>
            El que suscribe, <strong>{oficio.jefe?.nombre}</strong>, Jefe(a) de {oficio.jefe?.jefatura}, hace constar el{" "}
            <strong>{esCum ? "cumplimiento" : "incumplimiento"}</strong> del servicio/bienes amparados por las siguientes facturas:
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
            <thead><tr><th style={th}>Factura</th><th style={th}>Proveedor</th><th style={th}>Contrato</th><th style={th}>Periodo</th><th style={{ ...th, textAlign: "right" }}>Importe</th></tr></thead>
            <tbody>
              {oficio.filas.map((f) => (
                <tr key={f.id}><td style={td}>{f.folio_proveedor}</td><td style={td}>{f.proveedores?.razon_social}</td><td style={td}>{f.contratos?.numero_interno}</td><td style={td}>{f.periodo_inicio} → {f.periodo_fin}</td><td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td></tr>
              ))}
              <tr><td style={td} colSpan={4}><strong>Total</strong></td><td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{money(total)}</td></tr>
            </tbody>
          </table>
          {!esCum && <p style={{ fontSize: 14, marginTop: 10 }}><strong>Motivo del incumplimiento:</strong> {oficio.motivo}</p>}
          <div style={{ marginTop: 48, textAlign: "center", fontSize: 14 }}>___________________________________<br /><strong>{oficio.jefe?.nombre}</strong><br />Jefe(a) de {oficio.jefe?.jefatura}</div>
        </div>
        <style>{`@media print { .no-print { display:none } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Validación del servicio</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 760 }}>
        Aquí el jefe de servicio ve las facturas que Presupuesto le <strong>envió a validar</strong>, revisa por proveedor/contrato,
        selecciona una o varias y <strong>genera el oficio de cumplimiento o incumplimiento</strong>.
      </p>

      {esJefeSesion ? (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>Sesión de:</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{jefe?.nombre}</div>
          <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>Jefatura de {jefe?.jefatura}</div>
        </div>
      ) : (
        <div style={{ ...card, marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Jefe de servicio:</label>
          <select value={jefeId} onChange={(e) => { setJefeId(e.target.value); setSel({}); }} style={{ ...inp, minWidth: 280 }}>
            <option value="">— Elige —</option>
            {jefes.map((j) => <option key={j.id} value={j.id}>{j.nombre} · {j.jefatura}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>(vista de Presupuesto; cada jefe entra con su propio usuario y ve solo lo suyo)</span>
        </div>
      )}

      {mensaje && <p style={{ fontSize: 13, color: mensaje.startsWith("Oficio") ? "var(--verde)" : "var(--rojo)", marginTop: 10, fontWeight: 600 }}>{mensaje}</p>}

      {!jefeId ? (
        <p style={{ color: "var(--texto-suave)", marginTop: 16 }}>Elige un jefe de servicio para ver sus facturas por validar.</p>
      ) : (
        <>
          {sinAsignacion && (
            <div style={{ background: "var(--ambar-claro)", color: "var(--ambar)", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginTop: 12 }}>
              ⚠️ Este jefe aún no tiene proveedores asignados (pendiente tu Excel proveedor→jefe). Mientras, se muestran <strong>todas</strong> las facturas enviadas al servicio.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar folio, contrato…" style={{ ...inp, flex: 1, minWidth: 200 }} />
            <input value={fProv} onChange={(e) => setFProv(e.target.value)} placeholder="Proveedor…" list="lp" style={{ ...inp, flex: 1, minWidth: 180 }} />
            <datalist id="lp">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{pendientes.length} por validar · {seleccionadas.length} seleccionada(s)</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={dictamen} onChange={(e) => setDictamen(e.target.value)} style={{ ...inp, padding: "7px 10px" }}>
                <option value="cumplimiento">Cumplimiento</option>
                <option value="incumplimiento">Incumplimiento</option>
              </select>
              <button className="boton" onClick={generar} disabled={!seleccionadas.length}>Generar oficio</button>
            </div>
          </div>
          {dictamen === "incumplimiento" && (
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del incumplimiento…" style={{ ...inp, width: "100%", marginTop: 8 }} />
          )}

          {pendientes.length === 0 ? (
            <p style={{ color: "var(--texto-suave)", fontSize: 13, marginTop: 12 }}>No hay facturas por validar con estos filtros.</p>
          ) : (
            <div style={{ ...card, padding: 0, marginTop: 10, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={{ ...th, width: 34 }}><input type="checkbox" checked={pendientes.length > 0 && pendientes.every((f) => sel[f.id])} onChange={toggleTodas} /></th>
                    <th style={th}>Factura</th><th style={th}>Proveedor</th><th style={th}>Contrato</th><th style={th}>Periodo</th><th style={{ ...th, textAlign: "right" }}>Importe</th>
                  </tr></thead>
                  <tbody>
                    {pendientes.map((f) => (
                      <tr key={f.id} style={sel[f.id] ? { background: "var(--verde-claro)" } : {}}>
                        <td style={td}><input type="checkbox" checked={!!sel[f.id]} onChange={() => toggle(f.id)} /></td>
                        <td style={td}><Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>{f.folio_ingreso}</Link><div style={{ fontSize: 11, color: "var(--texto-suave)" }}>{f.folio_proveedor}</div></td>
                        <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.proveedores?.razon_social ?? "—"}</td>
                        <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>{f.contratos?.numero_interno ?? "—"}</td>
                        <td style={{ ...td, fontSize: 12 }}>{f.periodo_inicio} → {f.periodo_fin}</td>
                        <td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
