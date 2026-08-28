"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

// Prefijo de folio de ingreso por capítulo. Debe empatar con los usados en la
// migración (HGZ2-INT-*, HGZ2-AM-*, HGZ2-SS-*, HGZ2-CB-*).
const PREFIJO_CAPITULO = {
  "Integrales": "INT",
  "Servicios Integrales": "INT",
  "Área Médica": "AM",
  "Subrogados": "SS",
  "Cuadro Básico": "CB",
};
function prefijoDe(nombre) {
  if (PREFIJO_CAPITULO[nombre]) return PREFIJO_CAPITULO[nombre];
  // fallback: iniciales alfanuméricas, hasta 3 letras
  const s = (nombre || "GEN").normalize("NFD").replace(/[^\w\s]/g, "").trim().toUpperCase();
  return s.split(/\s+/).map((w) => w[0]).join("").slice(0, 3) || "GEN";
}

// Siguiente folio: HGZ2-{PREFIJO}-{anio}-{consecutivo 6 díg.}
async function generarFolioIngreso(prefijoCap, anio) {
  const prefijo = `HGZ2-${prefijoCap}-${anio}-`;
  const { data, error } = await supabase
    .from("facturas")
    .select("folio_ingreso")
    .like("folio_ingreso", `${prefijo}%`)
    .order("folio_ingreso", { ascending: false })
    .limit(1);
  if (error) throw error;
  let consecutivo = 1;
  if (data && data.length > 0) {
    const ultimo = data[0].folio_ingreso.slice(prefijo.length);
    const n = parseInt(ultimo, 10);
    if (!Number.isNaN(n)) consecutivo = n + 1;
  }
  return prefijo + String(consecutivo).padStart(6, "0");
}

