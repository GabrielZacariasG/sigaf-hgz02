"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

// Etiqueta que se muestra en el formulario (campo fijo, no editable).
const CAPITULO_ETIQUETA = "Servicios Integrales";
// Valor EXACTO almacenado en capitulos.nombre para este capítulo.
const CAPITULO_NOMBRE_BD = "Integrales";

// Genera el siguiente folio_ingreso con el formato:
//   HGZ2-INT-{anio}-{consecutivo de 6 dígitos}
// El consecutivo se calcula a partir del último folio del mismo año.
// NOTA: hay una pequeña ventana de carrera si dos usuarios capturan al
// mismo tiempo; lo ideal a futuro es resolverlo con una secuencia/RPC
// en la base de datos. Por ahora se calcula del lado del cliente.
async function generarFolioIngreso(anio) {
  const prefijo = `HGZ2-INT-${anio}-`;
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
  const [capitulo, setCapitulo] = useState(null); // { id, nombre }
  const [partidas, setPartidas] = useState([]);
  const [contratos, setContratos] = useState([]);

  const [partidaId, setPartidaId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [proveedor, setProveedor] = useState(null); // { id, razon_social, no_proveedor }

  const [folioProveedor, setFolioProveedor] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFin, setPeriodoFin] = useState("");
  const [importe, setImporte] = useState("");

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // 1) Al montar, resolvemos el capítulo "Servicios Integrales" y
  //    cargamos sus partidas.
  useEffect(() => {
    let activo = true;

    async function cargarInicial() {
      // Tabla `capitulos(id, nombre)`. Buscamos por el valor EXACTO
      // "Integrales" para evitar coincidencias con nombres parecidos.
      const { data: caps, error: errCap } = await supabase
        .from("capitulos")
        .select("id, nombre")
        .eq("nombre", CAPITULO_NOMBRE_BD)
        .limit(1);

      if (!activo) return;

      if (errCap) {
        setMensaje("No se pudo cargar el catálogo de capítulos: " + errCap.message);
        return;
      }

      const cap = (caps || [])[0];
      if (!cap) {
        setMensaje('No se encontró el capítulo "Integrales".');
        return;
      }
      setCapitulo(cap);

      const { data: parts, error: errPart } = await supabase
        .from("partidas")
        .select("id, cuenta_prei, nombre")
        .eq("capitulo_id", cap.id)
        .order("cuenta_prei", { ascending: true });

      if (!activo) return;

      if (errPart) {
        setMensaje("No se pudieron cargar las partidas: " + errPart.message);
        return;
      }
      setPartidas(parts || []);
    }

    cargarInicial();
    return () => {
      activo = false;
    };
  }, []);

  // 2) Cuando cambia la partida, cargamos los contratos de esa partida
  //    (con el proveedor embebido) y reiniciamos contrato/proveedor.
  useEffect(() => {
    setContratoId("");
    setProveedor(null);
    setContratos([]);

    if (!partidaId) return;

    let activo = true;
    async function cargarContratos() {
      const { data, error } = await supabase
        .from("contratos")
        .select(
          "id, numero_interno, adquisicion_servicio, proveedor_id, proveedores ( id, razon_social, no_proveedor )"
        )
        .eq("partida_id", partidaId)
        .order("numero_interno", { ascending: true });

      if (!activo) return;

      if (error) {
        setMensaje("No se pudieron cargar los contratos: " + error.message);
        return;
      }
      setContratos(data || []);
    }

    cargarContratos();
    return () => {
      activo = false;
    };
  }, [partidaId]);

  // 3) Cuando cambia el contrato, autocompletamos el proveedor (solo lectura).
  function onCambiarContrato(e) {
    const id = e.target.value;
    setContratoId(id);
    const c = contratos.find((x) => x.id === id);
    setProveedor(c ? c.proveedores : null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje("");
    setExito("");

    if (!capitulo || !partidaId || !contratoId || !proveedor) {
      setMensaje("Completa capítulo, partida, contrato y proveedor.");
      return;
    }
    if (!periodoInicio || !periodoFin) {
      setMensaje("Indica el periodo (fecha inicio y fecha fin).");
      return;
    }
    if (periodoFin < periodoInicio) {
      setMensaje("La fecha fin no puede ser anterior a la fecha inicio.");
      return;
    }
    const importeNum = parseFloat(importe);
    if (Number.isNaN(importeNum)) {
      setMensaje("Captura un importe válido.");
      return;
    }

    setCargando(true);
    try {
      // created_by referencia usuarios.id (el id de la tabla de aplicación),
      // NO el id de auth. Buscamos el renglón del usuario por su auth_id.
      const { data: userData } = await supabase.auth.getUser();
      const authId = userData?.user?.id ?? null;

      let createdBy = null;
      if (authId) {
        const { data: perfil, error: perfilError } = await supabase
          .from("usuarios")
          .select("id")
          .eq("auth_id", authId)
          .maybeSingle();
        if (perfilError) throw perfilError;
        createdBy = perfil?.id ?? null;
      }
      if (!createdBy) {
        setMensaje(
          "Tu usuario no está dado de alta en la tabla 'usuarios'. No se puede registrar la factura."
        );
        setCargando(false);
        return;
      }

      // El año del folio se toma del inicio del periodo. NO enviamos
      // mes_asignado/anio_asignado: los calcula el trigger BEFORE INSERT
      // (fn_calcular_mes_y_vigencia) por la regla de mayoría de días.
      const anio = new Date(periodoInicio + "T00:00:00").getFullYear();

      const folioIngreso = await generarFolioIngreso(anio);

      const { data: nueva, error } = await supabase
        .from("facturas")
        .insert({
          folio_ingreso: folioIngreso,
          folio_proveedor: folioProveedor,
          capitulo_id: capitulo.id,
          partida_id: partidaId,
          contrato_id: contratoId,
          proveedor_id: proveedor.id,
          periodo_inicio: periodoInicio,
          periodo_fin: periodoFin,
          importe_factura: importeNum,
          estatus_actual: "capturada",
          created_by: createdBy,
        })
        .select("id")
        .single();

      if (error) {
        setMensaje("No se pudo guardar la factura: " + error.message);
      } else {
        // Paso 2: capturar el detalle de servicios de esta factura.
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

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        background: "#fff",
        border: "1px solid #e2e4e2",
        borderRadius: 12,
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 20, marginTop: 0 }}>Captura de factura</h1>
      <p style={{ fontSize: 13, color: "#5a615e", marginTop: 4 }}>
        Capítulo Servicios Integrales
      </p>

      <form onSubmit={handleSubmit}>
        {/* Capítulo (fijo, no editable) */}
        <label style={etiqueta}>Capítulo</label>
        <input type="text" value={CAPITULO_ETIQUETA} readOnly style={soloLectura} />

        {/* Cuenta / partida */}
        <label style={etiqueta}>Cuenta / partida</label>
        <select
          required
          value={partidaId}
          onChange={(e) => setPartidaId(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #d8dbd9", marginTop: 4 }}
        >
          <option value="">Selecciona una partida…</option>
          {partidas.map((p) => (
            <option key={p.id} value={p.id}>
              {[p.cuenta_prei, p.nombre].filter(Boolean).join(" — ")}
            </option>
          ))}
        </select>

        {/* Contrato */}
        <label style={etiqueta}>Contrato</label>
        <select
          required
          value={contratoId}
          onChange={onCambiarContrato}
          disabled={!partidaId}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #d8dbd9", marginTop: 4 }}
        >
          <option value="">
            {partidaId ? "Selecciona un contrato…" : "Primero elige una partida"}
          </option>
          {contratos.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.numero_interno, c.adquisicion_servicio].filter(Boolean).join(" — ")}
            </option>
          ))}
        </select>

        {/* Proveedor (autocompletado, solo lectura) */}
        <label style={etiqueta}>Proveedor</label>
        <input
          type="text"
          value={proveedor ? proveedor.razon_social || "" : ""}
          readOnly
          placeholder="Se completa al elegir el contrato"
          style={soloLectura}
        />

        {/* Folio de factura del proveedor */}
        <label style={etiqueta}>Folio de factura del proveedor</label>
        <input
          type="text"
          required
          value={folioProveedor}
          onChange={(e) => setFolioProveedor(e.target.value)}
        />

        {/* Periodo */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={etiqueta}>Periodo — inicio</label>
            <input
              type="date"
              required
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={etiqueta}>Periodo — fin</label>
            <input
              type="date"
              required
              value={periodoFin}
              onChange={(e) => setPeriodoFin(e.target.value)}
            />
          </div>
        </div>

        {/* Importe */}
        <label style={etiqueta}>Importe capturado</label>
        <input
          type="number"
          required
          step="0.01"
          min="0"
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
        />

        <div style={{ height: 22 }} />
        <button
          type="submit"
          disabled={cargando}
          className="boton"
          style={{ width: "100%" }}
        >
          {cargando ? "Guardando…" : "Guardar factura"}
        </button>
      </form>

      {mensaje && (
        <p style={{ fontSize: 12, color: "var(--rojo)", marginTop: 16 }}>
          {mensaje}
        </p>
      )}
    </div>
  );
}
