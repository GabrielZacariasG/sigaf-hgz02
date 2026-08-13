"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function DisponibilidadIndexPage() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [cuentas, setCuentas] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Sesión no iniciada."); setCargando(false); return; }

      const [rF, rD] = await Promise.all([
        supabase.from("facturas").select(
          "importe_factura, es_pasivo, estatus_general, partida_id, partidas ( id, cuenta_finat, nombre )"
        ),
        supabase.from("disponibilidad_presupuestal").select("cuenta_prei, presupuesto, disponible, periodo"),
      ]);
      if (rF.error) { setError("No se pudieron leer las facturas: " + rF.error.message); setCargando(false); return; }

      const dispByCuenta = {};
      (rD.data || []).forEach((d) => { dispByCuenta[d.cuenta_prei] = d; });

      const map = {};
      for (const f of rF.data || []) {
        const p = f.partidas;
        if (!p) continue;
        const c = (map[p.id] ||= { id: p.id, cuenta: p.cuenta_finat, nombre: p.nombre, n: 0, gasto: 0, pasivo: 0, reflejado: 0 });
        c.n++; c.gasto += Number(f.importe_factura || 0);
        if (f.es_pasivo) c.pasivo += Number(f.importe_factura || 0);
        if (f.estatus_general === "gasto_reflejado") c.reflejado += Number(f.importe_factura || 0);
      }
      const filas = Object.values(map).map((c) => {
        const d = c.cuenta ? dispByCuenta[c.cuenta] : null;
        return { ...c, presupuesto: d ? Number(d.presupuesto) : null, disponible: d ? Number(d.disponible) : null };
      }).sort((a, b) => b.gasto - a.gasto);

      setCuentas(filas);
      setCargando(false);
    })();
  }, []);

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "10px 12px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontSize: 14, verticalAlign: "top" };

  const totGasto = cuentas.reduce((a, c) => a + c.gasto, 0);
  const totPasivo = cuentas.reduce((a, c) => a + c.pasivo, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Disponibilidad presupuestal</h1>
          <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>Servicios Integrales · ejercicio 2026 · {cuentas.length} cuenta(s) con facturas</div>
        </div>
        <Link href="/disponibilidad/cargar" className="boton" style={{ textDecoration: "none" }}>Cargar disponibilidad (dispo)</Link>
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}

      {cuentas.length === 0 ? (
        <p style={{ color: "var(--texto-suave)", marginTop: 16 }}>Aún no hay facturas cargadas por cuenta.</p>
      ) : (
        <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden", marginTop: 14 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Cuenta</th><th style={th}>Servicio</th>
                  <th style={{ ...th, textAlign: "right" }}>Facturas</th>
                  <th style={{ ...th, textAlign: "right" }}>Presupuesto</th>
                  <th style={{ ...th, textAlign: "right" }}>Gasto</th>
                  <th style={{ ...th, textAlign: "right" }}>Pasivo</th>
                  <th style={{ ...th, textAlign: "right" }}>Reflejado (FINAT)</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>
                      <Link href={`/disponibilidad/${c.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>{c.cuenta || "(sin cuenta)"}</Link>
                    </td>
                    <td style={td}>{c.nombre}</td>
                    <td style={{ ...td, textAlign: "right" }}>{c.n}</td>
                    <td style={{ ...td, textAlign: "right" }}>{c.presupuesto != null ? money(c.presupuesto) : <span style={{ color: "var(--texto-suave)" }}>—</span>}</td>
                    <td style={{ ...td, textAlign: "right" }}>{money(c.gasto)}</td>
                    <td style={{ ...td, textAlign: "right", color: c.pasivo > 0 ? "#B45309" : "inherit" }}>{money(c.pasivo)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{money(c.reflejado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td style={td} colSpan={4}>Total</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(totGasto)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#B45309" }}>{money(totPasivo)}</td>
                  <td style={td}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 12 }}>
        Cada cuenta enlaza a su detalle: gasto vs FINAT, partición pasivo/corriente y las facturas. El presupuesto viene del
        reporte <code>dispo</code>; súbelo con el botón de arriba para actualizar todas las cuentas de una vez.
      </p>
    </div>
  );
}
