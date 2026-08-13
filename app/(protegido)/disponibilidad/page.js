"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const CAP_INTEGRALES = new Set(["Servicios Integrales", "Integrales"]);

// Lee TODAS las facturas paginando (Supabase limita a 1000 filas por consulta).
async function leerTodasLasFacturas() {
  const pageSize = 1000;
  let desde = 0;
  const todas = [];
  for (;;) {
    const { data, error } = await supabase
      .from("facturas")
      .select(
        "importe_factura, es_pasivo, estatus_general, partida_id, partidas ( id, cuenta_finat, nombre, capitulo_id, capitulos ( nombre ) )"
      )
      .range(desde, desde + pageSize - 1);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < pageSize) break;
    desde += pageSize;
  }
  return todas;
}

export default function DisponibilidadIndexPage() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [capitulos, setCapitulos] = useState([]); // [{ nombre, cuentas:[], tot... }]

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setError("Sesión no iniciada."); setCargando(false); return; }

        const [facturas, rD, rC] = await Promise.all([
          leerTodasLasFacturas(),
          supabase.from("disponibilidad_presupuestal").select("cuenta_prei, presupuesto, disponible, periodo"),
          supabase.from("contratos").select("partida_id, monto_maximo"),
        ]);

        const dispByCuenta = {};
        (rD.data || []).forEach((d) => { dispByCuenta[d.cuenta_prei] = d; });

        // Techo por partida = suma de montos máximos de sus contratos (comprometido)
        const techoByPartida = {};
        (rC.data || []).forEach((c) => {
          if (c.monto_maximo != null) techoByPartida[c.partida_id] = (techoByPartida[c.partida_id] || 0) + Number(c.monto_maximo);
        });

        // Agrupar: capítulo -> partida
        const capMap = {};
        for (const f of facturas) {
          const p = f.partidas;
          if (!p) continue;
          const capNombre = p.capitulos?.nombre || "Sin capítulo";
          const cap = (capMap[capNombre] ||= { nombre: capNombre, cuentasMap: {} });
          const c = (cap.cuentasMap[p.id] ||= {
            id: p.id, cuenta: p.cuenta_finat, nombre: p.nombre,
            n: 0, gasto: 0, pasivo: 0, reflejado: 0, nEnTramite: 0,
          });
          c.n++; c.gasto += Number(f.importe_factura || 0);
          if (f.es_pasivo) c.pasivo += Number(f.importe_factura || 0);
          if (f.estatus_general === "gasto_reflejado") c.reflejado += Number(f.importe_factura || 0);
          else c.nEnTramite++;
        }

        // Orden de capítulos: Integrales primero, luego alfabético
        const orden = { "Servicios Integrales": 0, "Integrales": 0, "Área Médica": 1, "Subrogados": 2 };
        const lista = Object.values(capMap).map((cap) => {
          const cuentas = Object.values(cap.cuentasMap).map((c) => {
            const d = c.cuenta ? dispByCuenta[c.cuenta] : null;
            const techo = techoByPartida[c.id] || 0;
            return { ...c, presupuesto: d ? Number(d.presupuesto) : null, disponible: d ? Number(d.disponible) : null, techo, saldo: techo - c.gasto };
          }).sort((a, b) => b.gasto - a.gasto);
          const t = cuentas.reduce((a, c) => ({
            n: a.n + c.n, gasto: a.gasto + c.gasto, pasivo: a.pasivo + c.pasivo,
            reflejado: a.reflejado + c.reflejado, presupuesto: a.presupuesto + (c.presupuesto || 0),
            disponible: a.disponible + (c.disponible || 0), nEnTramite: a.nEnTramite + (c.nEnTramite || 0),
            techo: a.techo + (c.techo || 0), saldo: a.saldo + (c.saldo || 0),
          }), { n: 0, gasto: 0, pasivo: 0, reflejado: 0, presupuesto: 0, disponible: 0, nEnTramite: 0, techo: 0, saldo: 0 });
          return { nombre: cap.nombre, cuentas, tot: t };
        }).sort((a, b) => (orden[a.nombre] ?? 9) - (orden[b.nombre] ?? 9) || a.nombre.localeCompare(b.nombre));

        setCapitulos(lista);
        setCargando(false);
      } catch (e) {
        setError("No se pudieron leer los datos: " + (e.message || e));
        setCargando(false);
      }
    })();
  }, []);

  if (cargando) return <p style={{ padding: 8 }}>Cargando…</p>;

  const th = { textAlign: "left", fontSize: 12, color: "var(--texto-suave)", padding: "10px 12px", borderBottom: "1px solid var(--borde)", whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", borderBottom: "1px solid var(--borde)", fontSize: 14, verticalAlign: "top" };

  // Totales globales (todos los capítulos)
  const G = capitulos.reduce((a, cap) => ({
    n: a.n + cap.tot.n, gasto: a.gasto + cap.tot.gasto, pasivo: a.pasivo + cap.tot.pasivo,
    reflejado: a.reflejado + cap.tot.reflejado, presupuesto: a.presupuesto + cap.tot.presupuesto,
    disponible: a.disponible + cap.tot.disponible, nEnTramite: a.nEnTramite + cap.tot.nEnTramite,
    cuentas: a.cuentas + cap.cuentas.length,
  }), { n: 0, gasto: 0, pasivo: 0, reflejado: 0, presupuesto: 0, disponible: 0, nEnTramite: 0, cuentas: 0 });
  const totEnTramite = G.gasto - G.reflejado;
  const pctEjercido = G.presupuesto > 0 ? Math.round((G.gasto / G.presupuesto) * 1000) / 10 : null;

  const kpi = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "14px 16px" };
  const kNum = { fontSize: 20, fontWeight: 700 };
  const kLbl = { fontSize: 12, color: "var(--texto-suave)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Disponibilidad presupuestal</h1>
          <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
            Ejercicio 2026 · {capitulos.length} capítulo(s) · {G.cuentas} cuenta(s) · {G.n} facturas
          </div>
        </div>
        <Link href="/disponibilidad/cargar" className="boton" style={{ textDecoration: "none" }}>Cargar disponibilidad (dispo)</Link>
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}

      {capitulos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 16 }}>
          <div style={kpi}><div style={kLbl}>Presupuesto 2026</div><div style={kNum}>{money(G.presupuesto)}</div></div>
          <div style={kpi}><div style={kLbl}>Gasto total</div><div style={kNum}>{money(G.gasto)}</div>{pctEjercido != null && <div style={{ ...kLbl, marginTop: 3 }}>{pctEjercido}% ejercido</div>}</div>
          <div style={kpi}><div style={kLbl}>Pasivo (periodo anterior)</div><div style={{ ...kNum, color: "#B45309" }}>{money(G.pasivo)}</div></div>
          <div style={kpi}><div style={kLbl}>Disponible</div><div style={{ ...kNum, color: "var(--verde)" }}>{money(G.disponible)}</div></div>
          <div style={kpi}><div style={kLbl}>En trámite (aún no en FINAT)</div><div style={{ ...kNum, color: totEnTramite > 0 ? "var(--rojo)" : "inherit" }}>{money(totEnTramite)}</div><div style={{ ...kLbl, marginTop: 3 }}>{G.nEnTramite} factura(s)</div></div>
        </div>
      )}

      {capitulos.length === 0 ? (
        <p style={{ color: "var(--texto-suave)", marginTop: 16 }}>Aún no hay facturas cargadas por cuenta.</p>
      ) : (
        capitulos.map((cap) => {
          const esInt = CAP_INTEGRALES.has(cap.nombre);
          return (
          <section key={cap.nombre} style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>{cap.nombre}</h2>
              <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>
                {cap.cuentas.length} cuenta(s) · {cap.tot.n} facturas · gasto {money(cap.tot.gasto)}
                {!esInt && " · sin pedido/recepción"}
              </div>
            </div>
            <div style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Cuenta</th><th style={th}>Servicio</th>
                      <th style={{ ...th, textAlign: "right" }}>Facturas</th>
                      <th style={{ ...th, textAlign: "right" }}>{esInt ? "Presupuesto" : "Techo contrato"}</th>
                      <th style={{ ...th, textAlign: "right" }}>Gasto</th>
                      <th style={{ ...th, textAlign: "right" }}>{esInt ? "Pasivo" : "Saldo"}</th>
                      <th style={{ ...th, textAlign: "right" }}>Reflejado (FINAT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cap.cuentas.map((c) => (
                      <tr key={c.id}>
                        <td style={td}>
                          <Link href={`/disponibilidad/${c.id}`} style={{ color: "var(--verde)", fontWeight: 600 }}>{c.cuenta || "(sin cuenta)"}</Link>
                        </td>
                        <td style={td}>{c.nombre}</td>
                        <td style={{ ...td, textAlign: "right" }}>{c.n}</td>
                        {esInt ? (
                          <td style={{ ...td, textAlign: "right" }}>{c.presupuesto != null ? money(c.presupuesto) : <span style={{ color: "var(--texto-suave)" }}>—</span>}</td>
                        ) : (
                          <td style={{ ...td, textAlign: "right" }}>{c.techo > 0 ? money(c.techo) : <span style={{ color: "var(--texto-suave)" }}>—</span>}</td>
                        )}
                        <td style={{ ...td, textAlign: "right" }}>{money(c.gasto)}</td>
                        {esInt ? (
                          <td style={{ ...td, textAlign: "right", color: c.pasivo > 0 ? "#B45309" : "inherit" }}>{money(c.pasivo)}</td>
                        ) : (
                          <td style={{ ...td, textAlign: "right", color: c.techo > 0 ? (c.saldo < 0 ? "var(--rojo)" : "var(--verde)") : "inherit" }}>{c.techo > 0 ? money(c.saldo) : "—"}</td>
                        )}
                        <td style={{ ...td, textAlign: "right" }}>{money(c.reflejado)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td style={td} colSpan={3}>Subtotal {cap.nombre}</td>
                      <td style={{ ...td, textAlign: "right" }}>{esInt ? (cap.tot.presupuesto > 0 ? money(cap.tot.presupuesto) : "—") : (cap.tot.techo > 0 ? money(cap.tot.techo) : "—")}</td>
                      <td style={{ ...td, textAlign: "right" }}>{money(cap.tot.gasto)}</td>
                      <td style={{ ...td, textAlign: "right", color: esInt ? "#B45309" : (cap.tot.saldo < 0 ? "var(--rojo)" : "var(--verde)") }}>{esInt ? money(cap.tot.pasivo) : (cap.tot.techo > 0 ? money(cap.tot.saldo) : "—")}</td>
                      <td style={{ ...td, textAlign: "right" }}>{money(cap.tot.reflejado)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
          );
        })
      )}

      <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 16 }}>
        Cada cuenta enlaza a su detalle: gasto vs FINAT, partición pasivo/corriente y las facturas. El <strong>pasivo</strong> es
        gasto de periodos anteriores cubierto con presupuesto 2026. El presupuesto viene del reporte <code>dispo</code>; súbelo con
        el botón de arriba para actualizar todas las cuentas de una vez.
      </p>
    </div>
  );
}
