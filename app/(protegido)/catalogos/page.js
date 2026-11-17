"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const inp = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 14, width: "100%", boxSizing: "border-box" };
const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px" };
const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
const td = { padding: "8px 10px", borderBottom: "1px solid var(--borde)", fontSize: 13, verticalAlign: "top" };

export default function CatalogosPage() {
  const [tab, setTab] = useState("contratos");
  const [esAdmin, setEsAdmin] = useState(false);
  const [rol, setRol] = useState(null);

  const [contratos, setContratos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [jefes, setJefes] = useState([]);
  const [jefeProv, setJefeProv] = useState([]); // {proveedor_id, jefe_id}
  const [partidas, setPartidas] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState("");

  async function cargar() {
    setCargando(true);
    const { data: u } = await supabase.auth.getUser();
    if (u?.user?.id) {
      const { data: perfil } = await supabase.from("usuarios").select("rol").eq("auth_id", u.user.id).maybeSingle();
      setRol(perfil?.rol || null);
      setEsAdmin(["jefe_presupuesto", "jefa_finanzas"].includes(perfil?.rol));
    }
    const [rC, rP, rJ, rJP, rPa, rCap] = await Promise.all([
      supabase.from("contratos").select("id, numero_interno, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo, proveedor_id, partida_id, proveedores ( razon_social ), partidas ( cuenta_finat, cuenta_prei, nombre, capitulos ( nombre ) )").order("numero_interno"),
      supabase.from("proveedores").select("id, razon_social, no_proveedor").order("razon_social"),
      supabase.from("jefes_servicio").select("id, nombre, jefatura, cargo, email, matricula, activo").order("nombre"),
      supabase.from("jefe_proveedor").select("proveedor_id, jefe_id"),
      supabase.from("partidas").select("id, cuenta_finat, cuenta_prei, centro_costo, nombre, capitulo_id, capitulos ( nombre )"),
      supabase.from("capitulos").select("id, nombre").order("nombre"),
    ]);
    setContratos(rC.data || []);
    setProveedores(rP.data || []);
    setJefes(rJ.data || []);
    setJefeProv(rJP.data || []);
    setPartidas(rPa.data || []);
    setCapitulos(rCap.data || []);
    setCargando(false);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const flash = (t) => { setMsg(t); if (t.startsWith("✅")) setTimeout(() => setMsg(""), 4000); };

  if (cargando) return <p style={{ padding: 8 }}>Cargando catálogos…</p>;

  const nAdmins = new Set(contratos.map((c) => (c.administrador_contrato || "").trim())).size;
  const tabs = [
    ["contratos", `Contratos (${contratos.length})`],
    ["admins", `Administradores (${nAdmins})`],
    ["jefes", `Jefes de servicio (${jefes.length})`],
    ["proveedores", `Proveedores (${proveedores.length})`],
    ["cuentas", `Cuentas (${partidas.length})`],
    ["claves", "Claves (cuadro básico)"],
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Catálogos</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 4 }}>
        Aquí vive la información maestra. Actualiza precios, administradores de contrato, conceptos, jefes de servicio y proveedores cuando haya cambios.
      </p>

      {!esAdmin && (
        <div style={{ background: "var(--ambar-claro)", color: "var(--ambar)", padding: "8px 12px", borderRadius: 8, fontSize: 13, margin: "8px 0" }}>
          ⚠️ Tu cuenta ({rol || "sin rol"}) puede editar jefes de servicio y sus proveedores, pero <strong>no</strong> contratos/precios/proveedores/cuentas (requiere rol de Presupuesto o Finanzas).
        </div>
      )}
      {msg && (
        <div style={{ background: msg.startsWith("✅") ? "var(--verde-claro)" : "var(--rojo-claro)", color: msg.startsWith("✅") ? "var(--verde-oscuro)" : "var(--rojo)", border: `1px solid ${msg.startsWith("✅") ? "var(--verde)" : "var(--rojo)"}`, padding: "10px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, margin: "8px 0" }}>{msg}</div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ cursor: "pointer", padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
              border: `1px solid ${tab === k ? "var(--verde)" : "var(--borde)"}`,
              background: tab === k ? "var(--verde)" : "var(--blanco)", color: tab === k ? "#fff" : "var(--texto)" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "contratos" && <TabContratos contratos={contratos} proveedores={proveedores} partidas={partidas} esAdmin={esAdmin} flash={flash} recargar={cargar} />}
      {tab === "admins" && <TabAdministradores contratos={contratos} esAdmin={esAdmin} flash={flash} recargar={cargar} />}
      {tab === "jefes" && <TabJefes jefes={jefes} proveedores={proveedores} jefeProv={jefeProv} flash={flash} recargar={cargar} />}
      {tab === "proveedores" && <TabProveedores proveedores={proveedores} esAdmin={esAdmin} flash={flash} recargar={cargar} />}
      {tab === "cuentas" && <TabCuentas partidas={partidas} capitulos={capitulos} esAdmin={esAdmin} flash={flash} recargar={cargar} />}
      {tab === "claves" && <TabClaves esAdmin={esAdmin} flash={flash} />}
    </div>
  );
}

/* ---------------- CLAVES de cuadro básico (cb_claves) ---------------- */
// Normaliza al formato del catálogo: 080.823.0130.1001 (14 dígitos, 3.3.4.4).
function normalizaClave(raw) {
  const dig = String(raw || "").replace(/\D/g, "");
  if (dig.length === 14) return `${dig.slice(0, 3)}.${dig.slice(3, 6)}.${dig.slice(6, 10)}.${dig.slice(10, 14)}`;
  return String(raw || "").trim();
}
// Moda (valor más repetido) de una lista, ignorando vacíos.
function moda(vals) {
  const m = {};
  for (const v of vals) { const k = (v ?? "").toString().trim(); if (k) m[k] = (m[k] || 0) + 1; }
  let mejor = null, max = 0;
  for (const k of Object.keys(m)) if (m[k] > max) { max = m[k]; mejor = k; }
  return mejor;
}

function TabClaves({ esAdmin, flash }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState(null); // null = aún no se busca
  const [buscando, setBuscando] = useState(false);

  const buscar = async (texto) => {
    const s = (texto ?? q).trim();
    if (!s) { setResultados(null); return; }
    setBuscando(true);
    const canon = normalizaClave(s);
    const { data, error } = await supabase
      .from("cb_claves")
      .select("clave, descripcion, partida_sai, cuenta_prei, centro_costo, precio")
      .or(`clave.ilike.%${s}%,clave.ilike.%${canon}%,descripcion.ilike.%${s}%`)
      .order("clave")
      .limit(50);
    setBuscando(false);
    if (error) { flash("No se pudo buscar: " + error.message); return; }
    setResultados(data || []);
  };

  const guardarCampo = async (clave, campo, valor) => {
    const patch = { [campo]: campo === "precio" ? (valor === "" ? null : Number(valor)) : (valor.trim() || null) };
    const { data, error } = await supabase.from("cb_claves").update(patch).eq("clave", clave).select("clave");
    if (error) return flash("No se pudo guardar: " + error.message);
    if (!data?.length) return flash("No se guardó (0 filas). ¿Tu cuenta tiene permiso de administrador?");
    setResultados((prev) => (prev || []).map((x) => (x.clave === clave ? { ...x, ...patch } : x)));
    flash("✅ Clave actualizada: " + clave);
  };
  const borrarClave = async (clave) => {
    if (!window.confirm(`¿Quitar la clave "${clave}" del catálogo?`)) return;
    const { error } = await supabase.from("cb_claves").delete().eq("clave", clave);
    if (error) return flash("No se pudo quitar: " + error.message);
    setResultados((prev) => (prev || []).filter((x) => x.clave !== clave));
    flash("✅ Clave eliminada: " + clave);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", margin: 0 }}>
        Catálogo de claves de cuadro básico. Al capturar una factura de <strong>Compra Emergente</strong>, teclear la clave autollena
        la <strong>cuenta (PREI)</strong> y el <strong>centro de costos</strong>. Aquí das de alta claves nuevas o corriges las existentes.
      </p>

      {esAdmin && <AltaClave flash={flash} onAlta={() => buscar()} />}

      {/* Buscar / editar */}
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
            placeholder="Buscar por clave o descripción…" style={{ ...inp, maxWidth: 420 }} />
          <button className="boton" onClick={() => buscar()} disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</button>
        </div>

        {resultados == null ? (
          <p style={{ fontSize: 13, color: "var(--texto-suave)" }}>Escribe una clave o parte de la descripción y da <strong>Buscar</strong>. (El catálogo tiene decenas de miles de claves, por eso no se listan todas.)</p>
        ) : resultados.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--texto-suave)" }}>No se encontró ninguna clave con “{q}”. Si es nueva, dala de alta arriba. ☝️</p>
        ) : (
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>Clave</th><th style={th}>Descripción</th>
                  <th style={{ ...th, width: 90 }}>Partida SAI</th><th style={{ ...th, width: 110 }}>Cuenta (PREI)</th>
                  <th style={{ ...th, width: 100 }}>C. costos</th><th style={{ ...th, width: 120, textAlign: "right" }}>Precio ref.</th>
                  {esAdmin && <th style={{ ...th, width: 60 }}></th>}
                </tr></thead>
                <tbody>
                  {resultados.map((c) => (
                    <tr key={c.clave}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{c.clave}</td>
                      <td style={td}><input style={inp} defaultValue={c.descripcion || ""} disabled={!esAdmin} onBlur={(e) => esAdmin && e.target.value !== (c.descripcion || "") && guardarCampo(c.clave, "descripcion", e.target.value)} /></td>
                      <td style={td}><input style={inp} defaultValue={c.partida_sai || ""} disabled={!esAdmin} onBlur={(e) => esAdmin && e.target.value !== (c.partida_sai || "") && guardarCampo(c.clave, "partida_sai", e.target.value)} /></td>
                      <td style={td}><input style={inp} defaultValue={c.cuenta_prei || ""} disabled={!esAdmin} onBlur={(e) => esAdmin && e.target.value !== (c.cuenta_prei || "") && guardarCampo(c.clave, "cuenta_prei", e.target.value)} /></td>
                      <td style={td}><input style={inp} defaultValue={c.centro_costo || ""} disabled={!esAdmin} onBlur={(e) => esAdmin && e.target.value !== (c.centro_costo || "") && guardarCampo(c.clave, "centro_costo", e.target.value)} /></td>
                      <td style={td}><input type="number" step="0.0001" style={{ ...inp, textAlign: "right" }} defaultValue={c.precio ?? ""} disabled={!esAdmin} onBlur={(e) => esAdmin && Number(e.target.value) !== Number(c.precio ?? "") && guardarCampo(c.clave, "precio", e.target.value)} /></td>
                      {esAdmin && <td style={td}><button className="boton secundario" style={{ fontSize: 12, padding: "5px 8px" }} onClick={() => borrarClave(c.clave)}>Quitar</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: "var(--texto-suave)", padding: "6px 10px", margin: 0 }}>Se muestran hasta 50 coincidencias. Los cambios se guardan al salir del campo (clic fuera).</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Alta de una clave nueva: avisa si ya existe y sugiere cuenta + centro de costos a partir de las claves hermanas.
function AltaClave({ flash, onAlta }) {
  const vacio = { clave: "", descripcion: "", partida_sai: "", cuenta_prei: "", centro_costo: "", precio: "" };
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  const [yaExiste, setYaExiste] = useState(null);   // datos de la clave si ya está dada de alta
  const [sug, setSug] = useState("");               // texto de la sugerencia
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // Al escribir la clave: normaliza, avisa si ya existe y sugiere cuenta/CC del grupo.
  async function revisarClave() {
    const c = normalizaClave(f.clave);
    setYaExiste(null); setSug("");
    if (c !== f.clave) set("clave", c);
    if (!c) return;
    // ¿Ya está dada de alta?
    const { data: ex } = await supabase.from("cb_claves").select("clave, descripcion, partida_sai, cuenta_prei, centro_costo, precio").eq("clave", c).maybeSingle();
    if (ex) { setYaExiste(ex); return; }
    // Sugerir cuenta + CC a partir de las claves hermanas (mismo prefijo de familia).
    const segs = c.split(".");
    const prefijos = segs.length >= 4
      ? [segs.slice(0, 3).join(".") + ".", segs.slice(0, 2).join(".") + "."]
      : [c];
    for (const pref of prefijos) {
      const { data } = await supabase.from("cb_claves")
        .select("cuenta_prei, centro_costo, partida_sai")
        .like("clave", pref + "%").not("cuenta_prei", "is", null).limit(100);
      const hermanas = (data || []).filter((x) => x.cuenta_prei);
      if (hermanas.length) {
        const cuenta = moda(hermanas.map((x) => x.cuenta_prei));
        const cc = moda(hermanas.filter((x) => x.cuenta_prei === cuenta).map((x) => x.centro_costo));
        const sai = moda(hermanas.filter((x) => x.cuenta_prei === cuenta).map((x) => x.partida_sai));
        setF((p) => ({ ...p, cuenta_prei: p.cuenta_prei || cuenta || "", centro_costo: p.centro_costo || cc || "", partida_sai: p.partida_sai || sai || "" }));
        setSug(`Sugerido a partir de ${hermanas.length} clave(s) del grupo ${pref.replace(/\.$/, "")}: cuenta ${cuenta || "—"}, CC ${cc || "—"}${sai ? `, SAI ${sai}` : ""}. Verifícalo.`);
        return;
      }
    }
    setSug("No encontré claves hermanas para sugerir cuenta/CC. Captúralos a mano.");
  }

  async function guardar() {
    const c = normalizaClave(f.clave);
    if (!c) return flash("Captura la clave.");
    if (yaExiste) return flash("Esa clave ya está dada de alta. Búscala abajo para editarla.");
    if (!f.cuenta_prei.trim()) return flash("Captura la cuenta (PREI). Sin cuenta no autollena en Compra Emergente.");
    setGuardando(true);
    const payload = {
      clave: c,
      descripcion: f.descripcion.trim() || null,
      partida_sai: f.partida_sai.trim() || null,
      cuenta_prei: f.cuenta_prei.trim(),
      centro_costo: f.centro_costo.trim() || null,
      precio: f.precio !== "" ? Number(f.precio) : null,
    };
    const { error } = await supabase.from("cb_claves").insert(payload);
    setGuardando(false);
    if (error) {
      if ((error.message || "").includes("duplicate")) return flash("Esa clave ya existe. Búscala abajo para editarla.");
      return flash("No se pudo dar de alta: " + error.message);
    }
    flash("✅ Clave dada de alta: " + c);
    setF(vacio); setYaExiste(null); setSug(""); setAbierto(false);
    onAlta && onAlta();
  }

  const lbl = { fontSize: 12, color: "var(--texto-suave)", display: "block", marginBottom: 3 };
  if (!abierto) return <div><button className="boton" onClick={() => setAbierto(true)}>＋ Nueva clave</button></div>;

  return (
    <div style={{ ...card, borderColor: "var(--verde)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 15 }}>Dar de alta una clave</strong>
        <button className="boton secundario" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => { setF(vacio); setYaExiste(null); setSug(""); setAbierto(false); }}>Cancelar</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Clave *</label>
          <input value={f.clave} onChange={(e) => { set("clave", e.target.value); setYaExiste(null); setSug(""); }} onBlur={revisarClave}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); revisarClave(); } }}
            placeholder="Ej. 080.823.0130.1001  (teclea y sal del campo)" style={{ ...inp, borderColor: yaExiste ? "var(--rojo)" : undefined }} />
          {yaExiste && (
            <div style={{ background: "var(--ambar-claro)", color: "var(--ambar)", border: "1px solid var(--ambar)", padding: "8px 10px", borderRadius: 8, fontSize: 12.5, marginTop: 6 }}>
              ⚠️ Esta clave <strong>ya está dada de alta</strong>: {yaExiste.descripcion || "(sin descripción)"} · cuenta {yaExiste.cuenta_prei || "—"} · CC {yaExiste.centro_costo || "—"}. Búscala abajo para editarla; no la des de alta otra vez.
            </div>
          )}
          {sug && !yaExiste && (
            <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", border: "1px solid var(--verde)", padding: "8px 10px", borderRadius: 8, fontSize: 12.5, marginTop: 6 }}>
              💡 {sug}
            </div>
          )}
        </div>
        <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Descripción</label><input value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Nombre / presentación del artículo" style={inp} /></div>
        <div><label style={lbl}>Cuenta (PREI) *</label><input value={f.cuenta_prei} onChange={(e) => set("cuenta_prei", e.target.value)} placeholder="Ej. 51251022" style={inp} /></div>
        <div><label style={lbl}>Centro de costos</label><input value={f.centro_costo} onChange={(e) => set("centro_costo", e.target.value)} placeholder="Ej. 200205" style={inp} /></div>
        <div><label style={lbl}>Partida SAI</label><input value={f.partida_sai} onChange={(e) => set("partida_sai", e.target.value)} placeholder="Ej. 0301" style={inp} /></div>
        <div><label style={lbl}>Precio de referencia</label><input type="number" step="0.0001" value={f.precio} onChange={(e) => set("precio", e.target.value)} placeholder="Opcional" style={inp} /></div>
      </div>
      <div style={{ marginTop: 10 }}>
        <button className="boton" onClick={guardar} disabled={guardando || !!yaExiste}>{guardando ? "Guardando…" : "Dar de alta la clave"}</button>
        <span style={{ fontSize: 12, color: "var(--texto-suave)", marginLeft: 10 }}>La cuenta debe tener su marco <strong>CE-&lt;cuenta&gt;</strong> para autollenar en Compra Emergente.</span>
      </div>
    </div>
  );
}

/* ---------------- ALTA de contrato nuevo ---------------- */
function AltaContrato({ proveedores, partidas, flash, recargar }) {
  const vacio = { numero_interno: "", proveedor_id: "", partida_id: "", administrador_contrato: "", adquisicion_servicio: "", vigencia_inicio: "", vigencia_fin: "", monto_minimo: "", monto_maximo: "" };
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  const [provNuevo, setProvNuevo] = useState(false);   // proveedor a dar de alta
  const [provNombre, setProvNombre] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const partidasOrd = useMemo(() => [...partidas].sort((a, b) => String(a.cuenta_finat || a.cuenta_prei || "").localeCompare(String(b.cuenta_finat || b.cuenta_prei || ""))), [partidas]);

  async function guardar() {
    if (!f.numero_interno.trim()) return flash("Captura el número de contrato.");
    if (provNuevo ? !provNombre.trim() : !f.proveedor_id) return flash("Elige o captura el proveedor.");
    if (!f.partida_id) return flash("Elige la cuenta (partida).");
    if (!f.vigencia_inicio || !f.vigencia_fin) return flash("Indica la vigencia (inicio y fin).");
    if (f.vigencia_fin < f.vigencia_inicio) return flash("La vigencia fin no puede ser anterior al inicio.");
    setGuardando(true);
    // Resolver proveedor: si es nuevo, darlo de alta (o reutilizar si ya existe por nombre)
    let proveedorId = f.proveedor_id;
    if (provNuevo) {
      const nom = provNombre.trim();
      const { data: ex } = await supabase.from("proveedores").select("id").ilike("razon_social", nom).limit(1);
      if (ex && ex.length) proveedorId = ex[0].id;
      else {
        const { data: nuevoProv, error: ep } = await supabase.from("proveedores").insert({ razon_social: nom }).select("id").single();
        if (ep) { setGuardando(false); return flash("No se pudo crear el proveedor: " + ep.message); }
        proveedorId = nuevoProv.id;
      }
    }
    const payload = {
      numero_interno: f.numero_interno.trim(),
      proveedor_id: proveedorId,
      partida_id: f.partida_id,
      administrador_contrato: f.administrador_contrato.trim() || null,
      adquisicion_servicio: f.adquisicion_servicio.trim() || null,
      vigencia_inicio: f.vigencia_inicio,
      vigencia_fin: f.vigencia_fin,
      monto_minimo: f.monto_minimo !== "" ? Number(f.monto_minimo) : null,
      monto_maximo: f.monto_maximo !== "" ? Number(f.monto_maximo) : null,
    };
    const { error } = await supabase.from("contratos").insert(payload);
    setGuardando(false);
    if (error) return flash("No se pudo crear el contrato: " + error.message);
    flash("✅ Contrato creado" + (provNuevo ? " (con proveedor nuevo)" : "") + ". Ábrelo en la lista para cargarle sus servicios/precios.");
    setF(vacio); setProvNuevo(false); setProvNombre(""); setAbierto(false); recargar();
  }

  const lbl = { fontSize: 12, color: "var(--texto-suave)", display: "block", marginBottom: 3 };
  if (!abierto) {
    return <div style={{ marginBottom: 10 }}><button className="boton" onClick={() => setAbierto(true)}>＋ Nuevo contrato</button></div>;
  }
  return (
    <div style={{ ...card, marginBottom: 12, borderColor: "var(--verde)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 15 }}>Nuevo contrato</strong>
        <button className="boton secundario" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => { setF(vacio); setProvNuevo(false); setProvNombre(""); setAbierto(false); }}>Cancelar</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <div><label style={lbl}>Número de contrato *</label><input value={f.numero_interno} onChange={(e) => set("numero_interno", e.target.value)} placeholder="Ej. 050GYR032N…-000-00" style={inp} /></div>
        <div><label style={lbl}>Proveedor *</label>
          {provNuevo ? (
            <>
              <input value={provNombre} onChange={(e) => setProvNombre(e.target.value)} placeholder="Razón social del proveedor nuevo" style={inp} />
              <button type="button" onClick={() => { setProvNuevo(false); setProvNombre(""); }} style={{ fontSize: 11, color: "var(--verde)", background: "none", border: "none", cursor: "pointer", padding: "3px 0" }}>← elegir uno existente</button>
            </>
          ) : (
            <>
              <select value={f.proveedor_id} onChange={(e) => set("proveedor_id", e.target.value)} style={inp}>
                <option value="">Elige…</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              </select>
              <button type="button" onClick={() => { setProvNuevo(true); set("proveedor_id", ""); }} style={{ fontSize: 11, color: "var(--verde)", background: "none", border: "none", cursor: "pointer", padding: "3px 0" }}>＋ proveedor nuevo</button>
            </>
          )}
        </div>
        <div><label style={lbl}>Cuenta (partida) *</label>
          <select value={f.partida_id} onChange={(e) => set("partida_id", e.target.value)} style={inp}>
            <option value="">Elige…</option>
            {partidasOrd.map((p) => <option key={p.id} value={p.id}>{(p.cuenta_finat || p.cuenta_prei || "—") + " — " + (p.nombre || "") + (p.capitulos?.nombre ? " · " + p.capitulos.nombre : "")}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Administrador de contrato</label><input value={f.administrador_contrato} onChange={(e) => set("administrador_contrato", e.target.value)} style={inp} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Objeto / adquisición-servicio</label><input value={f.adquisicion_servicio} onChange={(e) => set("adquisicion_servicio", e.target.value)} placeholder="Ej. Subrogación de hemodiálisis…" style={inp} /></div>
        <div><label style={lbl}>Vigencia — inicio *</label><input type="date" value={f.vigencia_inicio} onChange={(e) => set("vigencia_inicio", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Vigencia — fin *</label><input type="date" value={f.vigencia_fin} onChange={(e) => set("vigencia_fin", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Monto mínimo</label><input type="number" step="0.01" value={f.monto_minimo} onChange={(e) => set("monto_minimo", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Monto máximo</label><input type="number" step="0.01" value={f.monto_maximo} onChange={(e) => set("monto_maximo", e.target.value)} style={inp} /></div>
      </div>
      <div style={{ marginTop: 10 }}>
        <button className="boton" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Crear contrato"}</button>
        <span style={{ fontSize: 12, color: "var(--texto-suave)", marginLeft: 10 }}>Después ábrelo en la lista para cargarle sus servicios/precios.</span>
      </div>
    </div>
  );
}

/* ---------------- CONTRATOS + servicios/precios ---------------- */
function TabContratos({ contratos, proveedores, partidas, esAdmin, flash, recargar }) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(null); // contrato_id expandido
  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contratos;
    return contratos.filter((c) => `${c.numero_interno} ${c.proveedores?.razon_social} ${c.administrador_contrato} ${c.adquisicion_servicio}`.toLowerCase().includes(s));
  }, [contratos, q]);

  return (
    <div>
      {esAdmin && <AltaContrato proveedores={proveedores} partidas={partidas} flash={flash} recargar={recargar} />}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar contrato, proveedor, administrador…" style={{ ...inp, maxWidth: 420, marginBottom: 10 }} />
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Contrato</th><th style={th}>Proveedor</th><th style={th}>Cuenta / capítulo</th>
              <th style={th}>Admin. de contrato</th><th style={th}>Vigencia</th><th style={{ ...th, textAlign: "right" }}>Monto máx.</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {filtrados.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td style={{ ...td, fontWeight: 600 }}>{c.numero_interno}</td>
                    <td style={td}>{c.proveedores?.razon_social || "—"}</td>
                    <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>{c.partidas?.cuenta_finat || c.partidas?.cuenta_prei || "—"}<div>{c.partidas?.capitulos?.nombre || ""}</div></td>
                    <td style={td}>{c.administrador_contrato || "—"}</td>
                    <td style={{ ...td, fontSize: 12 }}>{c.vigencia_inicio} → {c.vigencia_fin}</td>
                    <td style={{ ...td, textAlign: "right" }}>{c.monto_maximo != null ? money(c.monto_maximo) : "—"}</td>
                    <td style={td}><button className="boton secundario" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setAbierto(abierto === c.id ? null : c.id)}>{abierto === c.id ? "Cerrar" : "Editar"}</button></td>
                  </tr>
                  {abierto === c.id && (
                    <tr>
                      <td style={{ ...td, background: "var(--fondo)" }} colSpan={7}>
                        <EditorContrato contrato={c} esAdmin={esAdmin} flash={flash} recargar={recargar} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EditorContrato({ contrato, esAdmin, flash, recargar }) {
  const [f, setF] = useState({
    administrador_contrato: contrato.administrador_contrato || "",
    adquisicion_servicio: contrato.adquisicion_servicio || "",
    vigencia_inicio: contrato.vigencia_inicio || "",
    vigencia_fin: contrato.vigencia_fin || "",
    monto_minimo: contrato.monto_minimo ?? "",
    monto_maximo: contrato.monto_maximo ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [servicios, setServicios] = useState(null);
  const [nuevoServ, setNuevoServ] = useState({ nombre: "", precio: "" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("contrato_servicios").select("id, nombre_servicio, precio_unitario").eq("contrato_id", contrato.id).order("orden", { ascending: true, nullsFirst: false }).order("nombre_servicio");
      setServicios(data || []);
    })();
  }, [contrato.id]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const guardarContrato = async () => {
    setGuardando(true);
    const patch = {
      administrador_contrato: f.administrador_contrato || null,
      adquisicion_servicio: f.adquisicion_servicio || null,
      vigencia_inicio: f.vigencia_inicio || null,
      vigencia_fin: f.vigencia_fin || null,
      monto_minimo: f.monto_minimo === "" ? null : Number(f.monto_minimo),
      monto_maximo: f.monto_maximo === "" ? null : Number(f.monto_maximo),
    };
    const { data, error } = await supabase.from("contratos").update(patch).eq("id", contrato.id).select("id");
    setGuardando(false);
    if (error) return flash("No se pudo guardar: " + error.message);
    if (!data?.length) return flash("No se guardó (0 filas). ¿Tu cuenta tiene permiso de administrador?");
    flash("✅ Contrato actualizado."); recargar();
  };

  const guardarPrecio = async (s, nuevo) => {
    const val = Number(nuevo);
    if (Number.isNaN(val)) return;
    const { error } = await supabase.from("contrato_servicios").update({ precio_unitario: val }).eq("id", s.id);
    if (error) return flash("No se pudo actualizar el precio: " + error.message);
    setServicios((prev) => prev.map((x) => (x.id === s.id ? { ...x, precio_unitario: val } : x)));
    flash("✅ Precio actualizado: " + s.nombre_servicio);
  };
  const borrarServ = async (s) => {
    if (!window.confirm(`¿Quitar el concepto "${s.nombre_servicio}"?`)) return;
    const { error } = await supabase.from("contrato_servicios").delete().eq("id", s.id);
    if (error) return flash("No se pudo quitar: " + error.message);
    setServicios((prev) => prev.filter((x) => x.id !== s.id));
    flash("✅ Concepto eliminado.");
  };
  const agregarServ = async () => {
    if (!nuevoServ.nombre.trim() || nuevoServ.precio === "") return flash("Captura nombre y precio del concepto.");
    const { data, error } = await supabase.from("contrato_servicios").insert({ contrato_id: contrato.id, nombre_servicio: nuevoServ.nombre.trim(), precio_unitario: Number(nuevoServ.precio) }).select("id, nombre_servicio, precio_unitario");
    if (error) return flash("No se pudo agregar: " + error.message);
    setServicios((prev) => [...prev, ...(data || [])].sort((a, b) => a.nombre_servicio.localeCompare(b.nombre_servicio)));
    setNuevoServ({ nombre: "", precio: "" });
    flash("✅ Concepto agregado.");
  };

  const lab = { fontSize: 12, color: "var(--texto-suave)", display: "block", marginBottom: 2 };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Datos del contrato */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Datos del contrato</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lab}>Administrador del contrato</label><input style={inp} value={f.administrador_contrato} onChange={(e) => set("administrador_contrato", e.target.value)} disabled={!esAdmin} /></div>
          <div><label style={lab}>Objeto / servicio</label><input style={inp} value={f.adquisicion_servicio} onChange={(e) => set("adquisicion_servicio", e.target.value)} disabled={!esAdmin} /></div>
          <div><label style={lab}>Vigencia inicio</label><input type="date" style={inp} value={f.vigencia_inicio} onChange={(e) => set("vigencia_inicio", e.target.value)} disabled={!esAdmin} /></div>
          <div><label style={lab}>Vigencia fin</label><input type="date" style={inp} value={f.vigencia_fin} onChange={(e) => set("vigencia_fin", e.target.value)} disabled={!esAdmin} /></div>
          <div><label style={lab}>Monto mínimo</label><input type="number" step="0.01" style={inp} value={f.monto_minimo} onChange={(e) => set("monto_minimo", e.target.value)} disabled={!esAdmin} /></div>
          <div><label style={lab}>Monto máximo</label><input type="number" step="0.01" style={inp} value={f.monto_maximo} onChange={(e) => set("monto_maximo", e.target.value)} disabled={!esAdmin} /></div>
        </div>
        {esAdmin && <button className="boton" style={{ marginTop: 10 }} onClick={guardarContrato} disabled={guardando}>{guardando ? "Guardando…" : "Guardar datos del contrato"}</button>}
      </div>

      {/* Servicios / precios */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Servicios y precios {servicios ? `(${servicios.length})` : ""}</div>
        {servicios == null ? <p style={{ fontSize: 13, color: "var(--texto-suave)" }}>Cargando…</p> : (
          <div style={{ display: "grid", gap: 6 }}>
            {servicios.map((s) => (
              <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ flex: 1, fontSize: 13 }}>{s.nombre_servicio}</span>
                <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>$</span>
                <input type="number" step="0.0001" defaultValue={s.precio_unitario} style={{ ...inp, width: 130 }} disabled={!esAdmin}
                  onBlur={(e) => { if (esAdmin && Number(e.target.value) !== Number(s.precio_unitario)) guardarPrecio(s, e.target.value); }} />
                {esAdmin && <button className="boton secundario" style={{ fontSize: 12, padding: "5px 8px" }} onClick={() => borrarServ(s)}>Quitar</button>}
              </div>
            ))}
            {servicios.length === 0 && <p style={{ fontSize: 13, color: "var(--texto-suave)" }}>Este contrato no tiene conceptos cargados.</p>}
            {esAdmin && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, borderTop: "1px dashed var(--borde)", paddingTop: 8 }}>
                <input placeholder="Nuevo concepto…" value={nuevoServ.nombre} onChange={(e) => setNuevoServ((p) => ({ ...p, nombre: e.target.value }))} style={{ ...inp, flex: 1 }} />
                <input type="number" step="0.0001" placeholder="Precio" value={nuevoServ.precio} onChange={(e) => setNuevoServ((p) => ({ ...p, precio: e.target.value }))} style={{ ...inp, width: 130 }} />
                <button className="boton" style={{ fontSize: 12 }} onClick={agregarServ}>Agregar</button>
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--texto-suave)" }}>El precio se guarda al salir del campo (clic fuera).</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- ADMINISTRADORES DE CONTRATO (unificar) ---------------- */
function TabAdministradores({ contratos, esAdmin, flash, recargar }) {
  const grupos = useMemo(() => {
    const m = new Map();
    for (const c of contratos) {
      const raw = c.administrador_contrato; // puede ser null
      const key = raw == null ? " null" : raw; // clave exacta para el UPDATE
      const g = m.get(key) || { raw, nombre: raw || "", contratos: [] };
      g.contratos.push(c); m.set(key, g);
    }
    return [...m.values()].sort((a, b) => (a.nombre || "~").localeCompare(b.nombre || "~"));
  }, [contratos]);
  const nombres = [...new Set(grupos.map((g) => g.nombre).filter(Boolean))].sort();

  const renombrar = async (g, nuevo) => {
    const nv = (nuevo || "").trim();
    if (!nv) return flash("El nombre no puede quedar vacío.");
    if (nv === (g.raw || "")) return;
    let query = supabase.from("contratos").update({ administrador_contrato: nv });
    query = g.raw == null ? query.is("administrador_contrato", null) : query.eq("administrador_contrato", g.raw);
    const { data, error } = await query.select("id");
    if (error) return flash("No se pudo renombrar: " + error.message);
    if (!data?.length) return flash("No se guardó (0 filas). ¿Tu cuenta tiene permiso de administrador?");
    flash(`✅ ${data.length} contrato(s) ahora con administrador "${nv}".`); recargar();
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 0 }}>
        Cada renglón es un administrador distinto tal como está escrito hoy. Corrige el texto (mayúsculas, acentos, cargo) y al guardar se actualizan <strong>todos</strong> los contratos con ese administrador. Para unificar dos variantes, escribe en una exactamente igual que la otra (usa la lista sugerida).
      </p>
      <datalist id="lst-admins">{nombres.map((n) => <option key={n} value={n} />)}</datalist>
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Administrador de contrato</th><th style={{ ...th, width: 90, textAlign: "right" }}>Contratos</th></tr></thead>
          <tbody>
            {grupos.map((g, i) => (
              <tr key={i}>
                <td style={td}>
                  {g.raw == null
                    ? <span style={{ color: "var(--texto-suave)", fontStyle: "italic" }}>(sin administrador)</span>
                    : <input list="lst-admins" style={inp} defaultValue={g.nombre} disabled={!esAdmin}
                        onBlur={(e) => esAdmin && renombrar(g, e.target.value)} />}
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{g.contratos.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!esAdmin && <p style={{ fontSize: 12, color: "var(--ambar)", marginTop: 8 }}>Solo un rol de Presupuesto/Finanzas puede editar administradores.</p>}
    </div>
  );
}

/* ---------------- JEFES DE SERVICIO + proveedores ---------------- */
function TabJefes({ jefes, proveedores, jefeProv, flash, recargar }) {
  const [nuevo, setNuevo] = useState({ nombre: "", jefatura: "", cargo: "", email: "", matricula: "" });
  const provDe = (jefeId) => jefeProv.filter((r) => r.jefe_id === jefeId).map((r) => proveedores.find((p) => p.id === r.proveedor_id)).filter(Boolean);

  const guardarJefe = async (j, patch) => {
    const { error } = await supabase.from("jefes_servicio").update(patch).eq("id", j.id);
    if (error) return flash("No se pudo guardar: " + error.message);
    flash("✅ Jefe de servicio actualizado."); recargar();
  };
  const agregarJefe = async () => {
    if (!nuevo.nombre.trim()) return flash("Captura al menos el nombre.");
    const { error } = await supabase.from("jefes_servicio").insert({ ...nuevo, activo: true });
    if (error) return flash("No se pudo agregar: " + error.message);
    setNuevo({ nombre: "", jefatura: "", cargo: "", email: "", matricula: "" });
    flash("✅ Jefe de servicio agregado."); recargar();
  };
  const asignarProv = async (jefeId, proveedorId) => {
    if (!proveedorId) return;
    const { error } = await supabase.from("jefe_proveedor").insert({ jefe_id: jefeId, proveedor_id: proveedorId });
    if (error) return flash("No se pudo asignar: " + error.message);
    flash("✅ Proveedor asignado."); recargar();
  };
  const quitarProv = async (jefeId, proveedorId) => {
    const { error } = await supabase.from("jefe_proveedor").delete().eq("jefe_id", jefeId).eq("proveedor_id", proveedorId);
    if (error) return flash("No se pudo quitar: " + error.message);
    flash("✅ Proveedor quitado."); recargar();
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {jefes.map((j) => (
        <div key={j.id} style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input style={inp} defaultValue={j.nombre} placeholder="Nombre" onBlur={(e) => e.target.value !== j.nombre && guardarJefe(j, { nombre: e.target.value })} />
            <input style={inp} defaultValue={j.jefatura || ""} placeholder="Jefatura / servicio" onBlur={(e) => e.target.value !== (j.jefatura || "") && guardarJefe(j, { jefatura: e.target.value })} />
            <input style={inp} defaultValue={j.cargo || ""} placeholder="Cargo (QFB, Dra., etc.)" onBlur={(e) => e.target.value !== (j.cargo || "") && guardarJefe(j, { cargo: e.target.value })} />
            <input style={inp} defaultValue={j.email || ""} placeholder="Correo" onBlur={(e) => e.target.value !== (j.email || "") && guardarJefe(j, { email: e.target.value })} />
            <input style={inp} defaultValue={j.matricula || ""} placeholder="Matrícula" onBlur={(e) => e.target.value !== (j.matricula || "") && guardarJefe(j, { matricula: e.target.value })} />
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={!!j.activo} onChange={(e) => guardarJefe(j, { activo: e.target.checked })} /> Activo
            </label>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--texto-suave)" }}>Proveedores asignados:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
            {provDe(j.id).map((p) => (
              <span key={p.id} style={{ fontSize: 12, background: "var(--verde-claro)", color: "var(--verde-oscuro)", borderRadius: 999, padding: "3px 8px", display: "inline-flex", gap: 6, alignItems: "center" }}>
                {p.razon_social} <button onClick={() => quitarProv(j.id, p.id)} style={{ cursor: "pointer", border: "none", background: "transparent", color: "var(--rojo)", fontWeight: 700 }}>×</button>
              </span>
            ))}
            {provDe(j.id).length === 0 && <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>(ninguno)</span>}
            <select defaultValue="" onChange={(e) => { asignarProv(j.id, e.target.value); e.target.value = ""; }} style={{ ...inp, width: "auto", fontSize: 12, padding: "5px 8px" }}>
              <option value="">+ Asignar proveedor…</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
            </select>
          </div>
        </div>
      ))}
      <div style={{ ...card, borderStyle: "dashed" }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Agregar jefe de servicio</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <input style={inp} placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo((p) => ({ ...p, nombre: e.target.value }))} />
          <input style={inp} placeholder="Jefatura / servicio" value={nuevo.jefatura} onChange={(e) => setNuevo((p) => ({ ...p, jefatura: e.target.value }))} />
          <input style={inp} placeholder="Cargo" value={nuevo.cargo} onChange={(e) => setNuevo((p) => ({ ...p, cargo: e.target.value }))} />
          <input style={inp} placeholder="Correo" value={nuevo.email} onChange={(e) => setNuevo((p) => ({ ...p, email: e.target.value }))} />
          <input style={inp} placeholder="Matrícula" value={nuevo.matricula} onChange={(e) => setNuevo((p) => ({ ...p, matricula: e.target.value }))} />
          <button className="boton" onClick={agregarJefe}>Agregar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PROVEEDORES ---------------- */
function TabProveedores({ proveedores, esAdmin, flash, recargar }) {
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState({ razon_social: "", no_proveedor: "" });
  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? proveedores.filter((p) => `${p.razon_social} ${p.no_proveedor || ""}`.toLowerCase().includes(s)) : proveedores;
  }, [proveedores, q]);
  const guardar = async (p, patch) => {
    const { data, error } = await supabase.from("proveedores").update(patch).eq("id", p.id).select("id");
    if (error) return flash("No se pudo guardar: " + error.message);
    if (!data?.length) return flash("No se guardó (0 filas). ¿Permiso de administrador?");
    flash("✅ Proveedor actualizado."); recargar();
  };
  const agregar = async () => {
    if (!nuevo.razon_social.trim()) return flash("Captura la razón social.");
    const { error } = await supabase.from("proveedores").insert({ razon_social: nuevo.razon_social.trim(), no_proveedor: nuevo.no_proveedor.trim() || null });
    if (error) return flash("No se pudo agregar: " + error.message);
    setNuevo({ razon_social: "", no_proveedor: "" }); flash("✅ Proveedor agregado."); recargar();
  };
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proveedor…" style={{ ...inp, maxWidth: 420, marginBottom: 10 }} />
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Razón social</th><th style={{ ...th, width: 160 }}>No. proveedor</th></tr></thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td style={td}><input style={inp} defaultValue={p.razon_social} disabled={!esAdmin} onBlur={(e) => esAdmin && e.target.value !== p.razon_social && guardar(p, { razon_social: e.target.value })} /></td>
                <td style={td}><input style={inp} defaultValue={p.no_proveedor || ""} disabled={!esAdmin} onBlur={(e) => esAdmin && e.target.value !== (p.no_proveedor || "") && guardar(p, { no_proveedor: e.target.value || null })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {esAdmin && (
        <div style={{ ...card, borderStyle: "dashed", marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <input style={{ ...inp, flex: 1 }} placeholder="Nueva razón social" value={nuevo.razon_social} onChange={(e) => setNuevo((p) => ({ ...p, razon_social: e.target.value }))} />
          <input style={{ ...inp, width: 160 }} placeholder="No. proveedor" value={nuevo.no_proveedor} onChange={(e) => setNuevo((p) => ({ ...p, no_proveedor: e.target.value }))} />
          <button className="boton" onClick={agregar}>Agregar</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- CUENTAS / PARTIDAS ---------------- */
function TabCuentas({ partidas, capitulos, esAdmin, flash, recargar }) {
  const [q, setQ] = useState("");
  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = [...partidas].sort((a, b) => (a.capitulos?.nombre || "").localeCompare(b.capitulos?.nombre || "") || (a.cuenta_finat || a.cuenta_prei || "").localeCompare(b.cuenta_finat || b.cuenta_prei || ""));
    return s ? base.filter((p) => `${p.cuenta_finat || ""} ${p.cuenta_prei || ""} ${p.nombre} ${p.capitulos?.nombre || ""}`.toLowerCase().includes(s)) : base;
  }, [partidas, q]);
  const guardar = async (p, patch) => {
    const { data, error } = await supabase.from("partidas").update(patch).eq("id", p.id).select("id");
    if (error) return flash("No se pudo guardar: " + error.message);
    if (!data?.length) return flash("No se guardó (0 filas). ¿Permiso de administrador?");
    flash("✅ Cuenta actualizada."); recargar();
  };
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cuenta, nombre, capítulo…" style={{ ...inp, maxWidth: 420, marginBottom: 10 }} />
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Capítulo</th><th style={{ ...th, width: 130 }}>Cuenta</th><th style={th}>Nombre de la partida</th><th style={{ ...th, width: 120 }}>C. de costos</th></tr></thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>{p.capitulos?.nombre || "—"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{p.cuenta_finat || p.cuenta_prei || "—"}</td>
                  <td style={td}><input style={inp} defaultValue={p.nombre} disabled={!esAdmin} onBlur={(e) => esAdmin && e.target.value !== p.nombre && guardar(p, { nombre: e.target.value })} /></td>
                  <td style={td}><input style={inp} defaultValue={p.centro_costo || ""} disabled={!esAdmin} placeholder="Ej. 200217" onBlur={(e) => esAdmin && e.target.value !== (p.centro_costo || "") && guardar(p, { centro_costo: e.target.value.trim() || null })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "var(--texto-suave)", marginTop: 8 }}>{capitulos.length} capítulo(s) en total. La cuenta (FINAT) no se edita aquí para no romper enlaces con contratos/facturas.</p>
    </div>
  );
}
