"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";

const TOLERANCIA = 1.0; // $1.00 MXN, misma que el trigger de la BD

const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function DetalleFacturaPage() {
  const params = useParams();
  const facturaId = params.id;
  const router = useRouter();

  const [factura, setFactura] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [cantidades, setCantidades] = useState({}); // { contrato_servicio_id: "cantidad" }
  const [tasaIva, setTasaIva] = useState("0.16"); // '0.16' | '0'
  const [filtro, setFiltro] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [resultado, setResultado] = useState(null); // totales confirmados por la BD

  // Carga inicial: factura + contrato, catálogo de servicios y detalle previo.
  useEffect(() => {
    let activo = true;

    async function cargar() {
      const { data: fac, error: errFac } = await supabase
        .from("facturas")
        .select(
          "id, folio_ingreso, folio_proveedor, contrato_id, importe_factura, tasa_iva, vigencia_alerta, contratos ( numero_interno, adquisicion_servicio )"
        )
        .eq("id", facturaId)
        .single();

      if (!activo) return;
      if (errFac || !fac) {
        setMensaje("No se pudo cargar la factura: " + (errFac?.message || "no existe"));
        setCargando(false);
        return;
      }
      setFactura(fac);
      setTasaIva(String(fac.tasa_iva ?? 0.16));

      const { data: servs, error: errServ } = await supabase
        .from("contrato_servicios")
        .select("id, nombre_servicio, precio_unitario")
        .eq("contrato_id", fac.contrato_id)
        .order("nombre_servicio", { ascending: true });

      if (!activo) return;
      if (errServ) {
        setMensaje("No se pudieron cargar los servicios del contrato: " + errServ.message);
        setCargando(false);
        return;
      }
      setServicios(servs || []);

      // Detalle previo (si se reabre la factura para corregir).
      const { data: det } = await supabase
        .from("factura_detalle")
        .select("contrato_servicio_id, cantidad")
        .eq("factura_id", facturaId);

      if (!activo) return;
      if (det && det.length > 0) {
        const previas = {};
        det.forEach((d) => {
          previas[d.contrato_servicio_id] = String(d.cantidad);
        });
        setCantidades(previas);
      }
      setCargando(false);
    }

    cargar();
    return () => {
      activo = false;
    };
  }, [facturaId]);

  // Vista previa del cálculo (solo visual; la BD es la fuente de verdad al guardar).
  const preview = useMemo(() => {
    const tasa = parseFloat(tasaIva) || 0;
    let subtotal = 0;
    for (const s of servicios) {
      const cant = parseFloat(cantidades[s.id]);
      if (!Number.isNaN(cant) && cant > 0) subtotal += cant * Number(s.precio_unitario);
    }
    const iva = subtotal * tasa;
    const total = subtotal + iva;
    const importe = Number(factura?.importe_factura) || 0;
    const diferencia = total - importe;
    return { subtotal, iva, total, diferencia, ok: Math.abs(diferencia) <= TOLERANCIA };
  }, [servicios, cantidades, tasaIva, factura]);

  const serviciosFiltrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return servicios;
    return servicios.filter((s) => s.nombre_servicio.toLowerCase().includes(f));
  }, [servicios, filtro]);

  function setCantidad(id, valor) {
    setResultado(null); // cambió la captura: el resultado guardado deja de aplicar
    setCantidades((prev) => ({ ...prev, [id]: valor }));
  }

  async function guardar() {
    setMensaje("");
    setResultado(null);
    setGuardando(true);
    try {
      // ORDEN IMPORTANTE: primero fijamos tasa_iva; el trigger de recálculo
      // lee facturas.tasa_iva cuando cambia factura_detalle, y actualizar la
      // tasa por sí sola NO re-dispara el recálculo.
      const { error: errIva } = await supabase
        .from("facturas")
        .update({ tasa_iva: parseFloat(tasaIva) })
        .eq("id", facturaId);
      if (errIva) throw new Error("Al guardar el IVA: " + errIva.message);

      // Reemplazamos el detalle: borramos el previo e insertamos el actual.
      const { error: errDel } = await supabase
        .from("factura_detalle")
        .delete()
        .eq("factura_id", facturaId);
      if (errDel) throw new Error("Al limpiar el detalle previo: " + errDel.message);

      const filas = servicios
        .map((s) => ({ id: s.id, cant: parseFloat(cantidades[s.id]) }))
        .filter((x) => !Number.isNaN(x.cant) && x.cant > 0)
        .map((x) => ({
          factura_id: facturaId,
          contrato_servicio_id: x.id,
          cantidad: x.cant,
          // importe_calculado lo calcula el trigger (cantidad × precio_unitario)
        }));

      if (filas.length > 0) {
        const { error: errIns } = await supabase.from("factura_detalle").insert(filas);
        if (errIns) throw new Error("Al guardar el detalle: " + errIns.message);
      }

      // Releemos los totales que la BD calculó vía triggers.
      const { data: fac, error: errRe } = await supabase
        .from("facturas")
        .select(
          "subtotal_calculado, iva_calculado, total_calculado, diferencia_importe, validacion_ok, importe_factura"
        )
        .eq("id", facturaId)
        .single();
      if (errRe) throw new Error("Al releer los totales: " + errRe.message);

      setResultado(fac);
    } catch (err) {
      setMensaje(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  if (!factura) {
    return (
      <div>
        <p style={{ color: "var(--rojo)" }}>{mensaje || "Factura no encontrada."}</p>
        <button className="boton secundario" onClick={() => router.push("/")}>
          Volver al panel
        </button>
      </div>
    );
  }

  // Contratos sin catálogo de servicios (Área Médica, Subrogados, Cuadro Básico
  // en su mayoría): la factura ya quedó registrada con su importe en el paso 1.
  // No se valida cantidad × precio; se registra por importe.
  if (servicios.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: 0 }}>Paso 2 de 2</p>
        <h1 style={{ fontSize: 22, margin: "2px 0 4px" }}>Factura registrada</h1>
        <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px", margin: "12px 0", fontSize: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><strong>Folio de ingreso:</strong> {factura.folio_ingreso}</div>
          <div><strong>Folio proveedor:</strong> {factura.folio_proveedor}</div>
          <div><strong>Contrato:</strong> {factura.contratos?.numero_interno} — {factura.contratos?.adquisicion_servicio}</div>
          <div><strong>Importe:</strong> {money(factura.importe_factura)}</div>
        </div>
        {factura.vigencia_alerta === "sin_vigencia" && (
          <div style={{ background: "var(--rojo-claro)", color: "var(--rojo)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
            ⚠️ El periodo de la factura cae <strong>fuera de la vigencia</strong> del contrato.
          </div>
        )}
        <div style={{ background: "var(--verde-claro)", color: "var(--verde-oscuro)", padding: "12px 16px", borderRadius: 8, fontSize: 13 }}>
          ✓ Este contrato no tiene catálogo de servicios con precio, así que la factura se
          <strong> registra por importe</strong> (sin desglose cantidad × precio). Ya quedó guardada.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button className="boton" onClick={() => router.push(`/facturas/${facturaId}`)}>Ver factura</button>
          <button className="boton secundario" onClick={() => router.push("/facturas/nueva")}>Capturar otra</button>
          <button className="boton secundario" onClick={() => router.push("/")}>Ir al panel</button>
        </div>
        {mensaje && <p style={{ fontSize: 13, color: "var(--rojo)", marginTop: 14 }}>{mensaje}</p>}
      </div>
    );
  }

  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "1px solid var(--borde)" };
  const td = { padding: "6px 10px", borderBottom: "1px solid var(--borde)", fontSize: 14 };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: 0 }}>Paso 2 de 2</p>
      <h1 style={{ fontSize: 22, margin: "2px 0 4px" }}>Detalle de servicios y validación</h1>

      {/* Resumen de la factura */}
      <div
        style={{
          background: "var(--blanco)",
          border: "1px solid var(--borde)",
          borderRadius: 10,
          padding: "14px 16px",
          margin: "12px 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          fontSize: 14,
        }}
      >
        <div><strong>Folio de ingreso:</strong> {factura.folio_ingreso}</div>
        <div><strong>Folio proveedor:</strong> {factura.folio_proveedor}</div>
        <div><strong>Contrato:</strong> {factura.contratos?.numero_interno} — {factura.contratos?.adquisicion_servicio}</div>
        <div><strong>Importe capturado:</strong> {money(factura.importe_factura)}</div>
      </div>

      {/* Alerta de vigencia (calculada por el trigger al capturar la factura) */}
      {factura.vigencia_alerta === "sin_vigencia" && (
        <div style={{ background: "var(--rojo-claro)", color: "var(--rojo)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          ⚠️ El periodo de la factura cae <strong>fuera de la vigencia</strong> del contrato.
        </div>
      )}
      {factura.vigencia_alerta === "por_vencer" && (
        <div style={{ background: "var(--ambar-claro)", color: "var(--ambar)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          ⚠️ La vigencia del contrato está <strong>por vencer</strong> (30 días o menos).
        </div>
      )}

      {/* Selector de IVA (a nivel factura) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 12px" }}>
        <label style={{ fontSize: 13, color: "var(--texto-suave)" }}>IVA de la factura:</label>
        <select
          value={tasaIva}
          onChange={(e) => { setResultado(null); setTasaIva(e.target.value); }}
          style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--borde)" }}
        >
          <option value="0.16">16%</option>
          <option value="0">No aplica</option>
        </select>
      </div>

      {/* Buscador de servicios (los contratos pueden tener cientos) */}
      <input
        type="text"
        placeholder="Buscar servicio…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--borde)", marginBottom: 8 }}
      />

      {/* Tabla de servicios del contrato */}
      <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Servicio</th>
                <th style={{ ...th, textAlign: "right" }}>Precio unitario</th>
                <th style={{ ...th, textAlign: "right", width: 110 }}>Cantidad</th>
                <th style={{ ...th, textAlign: "right" }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {serviciosFiltrados.length === 0 && (
                <tr><td style={td} colSpan={4}>Sin servicios que coincidan.</td></tr>
              )}
              {serviciosFiltrados.map((s) => {
                const cant = parseFloat(cantidades[s.id]);
                const importeLinea = !Number.isNaN(cant) && cant > 0 ? cant * Number(s.precio_unitario) : 0;
                return (
                  <tr key={s.id}>
                    <td style={td}>{s.nombre_servicio}</td>
                    <td style={{ ...td, textAlign: "right" }}>{money(s.precio_unitario)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cantidades[s.id] ?? ""}
                        onChange={(e) => setCantidad(s.id, e.target.value)}
                        style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--borde)", textAlign: "right" }}
                      />
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{money(importeLinea)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales (vista previa en vivo) */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 4, fontSize: 14, maxWidth: 360, marginLeft: "auto" }}>
        <span style={{ color: "var(--texto-suave)" }}>Subtotal</span>
        <span style={{ textAlign: "right" }}>{money(preview.subtotal)}</span>
        <span style={{ color: "var(--texto-suave)" }}>IVA ({(parseFloat(tasaIva) * 100).toFixed(0)}%)</span>
        <span style={{ textAlign: "right" }}>{money(preview.iva)}</span>
        <span style={{ fontWeight: 700 }}>Total calculado</span>
        <span style={{ textAlign: "right", fontWeight: 700 }}>{money(preview.total)}</span>
        <span style={{ color: "var(--texto-suave)" }}>Importe capturado</span>
        <span style={{ textAlign: "right" }}>{money(factura.importe_factura)}</span>
      </div>

      {/* Validación (vista previa) */}
      <div
        style={{
          marginTop: 10,
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 13,
          background: preview.ok ? "var(--verde-claro)" : "var(--rojo-claro)",
          color: preview.ok ? "var(--verde-oscuro)" : "var(--rojo)",
          maxWidth: 360,
          marginLeft: "auto",
        }}
      >
        {preview.ok
          ? `✓ Coincide con el importe capturado (diferencia ${money(preview.diferencia)}, dentro de ±${money(TOLERANCIA)}).`
          : `✗ Discrepancia de ${money(preview.diferencia)} (tolerancia ±${money(TOLERANCIA)}).`}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="boton" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar detalle y validar"}
        </button>
        <button className="boton secundario" onClick={() => router.push("/")} disabled={guardando}>
          Volver al panel
        </button>
      </div>

      {/* Resultado confirmado por la BD */}
      {resultado && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 14,
            background: resultado.validacion_ok ? "var(--verde-claro)" : "var(--rojo-claro)",
            color: resultado.validacion_ok ? "var(--verde-oscuro)" : "var(--rojo)",
          }}
        >
          <strong>{resultado.validacion_ok ? "Detalle guardado y validado ✓" : "Detalle guardado — con discrepancia ✗"}</strong>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Subtotal {money(resultado.subtotal_calculado)} · IVA {money(resultado.iva_calculado)} ·
            Total {money(resultado.total_calculado)} · Diferencia {money(resultado.diferencia_importe)}
          </div>
        </div>
      )}

      {mensaje && (
        <p style={{ fontSize: 13, color: "var(--rojo)", marginTop: 14 }}>{mensaje}</p>
      )}
    </div>
  );
}
