"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const hoy = () => new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

export default function AdminValidacionCE() {
  const [admin, setAdmin] = useState(null);      // { nombre, cargo } o null
  const [autorizado, setAutorizado] = useState(null); // null=cargando, true/false
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [detAbierto, setDetAbierto] = useState(null); // factura con detalle desplegado
  const [detInfo, setDetInfo] = useState({});          // id -> { ...clave } | "load"
  const [oficio, setOficio] = useState(null);    // { filas, folio }
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(false);     // imprimió borrador
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = (session?.user?.email || "").toLowerCase();
      const matricula = email.includes("@") ? email.split("@")[0] : email;
      const { data: adm } = await supabase.from("administradores").select("nombre, cargo")
        .or(`email.eq.${email},matricula.eq.${matricula}`).eq("activo", true).limit(1);
      const a = adm?.[0] || null;
      setAdmin(a);
      const esSub = !!a && /subdirector/i.test(a.cargo || "");
      setAutorizado(esSub);
      if (esSub) await cargar();
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar() {
    // Compra Emergente pendiente de validar (enviada al servicio).
    const { data } = await supabase.from("facturas")
      .select("id, folio_ingreso, folio_proveedor, importe_factura, periodo_inicio, periodo_fin, orden_compra, clave_cbi, centro_costo, contratos ( numero_interno ), proveedores ( razon_social ), capitulos!inner ( nombre ), partidas ( cuenta_finat, cuenta_prei, nombre )")
      .eq("estatus_firmas", "envio_firmas_servicio")
      .eq("capitulos.nombre", "Compra Emergente")
      .eq("anulada", false);
    setFacturas(data || []);
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return facturas;
    return facturas.filter((f) => `${f.folio_ingreso} ${f.folio_proveedor} ${f.proveedores?.razon_social ?? ""} ${f.orden_compra ?? ""}`.toLowerCase().includes(q));
  }, [facturas, busqueda]);

  const verDetalle = async (f) => {
    if (detAbierto === f.id) { setDetAbierto(null); return; }
    setDetAbierto(f.id);
    const clave = String(f.clave_cbi ?? "").trim();
    if (clave && detInfo[f.id] == null) {
      setDetInfo((p) => ({ ...p, [f.id]: "load" }));
      const { data } = await supabase.from("cb_claves").select("descripcion, cuenta_prei, centro_costo, precio").eq("clave", clave).maybeSingle();
      setDetInfo((p) => ({ ...p, [f.id]: data || {} }));
    }
  };

  const seleccionadas = useMemo(() => filtradas.filter((f) => sel[f.id]), [filtradas, sel]);
  const toggle = (id) => setSel((p) => ({ ...p, [id]: !p[id] }));
  const toggleTodas = () => { const all = filtradas.every((f) => sel[f.id]); const n = {}; filtradas.forEach((f) => (n[f.id] = !all)); setSel(n); };

  const generar = () => {
    if (!seleccionadas.length) { setMensaje("Selecciona al menos una factura."); return; }
    setMensaje("");
    const folio = `EF-CE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    setOficio({ filas: seleccionadas, folio });
  };

  async function confirmar(imprimir = false) {
    setGuardando(true); setMensaje("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no válida.");
      const rows = oficio.filas.map((f) => ({ factura_id: f.id, jefe_id: null, dictamen: "cumplimiento", motivo: null, oficio_folio: oficio.folio }));
      const { error } = await supabase.from("validaciones_servicio").upsert(rows, { onConflict: "factura_id" });
      if (error) throw new Error(error.message);
      const ids = oficio.filas.map((f) => f.id);
      setFacturas((prev) => prev.filter((f) => !ids.includes(f.id)));
      if (imprimir) window.print();
      setSel({}); setOficio(null); setAviso(false);
      setMensaje(`✅ Oficio ${oficio.folio} · ${ids.length} factura(s) validadas y enviadas a Finanzas.`);
    } catch (e) { setMensaje("No se pudo: " + e.message); }
    setGuardando(false);
  }

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px" };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13.5 };
  const dLabel = { fontSize: 11, color: "var(--texto-suave)", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 };
  const dVal = { fontWeight: 600, color: "#222" };

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;
  if (!autorizado) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/admin" style={{ color: "var(--verde)" }}>← Panel</Link></div>
        <div style={{ ...card, color: "var(--rojo)" }}>Esta sección es solo para el Subdirector Administrativo.</div>
      </div>
    );
  }

  // ---- Vista del OFICIO de envío a Finanzas (imprimible) ----
  if (oficio) {
    const tot = oficio.filas.reduce((s, f) => s + (Number(f.importe_factura) || 0), 0);
    const tblH = { textAlign: "left", fontSize: 12, padding: "8px 12px", borderBottom: "2px solid #333", textTransform: "uppercase", letterSpacing: 0.4, color: "#333" };
    const tblD = { padding: "8px 12px", borderBottom: "1px solid #ddd", fontSize: 13 };
    return (
      <div>
        <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <button className="boton secundario" onClick={() => { setOficio(null); setAviso(false); }}>← Volver</button>
          <button className="boton" onClick={() => confirmar(true)} disabled={guardando}>{guardando ? "Guardando…" : "🖨 Imprimir y enviar a Finanzas"}</button>
          <button className="boton secundario" onClick={() => { setAviso(true); window.print(); }} disabled={guardando} title="Solo imprime; NO registra el envío">Solo imprimir (borrador)</button>
        </div>
        {aviso && <div className="no-print" style={{ background: "var(--rojo-claro)", color: "var(--rojo)", border: "1px solid var(--rojo)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12, fontWeight: 600 }}>⚠️ Imprimiste un borrador: <strong>aún NO se envió a Finanzas</strong>. Usa «Imprimir y enviar a Finanzas».</div>}
        <div className="hoja">
          <div className="doc-hoja">
            <table className="wrap">
              <thead><tr><td className="thc"><img src="/mem-encabezado.png" alt="" className="mem-h" /></td></tr></thead>
              <tfoot><tr><td className="tfc"><img src="/mem-pie.png" alt="" className="mem-f" /></td></tr></tfoot>
              <tbody><tr><td className="cuerpo">
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, color: "#222" }}>
                  ÓRGANO DE OPERACIÓN ADMINISTRATIVA DESCONCENTRADA ESTATAL EN AGUASCALIENTES<br />
                  HOSPITAL GENERAL DE ZONA NO. 2
                </div>
                <div style={{ textAlign: "right", marginTop: 16, fontSize: 13.5, lineHeight: 1.7 }}>
                  <div>Of. N° <strong>{oficio.folio}</strong></div>
                  <div>Aguascalientes, Ags., a {hoy()}.</div>
                </div>
                <div style={{ marginTop: 8, fontSize: 14 }}>
                  <div style={{ fontWeight: 700 }}>L.A. Nayeli Alonso Orozco</div>
                  <div>Jefa del Departamento de Finanzas del HGZ No. 02</div>
                  <div style={{ marginTop: 16 }}>Presente</div>
                </div>
                <p style={{ marginTop: 26, textAlign: "justify", fontSize: 15, lineHeight: 1.75 }}>
                  Por medio del presente le remito las siguientes facturas de <strong>Compra Emergente</strong>, debidamente <strong>validadas</strong>, para su trámite de pago:
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 22 }}>
                  <thead><tr><th style={tblH}>FACTURA</th><th style={tblH}>PROVEEDOR</th><th style={tblH}>OC</th><th style={{ ...tblH, textAlign: "right" }}>IMPORTE</th></tr></thead>
                  <tbody>
                    {oficio.filas.map((f) => (
                      <tr key={f.id}><td style={tblD}>{f.folio_proveedor}</td><td style={tblD}>{f.proveedores?.razon_social}</td><td style={tblD}>{f.orden_compra || "—"}</td><td style={{ ...tblD, textAlign: "right" }}>{money(f.importe_factura)}</td></tr>
                    ))}
                    <tr><td style={{ ...tblD, borderTop: "2px solid #333", borderBottom: "2px solid #333" }} colSpan={3}><strong>TOTAL ({oficio.filas.length})</strong></td><td style={{ ...tblD, textAlign: "right", fontWeight: 700, borderTop: "2px solid #333", borderBottom: "2px solid #333" }}>{money(tot)}</td></tr>
                  </tbody>
                </table>
                <p style={{ marginTop: 26 }}>Sin otro particular, reciba un cordial saludo.</p>
                <div className="firma-bloque" style={{ marginTop: 56, textAlign: "center" }}>
                  <div style={{ fontWeight: 700 }}>Atentamente</div>
                  <div style={{ fontStyle: "italic", fontSize: 12, color: "#555", marginBottom: 44 }}>&ldquo;Seguridad y Solidaridad Social&rdquo;</div>
                  <div style={{ borderTop: "1px solid #333", width: 340, margin: "0 auto", paddingTop: 6, fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>{admin?.nombre}</div>
                    <div>{admin?.cargo || "Subdirector Administrativo"} del HGZ No. 02</div>
                  </div>
                </div>
              </td></tr></tbody>
            </table>
          </div>
        </div>
        <style>{`
          .doc-hoja { background:#fff; color:#111; box-sizing:border-box; width:21.6cm; min-height:27.9cm; margin:0 auto 20px; padding:0.5cm 1.2cm; border:1px solid var(--borde); border-radius:4px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          .wrap { width:100%; border-collapse:collapse; } .mem-h,.mem-f{ display:block; width:100%; } .thc,.tfc{ padding:0; }
          .cuerpo { vertical-align:top; padding:0.25cm 0.8cm; } .firma-bloque{ break-inside:avoid; }
          @page { size: letter; margin: 0.5cm 1.2cm; }
          @media print { body *{ visibility:hidden !important; } .hoja,.hoja *{ visibility:visible !important; } .hoja{ position:static !important; width:100%; } .no-print{ display:none !important; }
            .doc-hoja{ border:none !important; border-radius:0 !important; margin:0 !important; width:100%; min-height:0 !important; padding:0 !important; } thead{ display:table-header-group; } tfoot{ display:table-footer-group; } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/admin" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Validación de facturas · Compra Emergente</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 4 }}>Selecciona las facturas validadas y genera el oficio de envío a Finanzas. Al enviarlas salen de esta bandeja.</p>

      {mensaje && <p style={{ fontSize: 13, color: mensaje.startsWith("✅") ? "var(--verde-oscuro)" : "var(--rojo)", marginTop: 10, fontWeight: 600 }}>{mensaje}</p>}

      <div style={{ ...card, marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar folio, proveedor, OC…" style={{ flex: 1, minWidth: 240, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14 }} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>{filtradas.length} por validar · {seleccionadas.length} seleccionada(s)</span>
        <button className="boton" onClick={generar} disabled={!seleccionadas.length}>Generar oficio de envío a Finanzas →</button>
      </div>

      {filtradas.length === 0 ? (
        <p style={{ color: "var(--texto-suave)", fontSize: 13, marginTop: 14 }}>No hay facturas de Compra Emergente por validar.</p>
      ) : (
        <div style={{ ...card, padding: 0, marginTop: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={{ ...th, width: 34 }}><input type="checkbox" checked={filtradas.length > 0 && filtradas.every((f) => sel[f.id])} onChange={toggleTodas} /></th>
                <th style={th}>Factura</th><th style={th}>Proveedor</th><th style={th}>OC</th><th style={th}>Periodo</th><th style={{ ...th, textAlign: "right" }}>Importe</th>
              </tr></thead>
              <tbody>
                {filtradas.map((f) => {
                  const abierto = detAbierto === f.id;
                  const info = detInfo[f.id];
                  const cuenta = f.partidas?.cuenta_prei || f.partidas?.cuenta_finat || (info && info !== "load" ? info.cuenta_prei : "") || "—";
                  const cc = f.centro_costo || (info && info !== "load" ? info.centro_costo : "") || "—";
                  const desc = info && info !== "load" ? info.descripcion : "";
                  return (
                    <Fragment key={f.id}>
                      <tr style={sel[f.id] ? { background: "var(--verde-claro)" } : {}}>
                        <td style={td}><input type="checkbox" checked={!!sel[f.id]} onChange={() => toggle(f.id)} /></td>
                        <td style={td}>
                          <button type="button" onClick={() => verDetalle(f)} title="Ver detalle" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "var(--verde-oscuro)", fontWeight: 600 }}>
                            {abierto ? "▾ " : "▸ "}{f.folio_proveedor}
                          </button>
                          <div style={{ fontSize: 11, color: "var(--texto-suave)" }}>{f.folio_ingreso}</div>
                        </td>
                        <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.proveedores?.razon_social ?? "—"}</td>
                        <td style={{ ...td, fontSize: 12 }}>{f.orden_compra || "—"}</td>
                        <td style={{ ...td, fontSize: 12 }}>{f.periodo_inicio} → {f.periodo_fin}</td>
                        <td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td>
                      </tr>
                      {abierto && (
                        <tr>
                          <td></td>
                          <td colSpan={5} style={{ ...td, background: "var(--gris-claro, #f6f7f9)", padding: "12px 14px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px 22px", fontSize: 13 }}>
                              <div><div style={dLabel}>Clave del producto</div><div style={dVal}>{f.clave_cbi || "—"}</div></div>
                              <div><div style={dLabel}>Orden de compra</div><div style={dVal}>{f.orden_compra || "—"}</div></div>
                              <div><div style={dLabel}>Cuenta</div><div style={dVal}>{cuenta}</div></div>
                              <div><div style={dLabel}>Centro de costos</div><div style={dVal}>{cc}</div></div>
                              <div><div style={dLabel}>Contrato</div><div style={dVal}>{f.contratos?.numero_interno || "—"}</div></div>
                              <div><div style={dLabel}>Importe</div><div style={dVal}>{money(f.importe_factura)}</div></div>
                              <div style={{ gridColumn: "1 / -1" }}><div style={dLabel}>Descripción</div><div style={dVal}>{info === "load" ? "Cargando…" : (desc || (f.clave_cbi ? "(clave no encontrada en catálogo)" : "—"))}</div></div>
                            </div>
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
