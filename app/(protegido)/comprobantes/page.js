"use client";

// Fase 2 (29–30/10/2026) · Reportes del sistema → SIGAF al día, sin scripts.
// Subes de una vez los reportes que tengas (se reconocen solos):
//   N_AP_IMSS_1043 comprobantes → CR, en trámite / pagada (fecha programada), CR eliminados, pagos cancelados
//   N_AP_IMSS_4002 / 4007 pagos → fecha REAL de pago, pedido-recepción
//   N_AP_IMSS_1013 recepciones sin comprobante → pedido-recepción de facturas que aún no tienen CR
// y SIGAF muestra: Cambios automáticos (palomeados), Por confirmar (sin palomear), Alertas, Faltan en SIGAF
// y la BANDEJA: facturas que ya pueden ir a OOAD y las que llevan demasiados días en una etapa.
// Nada se guarda hasta "Guardar". Solo avanza estatus (nunca retrocede) y no toca firmas.
import { useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";
import { leerTodo } from "../../../lib/paginar";
import { leerNAP1043, agruparComprobantes, cruzar } from "../../../lib/nap";
import { tipoReporte, leerPagos, cruzarPagos, leer1013, cruzar1013, avisosDe } from "../../../lib/reportes";
import { LABEL_GENERAL, LABEL_FIRMAS, LABEL_PEDIDO } from "../../../lib/estatus";
import { leerDispoIMKK022, guardarLoteDispo, totalesDispo } from "../../../lib/dispo";
import { cargarDatosDictamenes, revisarDictamenes, guardarDictamenes, aGuardar } from "../../../lib/dictamenesCarga";
import RevisionDictamenes from "../../../lib/RevisionDictamenes";
import { esCDSMS, leerCDSMS, esAvanceSMS, leerAvanceSMS } from "../../../lib/subrogados";
import { cargarDatosFolios, prepararFolios, guardarFolios } from "../../../lib/subrogadosCarga";

const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fechaTxt = (f) => (f ? new Date(String(f).slice(0, 10) + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const GEN = (s) => LABEL_GENERAL?.[s] || s;
const NOMBRE = { "1043": "Comprobantes (1043)", "4002": "Pagos (4002)", "4007": "Pagos de pedidos (4007)", "1013": "Recepciones sin CR (1013)", dispo: "Disponibilidad (IMKK022)", imkk036: "Dictamen (IMKK036)", cdsms: "Folios de subrogados (CD_SMS)", avance_sms: "Avance SMS (historial de folios)" };
const estadoC = (c) => (c.eliminado ? "Eliminado" : c.pagado ? `Pagado (${fechaTxt(c.fecha_prog_pago)})` : c.estado_pago === "X" ? "Pago cancelado" : "Sin pagar");

// 1043 → forma común de los renglones
const deCruce = (x) => ({
  fuente: "1043", ref: x.c.cbte, estado: estadoC(x.c), proveedor: x.c.proveedor, texto: x.c.factura_txt,
  importe: x.c.importe, impHGZ2: x.c.impHGZ2, facturas: x.facturas,
  cambiosPorFactura: x.cambios ? Object.fromEntries(x.facturas.map((f) => [f.id, x.cambios])) : x.cambiosPorFactura, motivos: x.motivos || null,
});
const describir = (cam) => [
  cam.cr_contrarecibo && `CR ${cam.cr_contrarecibo}`, cam.estatus_general && GEN(cam.estatus_general),
  cam.fecha_pago && `pago ${fechaTxt(cam.fecha_pago)}`, cam.numero_pedido && `pedido ${cam.numero_pedido}`,
  cam.numero_recepcion && `recepción ${cam.numero_recepcion}`, cam.estatus_pedido_recepcion && "pedido-recepción generado",
].filter(Boolean).join(" · ");

export default function ComprobantesPage() {
  const [archivos, setArchivos] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [res, setRes] = useState(null);
  const [marcadas, setMarcadas] = useState({});
  const [tab, setTab] = useState("bandeja");
  const [busca, setBusca] = useState("");

  const procesar = async () => {
    setProcesando(true); setError(""); setOk(""); setRes(null); setMarcadas({});
    try {
      // 1) Leer y reconocer cada archivo
      // PDF → dictamen IMKK036 · Excel → N_AP (1043/4002/4007/1013) o disponibilidad IMKK022
      const leidos = [], pdfs = [], dispo = [], folFilas = [];
      for (const file of archivos) {
        if (/\.pdf$/i.test(file.name)) { pdfs.push(file); leidos.push({ nombre: file.name, tipo: "imkk036" }); continue; }
        // Folios de subrogados: CD_SMS (CSV dentro de la página del sistema)
        if (/\.(csv|html?|txt)$/i.test(file.name)) {
          const texto = await file.text();
          if (esCDSMS(texto)) {
            const l = leerCDSMS(texto);
            if (l.error) leidos.push({ nombre: file.name, error: l.error });
            else { folFilas.push(...l.filas); leidos.push({ nombre: file.name, tipo: "cdsms", n: l.filas.length }); }
            continue;
          }
        }
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: true, cellDates: false });
        // Folios de subrogados: Excel del Avance SMS (historial con número de factura)
        if (esAvanceSMS(wb)) {
          const l = leerAvanceSMS(wb);
          folFilas.unshift(...l.filas); leidos.push({ nombre: file.name, tipo: "avance_sms", n: l.filas.length }); continue;
        }
        const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
        const tipo = tipoReporte(grid);
        if (tipo) { leidos.push({ nombre: file.name, tipo, grid }); continue; }
        const d = await leerDispoIMKK022(file).catch((e) => ({ error: e.message }));
        if (!d.error && d.fecha && d.cuentas?.length) { dispo.push({ archivo: file.name, ...d }); leidos.push({ nombre: file.name, tipo: "dispo" }); continue; }
        leidos.push({ nombre: file.name, error: "No lo reconocí (¿es 1043, 4002, 4007, 1013, disponibilidad IMKK022 o PDF IMKK036?)." });
      }
      // Disponibilidad: un corte por fecha (si hay dos del mismo día, el último elegido)
      const porFecha = new Map(); for (const d of dispo) porFecha.set(d.fecha, d);
      const dispoCortes = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
      // Dictámenes
      const dict = pdfs.length ? await revisarDictamenes(pdfs, await cargarDatosDictamenes()) : [];
      // Folios: si el mismo folio+estudio viene en el Excel y en CD_SMS, se juntan (el Excel aporta la factura)
      let folios = null;
      if (folFilas.length) {
        const porClave = new Map();
        for (const f of folFilas) porClave.set(f.clave, { ...(porClave.get(f.clave) || {}), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null && v !== "")) });
        folios = prepararFolios([...porClave.values()], await cargarDatosFolios());
      }
      // 2) Datos de SIGAF
      const [rF, rH, rU, rB] = await Promise.all([
        leerTodo((d, h) => supabase.from("facturas")
          .select("id, folio_ingreso, folio_proveedor, importe_factura, cr_contrarecibo, estatus_general, estatus_firmas, estatus_pedido_recepcion, numero_pedido, numero_recepcion, fecha_pago, anulada, proveedores ( razon_social ), partidas ( cuenta_finat, cuenta_prei ), capitulos ( nombre )")
          .order("id").range(d, h)),
        leerTodo((d, h) => supabase.from("factura_estatus_historial").select("factura_id, circuito, estatus, fecha").order("id").range(d, h)),
        leerTodo((d, h) => supabase.from("alertas_config").select("circuito, estatus, dias_umbral").range(d, h)),
        supabase.from("cedula_bloques").select("cuenta_finat, modo"),
      ]);
      // Cuentas que se llevan factura por factura (modo "facturas" de la cédula). Las demás (agua, teléfono,
      // combustibles, viáticos, nómina…) no se capturan en SIGAF y no deben salir como "faltan".
      const porFactura = new Set((rB.data || []).filter((x) => x.modo === "facturas").map((x) => x.cuenta_finat));
      if (rF.error) throw rF.error;
      const original = rF.data || [];
      const sim = new Map(original.map((f) => [f.id, { ...f }])); // copia donde se van aplicando los cambios
      const aplicar = (items) => { for (const it of items) for (const f of it.facturas) Object.assign(sim.get(f.id) || {}, it.cambiosPorFactura[f.id] || {}); };
      const simLista = () => [...sim.values()];

      const out = { archivos: leidos.map(({ nombre, tipo, error: e }) => ({ nombre, tipo, error: e })), automaticas: [], porConfirmar: [], alertas: [], faltan: [], sinFactura1013: [], lec1043: [], resumen: {}, dispo: dispoCortes, dict, folios };
      for (const l of leidos.filter((x) => x.tipo === "cdsms" || x.tipo === "avance_sms")) out.resumen[l.nombre] = `${l.n} renglones de folios de subrogados`;
      for (const d of dispoCortes) out.resumen[d.archivo] = `corte del ${fechaTxt(d.fecha)} · ${d.cuentas.length} cuentas del HGZ 2`;
      for (const r of dict) out.resumen[r.archivo] = r.ok ? `dictamen ${r.dictamen} · corte ${fechaTxt(r.corte)}` : r.problema;

      // 3) 1043 primero (pone los CR)
      for (const l of leidos.filter((x) => x.tipo === "1043")) {
        const lec = leerNAP1043(l.grid); if (lec.error) { l.error = lec.error; continue; }
        const cr = cruzar(agruparComprobantes(lec.filas), simLista());
        out.lec1043.push({ nombre: l.nombre, filas: lec.filas, desde: lec.desde, hasta: lec.hasta });
        const auto = cr.automaticas.map(deCruce), conf = cr.porConfirmar.map(deCruce);
        out.automaticas.push(...auto); out.porConfirmar.push(...conf);
        out.alertas.push(...cr.alertas.map((a) => ({ ...a, fuente: "1043", ref: a.c.cbte })));
        out.faltan.push(...cr.faltanEnSigaf.filter((x) => !String(x.c.lineas[0]?.tipo || "").startsWith("JRNL")
          && (!porFactura.size || x.c.cuentasHGZ2.some((cta) => porFactura.has(cta)))));
        aplicar(auto);
        out.resumen[l.nombre] = `${cr.resumen.comprobantes} comprobantes (${cr.resumen.hgz2} del HGZ 2) · emitidos ${fechaTxt(lec.desde)}–${fechaTxt(lec.hasta)}`;
      }
      // 4) Pagos 4002 / 4007 (fecha real)
      for (const l of leidos.filter((x) => x.tipo === "4002" || x.tipo === "4007")) {
        const lp = leerPagos(l.grid); if (lp.error) { l.error = lp.error; continue; }
        const cp = cruzarPagos(lp.pagos, simLista(), lp.tipo);
        out.automaticas.push(...cp.items); out.alertas.push(...cp.alertas.map((a) => ({ ...a, fuente: lp.tipo })));
        aplicar(cp.items);
        out.resumen[l.nombre] = `${lp.pagos.size} comprobantes pagados del ${fechaTxt(lp.desde)} al ${fechaTxt(lp.hasta)}`;
      }
      // 5) 1013 (pedido-recepción sin CR)
      for (const l of leidos.filter((x) => x.tipo === "1013")) {
        const lr = leer1013(l.grid); if (lr.error) { l.error = lr.error; continue; }
        const cr = cruzar1013(lr.recepciones, simLista());
        out.automaticas.push(...cr.items); out.sinFactura1013.push(...cr.sinFactura);
        aplicar(cr.items);
        out.resumen[l.nombre] = `${lr.recepciones.length} recepciones del HGZ 2 sin comprobante`;
      }
      out.archivos = leidos.map(({ nombre, tipo, error: e }) => ({ nombre, tipo, error: e }));

      // 6) Bandeja (con los cambios ya simulados)
      const cambiadas = new Set([...out.automaticas].flatMap((it) => it.facturas.map((f) => f.id)));
      const umbrales = {}; (rU.data || []).forEach((a) => (umbrales[`${a.circuito}:${a.estatus}`] = a.dias_umbral));
      out.bandeja = avisosDe(simLista(), cambiadas, rH.data || [], umbrales);
      out.original = new Map(original.map((f) => [f.id, f]));
      out.nFacturas = original.length;

      const m = {}; out.automaticas.forEach((_, i) => (m["a" + i] = true)); out.porConfirmar.forEach((_, i) => (m["c" + i] = false));
      setMarcadas(m); setRes(out); setTab("bandeja");
    } catch (e) { setError("No se pudo procesar: " + e.message); }
    setProcesando(false);
  };

  const guardar = async () => {
    setGuardando(true); setError(""); setOk("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no iniciada.");
      const partes = [];
      // 0) Disponibilidad IMKK022 y dictámenes IMKK036
      if (res.dispo?.length) {
        const r = await guardarLoteDispo(supabase, res.dispo, (t) => setOk(t));
        partes.push(`${r.hechos} corte(s) de disponibilidad${r.ultimo ? ` (vigente: ${fechaTxt(r.ultimo.fecha)})` : ""}`);
      }
      if (res.folios?.items.length) {
        const n = await guardarFolios(res.folios.items, (t) => setOk(t));
        partes.push(`${n} folios de subrogados`);
      }
      if (aGuardar(res.dict).length) {
        const r = await guardarDictamenes(res.dict);
        partes.push(`${r.n} dictamen(es) · ${r.igualados} enlace(s) igualados a FINAT`);
      }
      // 1) Comprobantes del 1043 (se reemplazan completos)
      let nFilas = 0;
      for (const l of res.lec1043) {
        const filas = l.filas.map((f) => ({ ...f, archivo: l.nombre, corte: l.hasta, actualizado_at: new Date().toISOString() }));
        const cbtes = [...new Set(filas.map((f) => f.cbte))];
        for (let i = 0; i < cbtes.length; i += 300) {
          const lote = cbtes.slice(i, i + 300);
          const { error: eD } = await supabase.from("comprobantes_ooad").delete().in("cbte", lote);
          if (eD) throw new Error("guardar comprobantes: " + eD.message);
          const { error: eI } = await supabase.from("comprobantes_ooad").insert(filas.filter((f) => lote.includes(f.cbte)));
          if (eI) throw new Error("guardar comprobantes: " + eI.message);
        }
        nFilas += filas.length;
      }
      // 2) Juntar por factura los cambios palomeados (en orden: 1043 → pagos → 1013)
      const porFactura = new Map(); const detalle = [];
      [...res.automaticas.map((x, i) => ["a" + i, x]), ...res.porConfirmar.map((x, i) => ["c" + i, x])]
        .filter(([k]) => marcadas[k])
        .forEach(([k, x]) => x.facturas.forEach((f) => {
          const cam = x.cambiosPorFactura[f.id] || {}; if (!Object.keys(cam).length) return;
          porFactura.set(f.id, { ...(porFactura.get(f.id) || {}), ...cam });
          detalle.push({ factura: f.folio_ingreso, fuente: x.fuente, ref: x.ref, cambios: cam, tipo: k[0] === "a" ? "auto" : "confirmada" });
        }));
      // 3) Guardar: cada update exige que el CR siga como lo leímos (si alguien lo cambió, no se pisa)
      let hechas = 0, saltadas = 0;
      for (const [id, cam] of porFactura) {
        const o = res.original.get(id);
        let q = supabase.from("facturas").update(cam).eq("id", id).eq("anulada", false);
        q = o.cr_contrarecibo == null ? q.is("cr_contrarecibo", null) : q.eq("cr_contrarecibo", o.cr_contrarecibo);
        const { data, error: e } = await q.select("id");
        if (e) throw new Error(`${o.folio_ingreso}: ${e.message}`);
        if (data?.length) hechas++; else saltadas++;
      }
      // 4) Bitácora (solo si hubo reportes N_AP)
      if (res.lec1043.length || detalle.length) await supabase.from("cargas_nap").insert({
        archivo: res.archivos.map((a) => a.nombre).join(" | "),
        desde: res.lec1043[0]?.desde || null, hasta: res.lec1043[0]?.hasta || null,
        renglones: nFilas, comprobantes: res.lec1043.reduce((s, l) => s + new Set(l.filas.map((f) => f.cbte)).size, 0),
        aplicadas: detalle.filter((d) => d.tipo === "auto").length, confirmadas: detalle.filter((d) => d.tipo === "confirmada").length,
        detalle: { reportes: res.archivos, cambios: detalle, alertas: res.alertas.map((a) => ({ tipo: a.tipo, ref: a.ref, factura: a.f?.folio_ingreso })), faltan: res.faltan.map((x) => x.c.cbte) },
      });
      setOk(`Listo: ${[...partes, `${hechas} facturas actualizadas`].join(" · ")}${nFilas ? ` · ${nFilas} renglones de comprobantes guardados` : ""}${saltadas ? ` · ${saltadas} no se tocaron porque alguien las cambió mientras tanto` : ""}.`);
      setRes(null); setArchivos([]);
    } catch (e) { setError("No se pudo guardar: " + e.message); }
    setGuardando(false);
  };

  const q = busca.trim().toLowerCase();
  const pasa = (...t) => !q || t.filter(Boolean).join(" ").toLowerCase().includes(q);
  const filtroItem = (x) => pasa(x.ref, x.proveedor, x.texto, ...x.facturas.map((f) => `${f.folio_ingreso} ${f.folio_proveedor}`));
  const nMarc = useMemo(() => Object.values(marcadas).filter(Boolean).length, [marcadas]);

  const card = { background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 10, padding: "12px 14px" };
  const th = { textAlign: "left", fontSize: 12, padding: "6px 8px", borderBottom: "1px solid var(--borde)", color: "var(--texto-suave)", whiteSpace: "nowrap" };
  const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid var(--borde)", verticalAlign: "top" };
  const Tab = ({ id, t, n }) => (
    <button onClick={() => setTab(id)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--borde)", cursor: "pointer", fontSize: 13,
      background: tab === id ? "var(--verde)" : "var(--blanco)", color: tab === id ? "#fff" : "inherit" }}>{t} ({n})</button>
  );
  const LinkF = ({ f }) => <Link href={`/facturas/${f.id}`} style={{ color: "var(--verde)" }}>{f.folio_ingreso}</Link>;

  const fila = (x, k) => (
    <tr key={k}>
      <td style={td}><input type="checkbox" checked={!!marcadas[k]} onChange={(e) => setMarcadas((p) => ({ ...p, [k]: e.target.checked }))} /></td>
      <td style={td}><strong>{x.ref}</strong><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{NOMBRE[x.fuente] || x.fuente} · {x.estado}</div></td>
      <td style={td}>{x.proveedor}<div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{x.texto}</div></td>
      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(x.importe)}{x.impHGZ2 > 0 && Math.abs(x.impHGZ2 - x.importe) > 1 && <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>HGZ 2: {money(x.impHGZ2)}</div>}</td>
      <td style={td}>
        {x.facturas.map((fs) => { const f = res.original.get(fs.id) || fs; return (
          <div key={f.id} style={{ marginBottom: 3 }}>
            <LinkF f={f} /> · {f.folio_proveedor} · {money(f.importe_factura)}
            <span style={{ color: "var(--texto-suave)" }}> · hoy: {GEN(f.estatus_general)}{f.cr_contrarecibo ? ` · CR ${f.cr_contrarecibo}` : " · sin CR"}</span>
            {describir(x.cambiosPorFactura[f.id] || {}) && <div style={{ fontSize: 12 }}>→ {describir(x.cambiosPorFactura[f.id])}</div>}
          </div>
        ); })}
        {x.motivos && <div style={{ fontSize: 12, color: "var(--rojo)" }}>{x.motivos.join(" · ")}</div>}
      </td>
    </tr>
  );
  const tablaItems = (lista, pref) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr><th style={th}></th><th style={th}>Referencia</th><th style={th}>Proveedor / factura</th><th style={th}>Importe</th><th style={th}>Factura en SIGAF → cambio</th></tr></thead>
      <tbody>{lista.map((x, i) => filtroItem(x) && fila(x, pref + i))}</tbody>
    </table>
  );

  const b = res?.bandeja;
  const pagadasHoy = res ? res.automaticas.filter((x) => x.facturas.some((f) => x.cambiosPorFactura[f.id]?.estatus_general === "gasto_reflejado")).reduce((s, x) => s + x.facturas.length, 0) : 0;
  const conCR = res ? res.automaticas.filter((x) => x.facturas.some((f) => x.cambiosPorFactura[f.id]?.cr_contrarecibo)).reduce((s, x) => s + x.facturas.length, 0) : 0;
  const conPR = res ? res.automaticas.filter((x) => x.facturas.some((f) => x.cambiosPorFactura[f.id]?.estatus_pedido_recepcion)).reduce((s, x) => s + x.facturas.length, 0) : 0;
  const Aviso = ({ n, t, color, onClick }) => (
    <button onClick={onClick} style={{ ...card, textAlign: "left", cursor: onClick ? "pointer" : "default", borderLeft: `5px solid ${color}`, minWidth: 200, flex: "1 1 200px" }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{n}</div><div style={{ fontSize: 13 }}>{t}</div>
    </button>
  );

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><Link href="/" style={{ color: "var(--verde)" }}>← Panel</Link></div>
      <h1 style={{ fontSize: 22, margin: 0 }}>Cargar reportes del sistema → SIGAF al día</h1>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", maxWidth: 950 }}>
        Aquí se sube <strong>todo</strong>, junto y de una vez: <strong>1043</strong> (comprobantes), <strong>4002</strong> y <strong>4007</strong> (pagos),
        <strong> 1013</strong> (recepciones sin comprobante), la <strong>disponibilidad IMKK022</strong> (xlsx) y los <strong>PDF del IMKK036</strong> (dictámenes).
        SIGAF reconoce cada archivo solo, pone CR, fechas reales de pago y pedido-recepción, actualiza la dispo y los saldos de dictamen,
        y te arma la bandeja de avisos. Solo cuenta lo del HGZ 2. <strong>No guarda nada hasta que revises.</strong>
      </p>

      <div style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <input type="file" accept=".xls,.xlsx,.csv,.pdf" multiple onChange={(e) => { setArchivos([...(e.target.files || [])]); setRes(null); setOk(""); setError(""); }} />
        <button className="boton" onClick={procesar} disabled={!archivos.length || procesando || guardando}>{procesando ? "Leyendo y cruzando…" : `Revisar ${archivos.length || ""} reporte(s)`}</button>
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 12 }}>{error}</p>}
      {ok && <p style={{ color: "var(--verde)", fontSize: 14, marginTop: 12, fontWeight: 600 }}>{ok}</p>}

      {res && (
        <>
          <div style={{ ...card, marginTop: 12, fontSize: 13 }}>
            {res.archivos.map((a) => (
              <div key={a.nombre}>
                <strong>{a.nombre}</strong> — {a.error ? <span style={{ color: "var(--rojo)" }}>{a.error}</span> : <>{NOMBRE[a.tipo]} · {res.resumen[a.nombre]}</>}
              </div>
            ))}
            <div style={{ color: "var(--texto-suave)", marginTop: 4 }}>{res.nFacturas} facturas en SIGAF.</div>
          </div>

          {res.dispo?.length > 0 && (
            <div style={{ ...card, marginTop: 12, overflowX: "auto" }}>
              <strong>Disponibilidad (IMKK022): {res.dispo.length} corte(s)</strong>
              <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}> · se guarda la historia; el más reciente queda como dispo vigente</span>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
                <thead><tr>{["Fecha", "Archivo", "Cuentas", "Presupuesto", "Gasto", "Comprometido", "Precomprom.", "Disponible"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{res.dispo.map((l) => { const t = totalesDispo(l.cuentas); return (
                  <tr key={l.fecha}>
                    <td style={td}>{fechaTxt(l.fecha)}</td><td style={{ ...td, fontSize: 12, color: "var(--texto-suave)" }}>{l.archivo}</td>
                    <td style={{ ...td, textAlign: "right" }}>{l.cuentas.length}</td>
                    {[t.presupuesto, t.gasto, t.comprometido, t.precomprometido].map((v, i) => <td key={i} style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(v)}</td>)}
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700 }}>{money(t.disponible)}</td>
                  </tr>); })}</tbody>
              </table>
            </div>
          )}

          {res.folios && (
            <div style={{ ...card, marginTop: 12, overflowX: "auto", fontSize: 13 }}>
              <strong>Folios de subrogados: {res.folios.items.length} renglones</strong>
              <span style={{ color: "var(--texto-suave)" }}> · {res.folios.nuevos} nuevos · {res.folios.actualizados} ya estaban (se actualizan) · {res.folios.ligadas} ligados a su factura de SIGAF</span>
              {res.folios.sinContrato.length > 0 && <div style={{ color: "#b7791f", marginTop: 4 }}>Sin contrato en SIGAF (quedan guardados, sin ligar): {res.folios.sinContrato.join(", ")}</div>}
              {Object.keys(res.folios.facturasNoEncontradas).length > 0 && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ cursor: "pointer", color: "#b7791f" }}>{Object.keys(res.folios.facturasNoEncontradas).length} números de factura del Excel que no encontré en SIGAF (cuentan como facturados, sin ligar)</summary>
                  <div style={{ columns: 2, marginTop: 4 }}>{Object.entries(res.folios.facturasNoEncontradas).map(([k, v]) => <div key={k}>{k}: {money(v)}</div>)}</div>
                </details>
              )}
              <div style={{ marginTop: 6 }}><strong>Devengo por contrato</strong> (folios sin factura): {Object.entries(res.folios.devengo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${money(v)}`).join(" · ") || "ninguno"}</div>
            </div>
          )}

          {res.dict?.length > 0 && (
            <div style={{ ...card, marginTop: 12, overflowX: "auto" }}>
              <strong>Dictámenes (IMKK036): {aGuardar(res.dict).length} de {res.dict.length} PDF se guardarán</strong>
              <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}> · el enlace del contrato queda igual a lo que asigna FINAT</span>
              <div style={{ marginTop: 6 }}><RevisionDictamenes items={res.dict} /></div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            <Tab id="bandeja" t="Bandeja" n={(b?.listasOOAD.length || 0) + res.alertas.length} />
            <Tab id="auto" t="Cambios automáticos" n={res.automaticas.length} />
            <Tab id="conf" t="Por confirmar" n={res.porConfirmar.length} />
            <Tab id="alertas" t="Alertas" n={res.alertas.length} />
            <Tab id="faltan" t="Faltan en SIGAF" n={res.faltan.length + res.sinFactura1013.length} />
            <Tab id="estancadas" t="Estancadas" n={b?.estancadas.length || 0} />
            <input placeholder="Buscar proveedor, folio, CR…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--borde)", minWidth: 220 }} />
            <button className="boton" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : `Guardar todo (${[res.folios?.items.length ? `${res.folios.items.length} folios` : "", res.dispo?.length ? `${res.dispo.length} dispo` : "", aGuardar(res.dict).length ? `${aGuardar(res.dict).length} dictamen(es)` : "", `${nMarc} palomeadas`].filter(Boolean).join(" · ")})`}</button>
          </div>

          <div style={{ marginTop: 10 }}>
            {tab === "bandeja" && (
              <>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Aviso n={b.listasOOAD.filter((x) => x.nueva).length} t="ya pueden ir a OOAD gracias a esta carga (manda oficio de envío a pago)" color="var(--verde)" onClick={() => setTab("ooad")} />
                  <Aviso n={b.listasOOAD.length} t="en total listas para OOAD (firmas y pedido-recepción completos)" color="var(--verde)" onClick={() => setTab("ooad")} />
                  <Aviso n={conCR} t="facturas reciben su contra recibo" color="#2b6cb0" onClick={() => setTab("auto")} />
                  <Aviso n={pagadasHoy} t="facturas pasan a pagadas (gasto reflejado)" color="#2b6cb0" onClick={() => setTab("auto")} />
                  <Aviso n={conPR} t="facturas con pedido-recepción generado" color="#2b6cb0" onClick={() => setTab("auto")} />
                  <Aviso n={res.alertas.filter((a) => a.tipo === "cr_eliminado").length} t="CR eliminados por el sistema (buscar el nuevo)" color="var(--rojo)" onClick={() => setTab("alertas")} />
                  <Aviso n={res.alertas.filter((a) => a.tipo === "pago_cancelado").length} t="pagos cancelados" color="var(--rojo)" onClick={() => setTab("alertas")} />
                  <Aviso n={res.alertas.filter((a) => a.tipo === "devuelta_pagada" || a.tipo === "devuelta_con_cr").length} t="devueltas en SIGAF con CR vivo o pagado" color="var(--rojo)" onClick={() => setTab("alertas")} />
                  <Aviso n={res.porConfirmar.length} t="cruces por confirmar a mano" color="#d69e2e" onClick={() => setTab("conf")} />
                  <Aviso n={res.faltan.length} t="comprobantes del HGZ 2 que SIGAF no tiene" color="#d69e2e" onClick={() => setTab("faltan")} />
                  <Aviso n={b.estancadas.length} t="facturas estancadas (más días que el límite en su etapa)" color="#d69e2e" onClick={() => setTab("estancadas")} />
                </div>
                <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>Los números ya consideran los cambios automáticos palomeados de esta carga. Haz clic en un cuadro para ver el detalle.</p>
              </>
            )}
            {tab === "ooad" && (
              <div style={{ ...card, overflowX: "auto" }}>
                <p style={{ fontSize: 13, margin: "0 0 8px" }}>Estas facturas ya cumplen firmas y pedido-recepción: se pueden incluir en un oficio de envío a pago desde <Link href="/facturas" style={{ color: "var(--verde)" }}>Facturas</Link>.</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Factura</th><th style={th}>Proveedor</th><th style={th}>Capítulo / cuenta</th><th style={th}>Importe</th><th style={th}>Firmas</th><th style={th}>Pedido-recepción</th></tr></thead>
                  <tbody>{b.listasOOAD.filter((x) => pasa(x.f.folio_ingreso, x.f.folio_proveedor, x.f.proveedores?.razon_social)).map(({ f, nueva }) => (
                    <tr key={f.id} style={nueva ? { background: "color-mix(in srgb, var(--verde) 10%, transparent)" } : undefined}>
                      <td style={td}><LinkF f={f} /> · {f.folio_proveedor}{nueva && <strong style={{ color: "var(--verde)" }}> · NUEVA</strong>}</td>
                      <td style={td}>{f.proveedores?.razon_social}</td>
                      <td style={td}>{f.capitulos?.nombre} · {f.partidas?.cuenta_finat}</td>
                      <td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td>
                      <td style={td}>{LABEL_FIRMAS?.[f.estatus_firmas] || f.estatus_firmas}</td>
                      <td style={td}>{LABEL_PEDIDO?.[f.estatus_pedido_recepcion] || f.estatus_pedido_recepcion}{f.numero_pedido ? ` · ${f.numero_pedido}/${f.numero_recepcion || "—"}` : ""}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {tab === "auto" && <div style={{ ...card, overflowX: "auto" }}>{tablaItems(res.automaticas, "a")}</div>}
            {tab === "conf" && (
              <div style={{ ...card, overflowX: "auto" }}>
                <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: "0 0 6px" }}>Revisa cada una contra el reporte y palomea solo las que estés seguro. La razón va en rojo.</p>
                {tablaItems(res.porConfirmar, "c")}
              </div>
            )}
            {tab === "alertas" && (
              <div style={{ ...card, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Referencia</th><th style={th}>Factura en SIGAF</th><th style={th}>Qué pasa</th></tr></thead>
                  <tbody>{res.alertas.filter((a) => pasa(a.ref, a.f?.folio_ingreso, a.f?.folio_proveedor, a.f?.proveedores?.razon_social)).map((a, i) => (
                    <tr key={i}>
                      <td style={td}><strong>{a.ref}</strong><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{NOMBRE[a.fuente] || a.fuente}</div></td>
                      <td style={td}><LinkF f={a.f} /> · {a.f.folio_proveedor} · {a.f.proveedores?.razon_social} · {money(a.f.importe_factura)}</td>
                      <td style={{ ...td, color: "var(--rojo)" }}>{a.texto}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {tab === "faltan" && (
              <div style={{ ...card, overflowX: "auto" }}>
                <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: "0 0 6px" }}>El sistema ya los tiene y SIGAF no tiene la factura (o el folio está capturado distinto). Solo cuentas que se llevan factura por factura en la cédula.</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Referencia</th><th style={th}>Proveedor</th><th style={th}>Factura(s) / contrato</th><th style={th}>Cuenta</th><th style={th}>Importe HGZ 2</th></tr></thead>
                  <tbody>
                    {res.faltan.filter((x) => pasa(x.c.cbte, x.c.proveedor, x.c.factura_txt)).map((x) => (
                      <tr key={x.c.cbte}>
                        <td style={td}><strong>{x.c.cbte}</strong><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Comprobante · {estadoC(x.c)}</div></td>
                        <td style={td}>{x.c.proveedor}</td><td style={td}>{x.c.factura_txt}</td>
                        <td style={td}>{x.c.cuentasHGZ2.join(", ") || "—"}</td>
                        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(x.c.impHGZ2 || x.c.importe)}</td>
                      </tr>
                    ))}
                    {res.sinFactura1013.filter(({ r }) => pasa(r.pedido, r.proveedor, r.contrato)).map(({ r, n, otroPedido }) => (
                      <tr key={r.pedido + r.recepcion}>
                        <td style={td}><strong>Pedido {r.pedido}</strong><div style={{ fontSize: 12, color: "var(--texto-suave)" }}>Recepción {r.recepcion} · {fechaTxt(r.fecha)}</div></td>
                        <td style={td}>{r.proveedor}</td>
                        <td style={td}>Contrato {r.contrato}{n > 1 && <div style={{ fontSize: 12, color: "var(--rojo)" }}>{n} facturas posibles con ese importe</div>}{otroPedido && <div style={{ fontSize: 12, color: "var(--rojo)" }}>{otroPedido.folio_ingreso} ya tiene otro pedido</div>}</td>
                        <td style={td}>{[...r.cuentas].join(", ")}</td>
                        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{money(r.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === "estancadas" && (
              <div style={{ ...card, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Factura</th><th style={th}>Proveedor</th><th style={th}>Importe</th><th style={th}>Dónde está</th><th style={th}>Días</th></tr></thead>
                  <tbody>{b.estancadas.filter(({ f }) => pasa(f.folio_ingreso, f.folio_proveedor, f.proveedores?.razon_social)).map(({ f, circuito, valor, dias, lim }) => (
                    <tr key={f.id}>
                      <td style={td}><LinkF f={f} /> · {f.folio_proveedor}</td>
                      <td style={td}>{f.proveedores?.razon_social}</td>
                      <td style={{ ...td, textAlign: "right" }}>{money(f.importe_factura)}</td>
                      <td style={td}>{circuito === "general" ? GEN(valor) : circuito === "firmas" ? (LABEL_FIRMAS?.[valor] || valor) : (LABEL_PEDIDO?.[valor] || valor)}</td>
                      <td style={{ ...td, color: "var(--rojo)", fontWeight: 600 }}>{dias} <span style={{ color: "var(--texto-suave)", fontWeight: 400 }}>(límite {lim})</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>
            Al guardar: se registran los comprobantes del 1043, se aplican los cambios palomeados (solo si el CR de la factura no cambió mientras tanto)
            y queda una bitácora de la carga. Los estatus solo avanzan; las firmas no se tocan.
          </p>
        </>
      )}
    </div>
  );
}