export default function NuevaFacturaPage() {
  const router = useRouter();
  const [capitulos, setCapitulos] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [contratos, setContratos] = useState([]);

  const [capituloId, setCapituloId] = useState("");
  const [partidaId, setPartidaId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [proveedor, setProveedor] = useState(null);

  const [folioProveedor, setFolioProveedor] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFin, setPeriodoFin] = useState("");
  const [importe, setImporte] = useState("");

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // 1) Cargar todos los capítulos.
  useEffect(() => {
    let activo = true;
    (async () => {
      const { data, error } = await supabase.from("capitulos").select("id, nombre").order("nombre");
      if (!activo) return;
      if (error) { setMensaje("No se pudo cargar el catálogo de capítulos: " + error.message); return; }
      setCapitulos(data || []);
    })();
    return () => { activo = false; };
  }, []);

  // 2) Al cambiar capítulo: cargar sus partidas y reiniciar lo dependiente.
  useEffect(() => {
    setPartidaId(""); setContratoId(""); setProveedor(null); setPartidas([]); setContratos([]);
    if (!capituloId) return;
    let activo = true;
    (async () => {
      const { data, error } = await supabase
        .from("partidas")
        .select("id, cuenta_prei, cuenta_finat, nombre")
        .eq("capitulo_id", capituloId)
        .order("cuenta_finat", { ascending: true });
      if (!activo) return;
      if (error) { setMensaje("No se pudieron cargar las partidas: " + error.message); return; }
      setPartidas(data || []);
    })();
    return () => { activo = false; };
  }, [capituloId]);

  // 3) Al cambiar partida: cargar contratos (con proveedor embebido).
  useEffect(() => {
    setContratoId(""); setProveedor(null); setContratos([]);
    if (!partidaId) return;
    let activo = true;
    (async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id, numero_interno, adquisicion_servicio, proveedor_id, proveedores ( id, razon_social, no_proveedor )")
        .eq("partida_id", partidaId)
        .order("numero_interno", { ascending: true });
      if (!activo) return;
      if (error) { setMensaje("No se pudieron cargar los contratos: " + error.message); return; }
      setContratos(data || []);
    })();
    return () => { activo = false; };
  }, [partidaId]);

  function onCambiarContrato(e) {
    const id = e.target.value;
    setContratoId(id);
    const c = contratos.find((x) => x.id === id);
    setProveedor(c ? c.proveedores : null);
  }

  const capituloSel = capitulos.find((c) => c.id === capituloId) || null;

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje("");

    if (!capituloId || !partidaId || !contratoId || !proveedor) {
      setMensaje("Completa capítulo, partida, contrato y proveedor.");
      return;
    }
    if (!periodoInicio || !periodoFin) { setMensaje("Indica el periodo (fecha inicio y fecha fin)."); return; }
    if (periodoFin < periodoInicio) { setMensaje("La fecha fin no puede ser anterior a la fecha inicio."); return; }
    const importeNum = parseFloat(importe);
    if (Number.isNaN(importeNum)) { setMensaje("Captura un importe válido."); return; }

    setCargando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const authId = userData?.user?.id ?? null;
      let createdBy = null;
      if (authId) {
        const { data: perfil, error: perfilError } = await supabase
          .from("usuarios").select("id").eq("auth_id", authId).maybeSingle();
        if (perfilError) throw perfilError;
        createdBy = perfil?.id ?? null;
      }
      if (!createdBy) {
        setMensaje("Tu usuario no está dado de alta en la tabla 'usuarios'. No se puede registrar la factura.");
        setCargando(false);
        return;
      }

      const anio = new Date(periodoInicio + "T00:00:00").getFullYear();
      const folioIngreso = await generarFolioIngreso(prefijoDe(capituloSel?.nombre), anio);

      const { data: nueva, error } = await supabase
        .from("facturas")
        .insert({
          folio_ingreso: folioIngreso,
          folio_proveedor: folioProveedor,
          capitulo_id: capituloId,
          partida_id: partidaId,
          contrato_id: contratoId,
          proveedor_id: proveedor.id,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
          importe_factura: importeNum,
          estatus_general: "capturada",
          created_by: createdBy,
        })
        .select("id")
        .single();

      if (error) {
        setMensaje("No se pudo guardar la factura: " + error.message);
      } else {
        // Paso 2: detalle de servicios (si el contrato tiene catálogo; si no, ahí
        // mismo se registra por importe).
        router.push(`/facturas/${nueva.id}/detalle`);
        return;
      }
    } catch (err) {
      setMensaje("Error al generar el folio o guardar: " + err.message);
    } finally {
      setCargando(false);
    }
  }

  const etiqueta = { fontSize: 12, color: "#5a615e", display: "block", marginTop: 14 };
  const soloLectura = { background: "#f0f2f1", color: "#5a615e" };
  const selectSty = { width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #d8dbd9", marginTop: 4 };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", background: "#fff", border: "1px solid #e2e4e2", borderRadius: 12, padding: 24 }}>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>Captura de factura</h1>
      <p style={{ fontSize: 13, color: "#5a615e", marginTop: 4 }}>Elige el capítulo y el contrato al que pertenece la factura.</p>

      <form onSubmit={handleSubmit}>
        {/* Capítulo */}
        <label style={etiqueta}>Capítulo</label>
        <select required value={capituloId} onChange={(e) => setCapituloId(e.target.value)} style={selectSty}>
          <option value="">Selecciona un capítulo…</option>
          {capitulos.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
        </select>

        {/* Cuenta / partida */}
        <label style={etiqueta}>Cuenta / partida</label>
        <select required value={partidaId} onChange={(e) => setPartidaId(e.target.value)} disabled={!capituloId} style={selectSty}>
          <option value="">{capituloId ? "Selecciona una partida…" : "Primero elige un capítulo"}</option>
          {partidas.map((p) => (
            <option key={p.id} value={p.id}>{[p.cuenta_finat || p.cuenta_prei, p.nombre].filter(Boolean).join(" — ")}</option>
          ))}
        </select>

        {/* Contrato */}
        <label style={etiqueta}>Contrato</label>
        <select required value={contratoId} onChange={onCambiarContrato} disabled={!partidaId} style={selectSty}>
          <option value="">{partidaId ? "Selecciona un contrato…" : "Primero elige una partida"}</option>
          {contratos.map((c) => (
            <option key={c.id} value={c.id}>{[c.numero_interno, c.adquisicion_servicio].filter(Boolean).join(" — ")}</option>
          ))}
        </select>

        {/* Proveedor (autocompletado) */}
        <label style={etiqueta}>Proveedor</label>
        <input type="text" value={proveedor ? proveedor.razon_social || "" : ""} readOnly placeholder="Se completa al elegir el contrato" style={soloLectura} />

        {/* Folio proveedor */}
        <label style={etiqueta}>Folio de factura del proveedor</label>
        <input type="text" required value={folioProveedor} onChange={(e) => setFolioProveedor(e.target.value)} />

        {/* Periodo */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={etiqueta}>Periodo — inicio</label>
            <input type="date" required value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={etiqueta}>Periodo — fin</label>
            <input type="date" required value={periodoFin} onChange={(e) => setPeriodoFin(e.target.value)} />
          </div>
        </div>

        {/* Importe */}
        <label style={etiqueta}>Importe capturado</label>
        <input type="number" required step="0.01" min="0" value={importe} onChange={(e) => setImporte(e.target.value)} />

        <div style={{ height: 22 }} />
        <button type="submit" disabled={cargando} className="boton" style={{ width: "100%" }}>
          {cargando ? "Guardando…" : "Guardar factura"}
        </button>
      </form>

      {mensaje && (<p style={{ fontSize: 12, color: "var(--rojo)", marginTop: 16 }}>{mensaje}</p>)}
    </div>
  );
}
