"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [contratos, setContratos] = useState([]);   // todos, con proveedor + partida + capítulo embebidos
  const [cargandoCat, setCargandoCat] = useState(true);

  const [proveedorId, setProveedorId] = useState("");
  const [contratoId, setContratoId] = useState("");

  const [folioProveedor, setFolioProveedor] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFin, setPeriodoFin] = useState("");
  const [importe, setImporte] = useState("");

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // Cargar TODOS los contratos con su proveedor, partida y capítulo. Con eso,
  // al elegir proveedor y contrato se autocompleta capítulo y cuenta.
  useEffect(() => {
    let activo = true;
    (async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id, numero_interno, adquisicion_servicio, proveedor_id, partida_id, proveedores ( id, razon_social ), partidas ( id, cuenta_finat, cuenta_prei, nombre, capitulo_id, capitulos ( id, nombre ) )")
        .order("numero_interno", { ascending: true });
      if (!activo) return;
      if (error) { setMensaje("No se pudieron cargar los contratos: " + error.message); }
      setContratos(data || []);
      setCargandoCat(false);
    })();
    return () => { activo = false; };
  }, []);

  // Proveedores distintos (solo los que tienen contratos), ordenados.
  const proveedores = useMemo(() => {
    const m = new Map();
    for (const c of contratos) { if (c.proveedores) m.set(c.proveedores.id, c.proveedores.razon_social); }
    return [...m.entries()].map(([id, razon_social]) => ({ id, razon_social })).sort((a, b) => (a.razon_social || "").localeCompare(b.razon_social || ""));
  }, [contratos]);

  const contratosProv = useMemo(() => contratos.filter((c) => c.proveedor_id === proveedorId), [contratos, proveedorId]);

  // Al cambiar de proveedor: si tiene un solo contrato, se elige solo; si no, se limpia.
  useEffect(() => {
    if (!proveedorId) { setContratoId(""); return; }
    setContratoId(contratosProv.length === 1 ? contratosProv[0].id : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedorId]);

  const contratoSel = useMemo(() => contratos.find((c) => c.id === contratoId) || null, [contratos, contratoId]);
  const capituloSel = contratoSel?.partidas?.capitulos || null;
  const cuentaSel = contratoSel?.partidas?.cuenta_finat || contratoSel?.partidas?.cuenta_prei || "";

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje("");

    if (!proveedorId || !contratoId || !contratoSel) {
      setMensaje("Elige proveedor y contrato.");
      return;
    }
    if (!contratoSel.partida_id || !capituloSel?.id) {
      setMensaje("El contrato no tiene cuenta/capítulo asignado. Corrígelo en Catálogos.");
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
          capitulo_id: capituloSel.id,
          partida_id: contratoSel.partida_id,
          contrato_id: contratoId,
          proveedor_id: proveedorId,
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
      <p style={{ fontSize: 13, color: "#5a615e", marginTop: 4 }}>Elige el proveedor y su contrato — el capítulo y la cuenta se completan solos.</p>

      <form onSubmit={handleSubmit}>
        {/* Proveedor */}
        <label style={etiqueta}>Proveedor</label>
        <input list="lst-prov" required value={proveedores.find((p) => p.id === proveedorId)?.razon_social || ""}
          onChange={(e) => { const p = proveedores.find((x) => x.razon_social === e.target.value); setProveedorId(p ? p.id : ""); }}
          placeholder={cargandoCat ? "Cargando…" : "Escribe o elige el proveedor…"} style={{ ...selectSty }} />
        <datalist id="lst-prov">{proveedores.map((p) => <option key={p.id} value={p.razon_social} />)}</datalist>

        {/* Contrato (de ese proveedor) */}
        <label style={etiqueta}>Contrato</label>
        <select required value={contratoId} onChange={(e) => setContratoId(e.target.value)} disabled={!proveedorId} style={selectSty}>
          <option value="">{!proveedorId ? "Primero elige un proveedor" : contratosProv.length === 0 ? "Este proveedor no tiene contratos" : "Selecciona un contrato…"}</option>
          {contratosProv.map((c) => (
            <option key={c.id} value={c.id}>{[c.numero_interno, c.adquisicion_servicio].filter(Boolean).join(" — ")}</option>
          ))}
        </select>
        {proveedorId && contratosProv.length === 1 && <div style={{ fontSize: 11, color: "#5a615e", marginTop: 4 }}>Único contrato de este proveedor (ya seleccionado).</div>}

        {/* Capítulo y cuenta — autocompletados (solo lectura) */}
        <label style={etiqueta}>Capítulo y cuenta (automáticos)</label>
        <input type="text" readOnly style={soloLectura}
          value={contratoSel ? [capituloSel?.nombre, cuentaSel && `Cuenta ${cuentaSel}`, contratoSel?.partidas?.nombre].filter(Boolean).join(" · ") : ""}
          placeholder="Se completa al elegir el contrato" />

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
