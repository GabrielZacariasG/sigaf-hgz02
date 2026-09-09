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
      supabase.from("partidas").select("id, cuenta_finat, cuenta_prei, nombre, capitulo_id, capitulos ( nombre )"),
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

      {tab === "contratos" && <TabContratos contratos={contratos} esAdmin={esAdmin} flash={flash} recargar={cargar} />}
      {tab === "admins" && <TabAdministradores contratos={contratos} esAdmin={esAdmin} flash={flash} recargar={cargar} />}
      {tab === "jefes" && <TabJefes jefes={jefes} proveedores={proveedores} jefeProv={jefeProv} flash={flash} recargar={cargar} />}
      {tab === "proveedores" && <TabProveedores proveedores={proveedores} esAdmin={esAdmin} flash={flash} recargar={cargar} />}
      {tab === "cuentas" && <TabCuentas partidas={partidas} capitulos={capitulos} esAdmin={esAdmin} flash={flash} recargar={cargar} />}
    </div>
  );
}

/* ---------------- CONTRATOS + servicios/precios ---------------- */
function TabContratos({ contratos, esAdmin, flash, recargar }) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(null); // contrato_id expandido
  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contratos;
    return contratos.filter((c) => `${c.numero_interno} ${c.proveedores?.razon_social} ${c.administrador_contrato} ${c.adquisicion_servicio}`.toLowerCase().includes(s));
  }, [contratos, q]);

  return (
    <div>
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
      const { data } = await supabase.from("contrato_servicios").select("id, nombre_servicio, precio_unitario").eq("contrato_id", contrato.id).order("nombre_servicio");
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
            <thead><tr><th style={th}>Capítulo</th><th style={{ ...th, width: 130 }}>Cuenta</th><th style={th}>Nombre de la partida</th></tr></thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>{p.capitulos?.nombre || "—"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{p.cuenta_finat || p.cuenta_prei || "—"}</td>
                  <td style={td}><input style={inp} defaultValue={p.nombre} disabled={!esAdmin} onBlur={(e) => esAdmin && e.target.value !== p.nombre && guardar(p, { nombre: e.target.value })} /></td>
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
