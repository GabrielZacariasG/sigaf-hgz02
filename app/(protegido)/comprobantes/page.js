"use client";

// Fase 2 (29/10/2026) · Cargar el reporte de comprobantes N_AP_IMSS_1043 y poner al día los CR de SIGAF.
// Flujo: subir el .xls → SIGAF lo lee y lo cruza (lib/nap.js) → muestra
//   1) Automáticas: mismo CR, o proveedor + folio con importe exacto. Vienen palomeadas.
//   2) Por confirmar: importe distinto, folios faltantes, repetidos u otro CR. Vienen SIN palomear.
//   3) Alertas: CR que el sistema eliminó, devueltas con CR vivo. Solo se avisan.
//   4) Faltan en SIGAF: comprobantes del HGZ 2 cuyas facturas no están capturadas.
// Nada se guarda hasta "Guardar". Solo avanza estatus (nunca retrocede) y no toca firmas.
import { useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";
import { leerTodo } from "../../../lib/paginar";
import { leerNAP1043, agruparComprobantes, cruzar } from "../../../lib/nap";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaTxt = (f) => (f ? new Date(f + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const GEN_TXT = { capturada: "Capturada", en_revision: "En revisión", enviada_ooad: "Enviada OOAD", en_tramite_ooad: "En trámite OOAD", gasto_reflejado: "Gasto reflejado", devuelta_proveedor: "Devuelta" };
const estadoC = (c) => (c.eliminado ? "Eliminado" : c.pagado ? `Pagado (${fechaTxt(c.fecha_prog_pago)})` : "Sin pagar");

export default function ComprobantesPage() {
  const [archivo, setArchivo] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [res, setRes] = useState(null);
  const [marcadas, setMarcadas] = useState({}); // clave → true/false
  const [tab, setTab] = useState("auto");
  const [busca, setBusca] = useState("");

  const procesar = async () => {
    setProcesando(true); setError(""); setOk(""); setRes(null); setMarcadas({});
    try {
      const wb = XLSX.read(await archivo.arrayBuffer(), { type: "array", raw: true });
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
      const lec = leerNAP1043(grid);
      if (lec.error) throw new Error(lec.error);
      const { data: facturas, error: e } = await leerTodo((d, h) => supabase.from("facturas")
        .select("id, folio_ingreso, folio_proveedor, importe_factura, cr_contrarecibo, estatus_general, fecha_pago, anulada, proveedores ( razon_social ), partidas ( cuenta_finat )")
        .order("id").range(d, h));
      if (e) throw e;
      const comp = agruparComprobantes(lec.filas);
      const cruce = cruzar(comp, facturas || []);
      const m = {};
      cruce.automaticas.forEach((x, i) => { m["a" + i] = true; });
      cruce.porConfirmar.forEach((x, i) => { m["c" + i] = false; });
      setMarcadas(m);
      setRes({ ...cruce, lec, archivo: archivo.name, nFacturas: (facturas || []).length });
      setTab(cruce.automaticas.length ? "auto" : cruce.porConfirmar.length ? "conf" : "alertas");
    } catch (e) { setError("No se pudo procesar: " + e.message); }
    setProcesando(false);
  };

  const cambiosDe = (x) => {
    // [{ id, cambios, cr_anterior }]
    if (x.cambios) return x.facturas.map((f) => ({ f, cambios: x.cambios }));
    return x.facturas.map((f) => ({ f, cambios: x.cambiosPorFactura[f.id] || {} }));
  };

  const guardar = async () => {
    setGuardando(true); setError(""); setOk("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no iniciada.");
      // 1) Comprobantes del reporte (historial / consulta)
      const filas = res.lec.filas.map((f) => ({ ...f, archivo: res.archivo, corte: res.lec.hasta, actualizado_at: new Date().toISOString() }));
      // Se reemplazan completos los comprobantes que trae el reporte (sus líneas pueden cambiar entre cortes).
      const cbtes = [...new Set(filas.map((f) => f.cbte))];
      for (let i = 0; i < cbtes.length; i += 300) {
        const lote = cbtes.slice(i, i + 300);
        const { error: eD } = await supabase.from("comprobantes_ooad").delete().in("cbte", lote);
        if (eD) throw new Error("guardar comprobantes: " + eD.message);
        const { error: eI } = await supabase.from("comprobantes_ooad").insert(filas.filter((f) => lote.includes(f.cbte)));
        if (eI) throw new Error("guardar comprobantes: " + eI.message);
      }
      // 2) Facturas palomeadas. Cada update exige que el CR siga como lo vimos (si alguien lo cambió, no se pisa).
      const sel = [
        ...res.automaticas.map((x, i) => ["a" + i, x]),
        ...res.porConfirmar.map((x, i) => ["c" + i, x]),
      ].filter(([k]) => marcadas[k]);
      let hechas = 0, saltadas = 0; const aplicadas = [];
      for (const [k, x] of sel) {
        for (const { f, cambios } of cambiosDe(x)) {
          if (!Object.keys(cambios).length) continue;
          let q = supabase.from("facturas").update(cambios).eq("id", f.id).eq("anulada", false);
          q = f.cr_contrarecibo == null ? q.is("cr_contrarecibo", null) : q.eq("cr_contrarecibo", f.cr_contrarecibo);
          const { data, error: e } = await q.select("id");
          if (e) throw new Error(`${f.folio_ingreso}: ${e.message}`);
          if (data?.length) { hechas++; aplicadas.push({ factura: f.folio_ingreso, cbte: x.c.cbte, cambios, tipo: k[0] === "a" ? "auto" : "confirmada" }); }
          else saltadas++;
        }
      }
      // 3) Bitácora
      await supabase.from("cargas_nap").insert({
        archivo: res.archivo, desde: res.lec.desde, hasta: res.lec.hasta, renglones: res.lec.filas.length,
        comprobantes: res.resumen.comprobantes, aplicadas: aplicadas.filter((a) => a.tipo === "auto").length,
        confirmadas: aplicadas.filter((a) => a.tipo === "confirmada").length,
        detalle: { aplicadas, alertas: res.alertas.map((a) => ({ tipo: a.tipo, cbte: a.c.cbte, factura: a.f.folio_ingreso })), faltan: res.faltanEnSigaf.map((x) => x.c.cbte) },
      });
      setOk(`Listo: ${filas.length} renglones del reporte guardados · ${hechas} facturas actualizadas${saltadas ? ` · ${saltadas} no se tocaron porque alguien las cambió mientras tanto` : ""}.`);
      setRes(null); setArchivo(null);
    } catch (e) { setError("No se pudo guardar: " + e.message); }
    setGuardando(false);
  };

  const filtro = (x) => {
    const q = busca.trim().toLowerCase(); if (!q) return true;
    const t = [x.c.cbte, x.c.proveedor, x.c.factura_txt, ...(x.facturas || [x.f]).filter(Boolean).map((f) => `${f.folio_ingreso} ${f.folio_proveedor}`)].join(" ").toLowerCase();
    return t.includes(q);
  };
  const nMarc = useMemo(() => Object.values(marcadas).filter(Boolean).length, [marcadas]);

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "12px 14px" };
  const th = { textAlign: "left", fontSize: 12, padding: "6px 8px", borderBottom: "1px solid var(--borde)", color: "var(--texto-suave)", whiteSpace: "nowrap" };
  const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid var(--borde)", verticalAlign: "top" };
  const Tab = ({ id, t, n }) => (
    <button onClick={() => setTab(id)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--borde)", cursor: "pointer", fontSize: 13,
      background: tab === id ? "var(--verde)" : "var(--blanco)", color: tab === id ? "#fff" : "inherit" }}>{t} ({n})</button>
  );

  const filaCruce = (x, k) => (
    <tr key={k}>
      {k && <td style={td}><input type="checkbox" checked={!!marcadas[k]} onChange={(e) => setMarcadas((p) => ({ ...p, [k]: e.target.checked }))} /></td>}
      <td style={td}><strong>{x.c.cbte}</strong><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{estadoC(x.c)}</div></td>
      <td style={td}>{x.c.proveedor}<div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{x.c.factura_txt}</div></td>
      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(x.c.importe)}{x.c.impHGZ2 > 0 && Math.abs(x.c.impHGZ2 - x.c.importe) > 1 && <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>HGZ 2: {money(x.c.impHGZ2)}</div>}</td>
      <td style={td}>
        {cambiosDe(x).map(({ f, cambios }) => (
          <div key={f.id} style={{ marginBottom: 3 }}>
            <Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)" }}>{f.folio_ingreso}</Link> · {f.folio_proveedor} · {money(f.importe_factura)}
            <span style={{ color: "var(--texto-suave)" }}> · {GEN_TXT[f.estatus_general] || f.estatus_general}{f.cr_contrarecibo ? ` · CR ${f.cr_contrarecibo}` : ""}</span>
            {Object.keys(cambios).length > 0 && <div style={{ fontSize: 12 }}>→ {[cambios.cr_contrarecibo && `CR ${cambios.cr_contrarecibo}`, cambios.estatus_general && GEN_TXT[cambios.estatus_general], cambios.fecha_pago && `pago ${fechaTxt(cambios.fecha_pago)}`].filter(Boolean).join(" · ")}</div>}
          </div>
        ))}
        {x.motivos && <div style={{ fontSize: 12, color: "var(--rojo)" }}>{x.motivos.join(" · ")}</div>}
      </td>
    </tr>
  );

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Comprobantes del sistema (N_AP_IMSS_1043)</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 860 }}>
        Sube el reporte de comprobantes por fecha de emisión. SIGAF pone el contra recibo a cada factura, marca las pagadas
        con su fecha y te avisa de los CR eliminados y de lo que el sistema tiene y SIGAF no. Solo cuenta lo del HGZ 2 (UI 010102).
        <strong> No guarda nada hasta que revises.</strong>
      </p>

      <div style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <input type="file" accept=".xls,.xlsx" onChange={(e) => { setArchivo(e.target.files?.[0] || null); setRes(null); setOk(""); setError(""); }} />
        <button className="boton" onClick={procesar} disabled={!archivo || procesando || guardando}>{procesando ? "Leyendo y cruzando…" : "Revisar"}</button>
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}
      {ok && <p style={{ color: "var(--verde)", fontSize: 14, marginTop: 12, fontWeight: 600 }}>{ok}</p>}

      {res && (
        <>
          <div style={{ ...card, marginTop: 12, fontSize: 13 }}>
            <strong>{res.archivo}</strong> · emitidos del {fechaTxt(res.lec.desde)} al {fechaTxt(res.lec.hasta)} · {res.resumen.comprobantes} comprobantes
            ({res.resumen.hgz2} vivos del HGZ 2, {res.resumen.eliminados} eliminados) · {res.nFacturas} facturas en SIGAF.
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            <Tab id="auto" t="Automáticas" n={res.automaticas.length} />
            <Tab id="conf" t="Por confirmar" n={res.porConfirmar.length} />
            <Tab id="alertas" t="Alertas" n={res.alertas.length} />
            <Tab id="faltan" t="Faltan en SIGAF" n={res.faltanEnSigaf.length} />
            <input placeholder="Buscar proveedor, folio, CR…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--borde)", minWidth: 220 }} />
            <button className="boton" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : `Guardar (${nMarc} palomeadas)`}</button>
          </div>

          <div style={{ ...card, marginTop: 10, overflowX: "auto" }}>
            {tab === "auto" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}></th><th style={th}>Comprobante</th><th style={th}>Proveedor / factura</th><th style={th}>Importe</th><th style={th}>Factura en SIGAF → cambio</th></tr></thead>
                <tbody>{res.automaticas.map((x, i) => filtro(x) && filaCruce(x, "a" + i))}</tbody>
              </table>
            )}
            {tab === "conf" && (
              <>
                <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: "0 0 6px" }}>Revisa cada una contra el reporte y palomea solo las que estés seguro. La razón va en rojo.</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}></th><th style={th}>Comprobante</th><th style={th}>Proveedor / factura</th><th style={th}>Importe</th><th style={th}>Factura en SIGAF → cambio</th></tr></thead>
                  <tbody>{res.porConfirmar.map((x, i) => filtro(x) && filaCruce(x, "c" + i))}</tbody>
                </table>
              </>
            )}
            {tab === "alertas" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Comprobante</th><th style={th}>Factura en SIGAF</th><th style={th}>Qué pasa</th></tr></thead>
                <tbody>{res.alertas.filter(filtro).map((a, i) => (
                  <tr key={i}>
                    <td style={td}><strong>{a.c.cbte}</strong><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{estadoC(a.c)} · {a.c.factura_txt}</div></td>
                    <td style={td}><Link href={`/facturas/${a.f.id}`} style={{ color: "var(--verde)" }}>{a.f.folio_ingreso}</Link> · {a.f.folio_proveedor} · {a.f.proveedores?.razon_social} · {money(a.f.importe_factura)}</td>
                    <td style={{ ...td, color: "var(--rojo)" }}>{a.texto}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {tab === "faltan" && (
              <>
                <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: "0 0 6px" }}>El sistema ya registró estos comprobantes del HGZ 2 y SIGAF no tiene la factura (o el folio está capturado distinto).</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Comprobante</th><th style={th}>Proveedor</th><th style={th}>Factura(s)</th><th style={th}>Cuenta</th><th style={th}>Importe HGZ 2</th></tr></thead>
                  <tbody>{res.faltanEnSigaf.filter(filtro).map((x) => (
                    <tr key={x.c.cbte}>
                      <td style={td}><strong>{x.c.cbte}</strong><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{estadoC(x.c)}</div></td>
                      <td style={td}>{x.c.proveedor}</td>
                      <td style={td}>{x.c.factura_txt}</td>
                      <td style={td}>{x.c.cuentasHGZ2.join(", ") || "—"}</td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(x.c.impHGZ2 || x.c.importe)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </>
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>
            Al guardar: se registran los comprobantes del reporte, se aplican las palomeadas (solo si el CR de la factura no cambió mientras tanto)
            y queda una bitácora de la carga. Los estatus solo avanzan; las firmas no se tocan.
          </p>
        </>
      )}
    </div>
  );
}
