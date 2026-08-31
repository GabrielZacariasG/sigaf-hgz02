"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";

const TOLERANCIA = 1.0; // $1.00 MXN

const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function DetalleFacturaPage() {
  const params = useParams();
  const facturaId = params.id;
  const router = useRouter();

  const [factura, setFactura] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [subtotal, setSubtotal] = useState("");   // SUBTOTAL capturado (antes de IVA)
  const [tasaIva, setTasaIva] = useState("0.16");  // 0.16 | 0
  const [filtro, setFiltro] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      const { data: fac, error: errFac } = await supabase
        .from("facturas")
        .select(
          "id, folio_ingreso, folio_proveedor, contrato_id, importe_factura, tasa_iva, subtotal_calculado, vigencia_alerta, contratos ( numero_interno, adquisicion_servicio )"
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
      if (fac.tasa_iva != null) setTasaIva(String(fac.tasa_iva));
      if (fac.subtotal_calculado != null && Number(fac.subtotal_calculado) > 0) {
        setSubtotal(String(fac.subtotal_calculado));
      }

      const { data: servs } = await supabase
        .from("contrato_servicios")
        .select("id, nombre_servicio, precio_unitario")
        .eq("contrato_id", fac.contrato_id)
        .order("nombre_servicio", { ascending: true });
      if (!activo) return;
      setServicios(servs || []);
      setCargando(false);
    }
    cargar();
    return () => { activo = false; };
  }, [facturaId]);

  // Validación principal: SUBTOTAL × (1+IVA) debe = TOTAL capturado.
  const calc = useMemo(() => {
    const tasa = parseFloat(tasaIva) || 0;
    const sub = parseFloat(subtotal) || 0;
    const iva = sub * tasa;
    const total = sub + iva;
    const totalFactura = Number(factura?.importe_factura) || 0;
    const diferencia = total - totalFactura;
    return { sub, iva, total, totalFactura, diferencia, ok: sub > 0 && Math.abs(diferencia) <= TOLERANCIA };
  }, [subtotal, tasaIva, factura]);

  // Suma de servicios (opcional): ayuda a llenar el subtotal.
  const sumaServicios = useMemo(() => {
    let s = 0;
    for (const sv of servicios) {
      const c = parseFloat(cantidades[sv.id]);
      if (!Number.isNaN(c) && c > 0) s += c * Number(sv.precio_unitario);
    }
    return s;
  }, [servicios, cantidades]);

  const serviciosFiltrados = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return servicios;
    return servicios.filter((s) => s.nombre_servicio.toLowerCase().includes(f));
  }, [servicios, filtro]);

  async function guardar() {
    setMensaje(""); setResultado(null); setGuardando(true);
    try {
      const tasa = parseFloat(tasaIva) || 0;
      const sub = parseFloat(subtotal);
      if (Number.isNaN(sub) || sub <= 0) { setMensaje("Captura el subtotal de la factura."); setGuardando(false); return; }
      const iva = Math.round(sub * tasa * 100) / 100;
      const total = Math.round((sub + iva) * 100) / 100;
      const ok = Math.abs(total - (Number(factura.importe_factura) || 0)) <= TOLERANCIA;

      const { error } = await supabase
        .from("facturas")
        .update({
          subtotal_calculado: sub,
          iva_calculado: iva,
          total_calculado: total,
          tasa_iva: tasa,
          validacion_ok: ok,
        })
        .eq("id", facturaId);
      if (error) throw new Error("Al guardar: " + error.message);
      setResultado({ subtotal_calculado: sub, iva_calculado: iva, total_calculado: total, validacion_ok: ok, diferencia: total - Number(factura.importe_factura) });
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
        <button className="boton secundario" onClick={() => router.push("/")}>Volver al panel</button>
      </div>
    );
  }

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "16px 18px", margin: "12px 0" };
  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "8px 10px", borderBottom: "1px solid var(--borde)" };
  const td = { padding: "6px 10px", borderBottom: "1px solid var(--borde)", fontSize: 14 };
  const bigInput = { width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 18, textAlign: "right" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: 0 }}>Paso 2 de 2</p>
      <h1 style={{ fontSize: 22, margin: "2px 0 4px" }}>Validación de la factura</h1>

      {/* Resumen */}
      <div style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
        <div><strong>Folio de ingreso:</strong> {factura.folio_ingreso}</div>
        <div><strong>Folio proveedor:</strong> {factura.folio_proveedor}</div>
        <div style={{ gridColumn: "1 / -1" }}><strong>Contrato:</strong> {factura.contratos?.numero_interno} — {factura.contratos?.adquisicion_servicio}</div>
        <div style={{ gridColumn: "1 / -1", marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--borde)" }}>
          <strong>Total de la factura (capturado):</strong>{" "}
          <span style={{ fontSize: 18, fontWeight: 700 }}>{money(factura.importe_factura)}</span>{" "}
          <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>(con IVA)</span>
        </div>
      </div>

      {factura.vigencia_alerta === "sin_vigencia" && (
        <div style={{ background: "var(--rojo-claro)", color: "var(--rojo)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          ⚠️ El periodo de la factura cae <strong>fuera de la vigencia</strong> del contrato.
        </div>
      )}

      {/* Captura del subtotal + validación */}
      <div style={card}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
          Captura el SUBTOTAL de la factura (antes de IVA)
        </label>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input type="number" step="0.01" min="0" value={subtotal} placeholder="0.00"
              onChange={(e) => { setResultado(null); setSubtotal(e.target.value); }} style={bigInput} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--texto-suave)", marginRight: 6 }}>IVA:</label>
            <select value={tasaIva} onChange={(e) => { setResultado(null); setTasaIva(e.target.value); }}
              style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid var(--borde)" }}>
              <option value="0.16">16%</option>
              <option value="0">No aplica (0%)</option>
            </select>
          </div>
        </div>

        {/* Cálculo en vivo */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 4, fontSize: 14, maxWidth: 380, marginLeft: "auto" }}>
          <span style={{ color: "var(--texto-suave)" }}>Subtotal capturado</span>
          <span style={{ textAlign: "right" }}>{money(calc.sub)}</span>
          <span style={{ color: "var(--texto-suave)" }}>IVA ({(parseFloat(tasaIva) * 100).toFixed(0)}%)</span>
          <span style={{ textAlign: "right" }}>{money(calc.iva)}</span>
          <span style={{ fontWeight: 700 }}>Total calculado</span>
          <span style={{ textAlign: "right", fontWeight: 700 }}>{money(calc.total)}</span>
          <span style={{ color: "var(--texto-suave)" }}>Total de la factura</span>
          <span style={{ textAlign: "right" }}>{money(calc.totalFactura)}</span>
        </div>

        <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, fontSize: 13,
          background: calc.ok ? "var(--verde-claro)" : "var(--rojo-claro)",
          color: calc.ok ? "var(--verde-oscuro)" : "var(--rojo)", maxWidth: 380, marginLeft: "auto" }}>
          {calc.sub <= 0
            ? "Captura el subtotal para validar."
            : calc.ok
              ? `✓ Cuadra: subtotal + IVA = ${money(calc.total)} (diferencia ${money(calc.diferencia)}).`
              : `✗ No cuadra: diferencia de ${money(calc.diferencia)} contra el total capturado.`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="boton" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar y validar"}
        </button>
        <button className="boton secundario" onClick={() => router.push(`/facturas/${facturaId}`)} disabled={guardando}>Ver factura</button>
        <button className="boton secundario" onClick={() => router.push("/facturas/nueva")} disabled={guardando}>Capturar otra</button>
      </div>

      {resultado && (
        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, fontSize: 14,
          background: resultado.validacion_ok ? "var(--verde-claro)" : "var(--rojo-claro)",
          color: resultado.validacion_ok ? "var(--verde-oscuro)" : "var(--rojo)" }}>
          <strong>{resultado.validacion_ok ? "Guardado y validado ✓" : "Guardado — con discrepancia ✗"}</strong>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Subtotal {money(resultado.subtotal_calculado)} · IVA {money(resultado.iva_calculado)} ·
            Total {money(resultado.total_calculado)} · Diferencia {money(resultado.diferencia)}
          </div>
        </div>
      )}

      {mensaje && <p style={{ fontSize: 13, color: "var(--rojo)", marginTop: 14 }}>{mensaje}</p>}

      {/* Desglose de servicios (OPCIONAL) — ayuda a calcular el subtotal */}
      {servicios.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Desglose por servicio <span style={{ fontSize: 12, color: "var(--texto-suave)", fontWeight: 400 }}>(opcional)</span></h2>
            <div style={{ fontSize: 13 }}>
              Suma (con IVA): <strong>{money(sumaServicios)}</strong>{" "}
              {sumaServicios > 0 && (
                <button className="boton secundario" style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => { const t = parseFloat(tasaIva) || 0; setResultado(null); setSubtotal(String(Math.round((sumaServicios / (1 + t)) * 100) / 100)); }}>
                  Calcular subtotal (÷ IVA)
                </button>
              )}
            </div>
          </div>
          {/* Validación 2: la suma del desglose (precios CON IVA) debe cuadrar con el TOTAL */}
          {sumaServicios > 0 && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 13,
              background: Math.abs(sumaServicios - calc.totalFactura) <= TOLERANCIA ? "var(--verde-claro)" : "var(--rojo-claro)",
              color: Math.abs(sumaServicios - calc.totalFactura) <= TOLERANCIA ? "var(--verde-oscuro)" : "var(--rojo)" }}>
              {Math.abs(sumaServicios - calc.totalFactura) <= TOLERANCIA
                ? `✓ La suma del desglose (${money(sumaServicios)}) coincide con el TOTAL de la factura.`
                : `✗ La suma del desglose (${money(sumaServicios)}) difiere del TOTAL de la factura (${money(calc.totalFactura)}) por ${money(sumaServicios - calc.totalFactura)}.`}
            </div>
          )}
          <input type="text" placeholder="Buscar servicio…" value={filtro} onChange={(e) => setFiltro(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--borde)", margin: "8px 0" }} />
          <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>Servicio</th>
                  <th style={{ ...th, textAlign: "right" }}>Precio</th>
                  <th style={{ ...th, textAlign: "right", width: 100 }}>Cantidad</th>
                  <th style={{ ...th, textAlign: "right" }}>Importe</th>
                </tr></thead>
                <tbody>
                  {serviciosFiltrados.map((s) => {
                    const cant = parseFloat(cantidades[s.id]);
                    const imp = !Number.isNaN(cant) && cant > 0 ? cant * Number(s.precio_unitario) : 0;
                    return (
                      <tr key={s.id}>
                        <td style={td}>{s.nombre_servicio}</td>
                        <td style={{ ...td, textAlign: "right" }}>{money(s.precio_unitario)}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <input type="number" min="0" step="0.01" value={cantidades[s.id] ?? ""}
                            onChange={(e) => setCantidades((p) => ({ ...p, [s.id]: e.target.value }))}
                            style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--borde)", textAlign: "right" }} />
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>{money(imp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 6 }}>
            Los precios del catálogo <strong>ya incluyen IVA</strong>, por eso la suma del desglose cuadra con el <strong>TOTAL</strong> de la factura (no con el subtotal). El botón "Calcular subtotal" saca el subtotal dividiendo la suma entre 1.16.
          </p>
        </div>
      )}
    </div>
  );
}
