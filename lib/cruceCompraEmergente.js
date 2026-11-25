// Cruce del reporte de "Solicitudes de compra emergente" (SAI, módulo CompraEmergente, lo pasa el administrador)
// contra las facturas de Compra Emergente de SIGAF y la dispo del HGZ 2.
// Reglas acordadas con Gabriel (25/11/2026):
//  - Cada folio del reporte se liga a una sola factura de SIGAF: primero por OC del portal, luego por número de alta,
//    luego por número de factura. Si varias facturas tienen la misma OC, se prefiere la que tiene CR, luego la que
//    va en trámite y al final la devuelta (una devuelta ya refacturada no debe "ganarle" a la que sí se pagó).
//  - OC en camino = folios del reporte que no han llegado a SIGAF + facturas de SIGAF sin CR (vengan o no en el reporte).
//    Una factura devuelta al proveedor que ya tiene otra factura activa con la misma OC NO cuenta (ya se refacturó).
//  - La cuenta de los folios que no han llegado a SIGAF sale de su partida; la equivalencia partida → cuenta se
//    aprende de los folios que sí se ligaron (la cuenta más frecuente de cada partida).
//  - Por generar OC = disponible de la dispo − OC en camino (nunca negativo; si no alcanza: pedir póliza).

const UNIDAD_HGZ2 = "010102";
const num = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
};
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const txt = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const digitos = (v) => String(v ?? "").replace(/\D/g, "");
// número de factura comparable: sin espacios/guiones y sin ceros a la izquierda del número ("B 04250" = "B4250")
const normFactura = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^([A-Z]*)0+/, "$1");
const primeraPalabra = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z ]/g, "").split(" ").filter((w) => w.length > 3)[0] || "";

// Fecha de Excel (número de serie) o texto dd/mm/aaaa → "aaaa-mm-dd"
function fechaISO(v) {
  if (typeof v === "number" && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const m = String(v ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

// ---------------------------------------------------------------------------------------------
// 1) Lectura del archivo del administrador
// ---------------------------------------------------------------------------------------------
export function leerReporteCE(XLSX, datos) {
  const wb = XLSX.read(datos, { type: "array", raw: true });
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
  let fecha = "", hora = "";
  for (const fila of grid.slice(0, 12)) {
    fila.forEach((c, i) => {
      const t = txt(c).toLowerCase();
      if (t === "fecha:" && !fecha) fecha = fechaISO(fila[i + 1]);
      if (t === "hora:" && !hora) hora = txt(fila[i + 1]);
    });
  }
  const h = grid.findIndex((f) => f.some((c) => txt(c).toUpperCase() === "NUMERO FOLIO"));
  if (h < 0) return { error: "No encontré la columna \"NUMERO FOLIO\". ¿Es el reporte de Solicitudes de compra emergente del SAI?" };
  const enc = grid[h].map((c) => txt(c).toUpperCase());
  const col = (nombre) => enc.indexOf(nombre);
  const req = ["NUMERO FOLIO", "OC PORTAL INCUMPLIENTO", "NUMERO ALTA", "PARTIDA PRESUPUESTAL", "TOTAL", "RAZON SOCIAL", "NUMERO FACTURA PROVEEDOR"];
  const falta = req.filter((n) => col(n) < 0);
  if (falta.length) return { error: `Al archivo le faltan columnas: ${falta.join(", ")}.` };
  const C = Object.fromEntries(["CLAS PTAL UNIDAD", "NOMBRE UNIDAD", "OC PORTAL INCUMPLIENTO", "NUMERO FOLIO", "FECHA REGISTRO FOLIO", "ESTATUS SOL COM EMER",
    "DESCRIPCION ARTICULO", "PARTIDA PRESUPUESTAL", "TOTAL", "NUMERO FACTURA PROVEEDOR", "FECHA DE LA FACTURA", "RAZON SOCIAL", "NUMERO ALTA"].map((n) => [n, col(n)]));
  const v = (f, n) => (C[n] >= 0 ? f[C[n]] : "");
  let sinFolio = 0, otraUnidad = 0;
  const filas = [];
  for (const f of grid.slice(h + 1)) {
    if (!f.some((c) => txt(c) !== "")) continue;
    if (!txt(v(f, "NUMERO FOLIO"))) { sinFolio++; continue; }
    const unidad = txt(v(f, "CLAS PTAL UNIDAD"));
    if (unidad && !unidad.startsWith(UNIDAD_HGZ2)) { otraUnidad++; continue; }
    const fechaFolio = fechaISO(v(f, "FECHA REGISTRO FOLIO"));
    filas.push({
      folio: txt(v(f, "NUMERO FOLIO")), alta: txt(v(f, "NUMERO ALTA")), oc: txt(v(f, "OC PORTAL INCUMPLIENTO")),
      fechaFolio, mes: fechaFolio.slice(0, 7), partida: digitos(v(f, "PARTIDA PRESUPUESTAL")).padStart(4, "0"),
      proveedor: txt(v(f, "RAZON SOCIAL")), articulo: txt(v(f, "DESCRIPCION ARTICULO")).split(".")[0].slice(0, 60),
      factura: txt(v(f, "NUMERO FACTURA PROVEEDOR")), total: r2(num(v(f, "TOTAL"))), estatusSAI: txt(v(f, "ESTATUS SOL COM EMER")),
    });
  }
  return { fecha, hora, filas, sinFolio, otraUnidad };
}

// ---------------------------------------------------------------------------------------------
// 2) Etapa en SIGAF (mismas etiquetas que el Excel del 24/11)
// ---------------------------------------------------------------------------------------------
export function etapaCE(f) {
  if (!f) return "No ha llegado a SIGAF";
  if (String(f.cr ?? "").trim() || f.estatus_general === "gasto_reflejado") return "Gasto reflejado (con CR)";
  if (f.estatus_general === "devuelta_proveedor") return "Devuelta al proveedor";
  if (f.estatus_general === "enviada_ooad") return "Enviada a OOAD sin CR";
  if (f.estatus_general === "en_tramite_ooad") return "En trámite OOAD sin CR";
  if (["envio_firmas_servicio", "envio_firmas_admin_contrato"].includes(f.estatus_firmas)) return "En firmas del servicio";
  if (["autorizada_servicio", "autorizada_admin_contrato"].includes(f.estatus_firmas)) return "Validada, por enviar a OOAD";
  return "En revisión (recién capturada)";
}
const conCR = (f) => !!String(f.cr ?? "").trim() || f.estatus_general === "gasto_reflejado";
// Orden de preferencia cuando varias facturas comparten OC/alta/factura
const rango = (f) => (conCR(f) ? 0 : f.estatus_general === "devuelta_proveedor" ? 2 : 1);

// ---------------------------------------------------------------------------------------------
// 3) Cruce
//   reporte:  salida de leerReporteCE
//   facturas: [{ id, folio_ingreso, folio_proveedor, orden_compra, importe, estatus_general, estatus_firmas, cr, cuenta, proveedor, created_at }]
//             (solo Compra Emergente y sin anuladas)
//   dispo:    { fecha, cuentas: { [cuenta]: { presupuesto, gasto, disponible } } }   (HGZ 2)
//   nombres:  { [cuenta]: "Material de curación" }   (partidas del capítulo Compra Emergente)
// ---------------------------------------------------------------------------------------------
export function cruzarCE({ reporte, facturas, dispo, nombres = {} }) {
  const R = reporte.filas.map((r) => ({ ...r }));
  const F = facturas.map((f) => ({ ...f, importe: r2(num(f.importe)), ocD: digitos(f.orden_compra), facN: normFactura(f.folio_proveedor) }));
  const indice = (clave) => { const m = new Map(); for (const f of F) { const k = clave(f); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(f); } for (const l of m.values()) l.sort((a, b) => rango(a) - rango(b)); return m; };
  const porOC = indice((f) => f.ocD), porFac = indice((f) => f.facN);
  const usadas = new Set();
  const tolerancia = (r) => Math.max(5, r.total * 0.05);

  for (const r of R) {
    const intentos = [["OC", porOC.get(digitos(r.oc))], ["Alta", porOC.get(digitos(r.alta))], ["Factura", r.factura ? porFac.get(normFactura(r.factura)) : null]];
    for (const [como, lista] of intentos) {
      if (!lista) continue;
      const libres = lista.filter((f) => !usadas.has(f.id));
      let s = libres.find((f) => Math.abs(f.importe - r.total) < 1);
      if (!s) s = como === "Factura" ? libres.find((f) => primeraPalabra(f.proveedor) === primeraPalabra(r.proveedor)) : libres[0];
      if (s && Math.abs(s.importe - r.total) <= tolerancia(r)) { r.s = s; r.como = como; usadas.add(s.id); break; }
    }
  }

  // Partida → cuenta, aprendida de los folios ligados
  const conteo = {};
  for (const r of R) if (r.s?.cuenta) { (conteo[r.partida] ||= {}); conteo[r.partida][r.s.cuenta] = (conteo[r.partida][r.s.cuenta] || 0) + 1; }
  const partidaCuenta = Object.fromEntries(Object.entries(conteo).map(([p, m]) => [p, Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]]));
  for (const r of R) {
    r.cuentaPartida = partidaCuenta[r.partida] || "";
    r.cuenta = r.s?.cuenta || r.cuentaPartida;
    r.etapa = etapaCE(r.s);
  }

  // Devueltas ya refacturadas: otra factura activa (no devuelta) con la misma OC
  const sustituida = (f) => f.estatus_general === "devuelta_proveedor" && !!f.ocD && (porOC.get(f.ocD) || []).some((y) => y.id !== f.id && y.estatus_general !== "devuelta_proveedor");
  const sinCR = F.filter((f) => !conCR(f) && f.importe > 0);
  const sustituidas = sinCR.filter(sustituida);
  const enCaminoSIGAF = sinCR.filter((f) => !sustituida(f));
  const ligadas = new Set(R.filter((r) => r.s).map((r) => r.s.id));
  // Hora del reporte = hora de Aguascalientes (UTC−6, sin horario de verano); created_at de SIGAF viene en UTC
  const corteMs = reporte.fecha ? Date.parse(`${reporte.fecha}T${(reporte.hora || "23:59:59").padStart(8, "0")}-06:00`) : NaN;

  // ---- Tarjetas ----
  const suma = (l, k = "total") => r2(l.reduce((s, x) => s + (Number(x[k]) || 0), 0));
  const enSigaf = R.filter((r) => r.s), noLlegan = R.filter((r) => !r.s);
  const tarjetas = [
    { label: "Compras del reporte", valor: suma(R), sub: `${R.length} folios` },
    { label: "Ya están en SIGAF", valor: suma(enSigaf), sub: `${enSigaf.length} folios` },
    { label: "No han llegado a SIGAF", valor: suma(noLlegan), sub: `${noLlegan.length} folios`, alerta: noLlegan.length > 0 },
  ];

  const nombreCta = (c) => (c ? `${c}  ${nombres[c] || ""}`.trim() : "Sin cuenta (partida no reconocida)");

  // ---- Por cuenta (del reporte) ----
  const g = new Map();
  for (const r of R) { const k = r.cuenta || ""; const x = g.get(k) || { cuenta: nombreCta(k), falta: 0, ya: 0, total: 0 }; if (r.s) x.ya += r.total; else x.falta += r.total; x.total += r.total; g.set(k, x); }
  const porCuenta = [...g.values()].map((x) => ({ ...x, falta: r2(x.falta), ya: r2(x.ya), total: r2(x.total) })).sort((a, b) => b.total - a.total);

  // ---- Por etapa ----
  const ge = new Map();
  for (const r of R) { const x = ge.get(r.etapa) || { etapa: r.etapa, folios: 0, monto: 0 }; x.folios++; x.monto += r.total; ge.set(r.etapa, x); }
  const totR = suma(R);
  const porEtapa = [...ge.values()].map((x) => ({ ...x, monto: r2(x.monto), pct: totR ? `${(Math.round((x.monto / totR) * 1000) / 10).toFixed(1)}%` : "—" })).sort((a, b) => b.monto - a.monto);

  // ---- No llegan, por proveedor ----
  const gp = new Map();
  for (const r of noLlegan) { const x = gp.get(r.proveedor) || { proveedor: r.proveedor, folios: 0, monto: 0, cuentas: new Set() }; x.folios++; x.monto += r.total; x.cuentas.add(r.cuenta || "?"); gp.set(r.proveedor, x); }
  const noLleganProv = [...gp.values()].map((x) => ({ proveedor: x.proveedor, folios: x.folios, monto: r2(x.monto), cuentas: [...x.cuentas].join(", ") })).sort((a, b) => b.monto - a.monto);

  // ---- Presupuesto vs OC ----
  const ctas = new Set([...Object.keys(nombres), ...R.map((r) => r.cuenta).filter(Boolean), ...enCaminoSIGAF.map((f) => f.cuenta).filter(Boolean)]);
  const ppto = [];
  for (const c of ctas) {
    const d = dispo?.cuentas?.[c] || { presupuesto: 0, gasto: 0, disponible: 0 };
    const caminoReporte = r2(R.filter((r) => r.cuenta === c && !(r.s && conCR(r.s))).reduce((s, r) => s + (r.s ? r.s.importe : r.total), 0));
    const caminoFuera = r2(enCaminoSIGAF.filter((f) => f.cuenta === c && !ligadas.has(f.id)).reduce((s, f) => s + f.importe, 0));
    const camino = r2(caminoReporte + caminoFuera);
    const ocAnio = suma(R.filter((r) => r.cuenta === c));
    const libre = r2((Number(d.disponible) || 0) - camino);
    if (!d.presupuesto && !d.disponible && !camino && !ocAnio) continue;
    const estatus = libre < 0 ? "Sin disponible (pedir póliza)" : libre > 50000 ? "Falta generar OC" : libre > 5000 ? "Falta poco" : "Cubierto";
    ppto.push({ cuenta: nombreCta(c), presupuesto: r2(d.presupuesto), gasto: r2(d.gasto), disponible: r2(d.disponible), ocAnio, caminoReporte, caminoFuera, camino, porGenerar: Math.max(0, libre), estatus });
  }
  ppto.sort((a, b) => b.porGenerar - a.porGenerar || b.disponible - a.disponible);

  // ---- Para revisar ----
  const revisar = [];
  for (const r of R) {
    if (r.s && Math.abs(r.s.importe - r.total) >= 1) revisar.push({ tipo: "Importe distinto", folio: r.folio, sigaf: r.s.folio_ingreso, detalle: `Reporte ${r.total.toFixed(2)} vs SIGAF ${r.s.importe.toFixed(2)} · ${r.proveedor}`, importe: r2(r.s.importe - r.total) });
    if (r.s && r.cuentaPartida && r.s.cuenta && r.cuentaPartida !== r.s.cuenta) revisar.push({ tipo: "Cuenta distinta", folio: r.folio, sigaf: r.s.folio_ingreso, detalle: `Partida ${r.partida} es ${r.cuentaPartida}; en SIGAF está en ${r.s.cuenta} · ${r.proveedor}`, importe: r.total });
    if (r.s && r.como !== "OC") revisar.push({ tipo: `Ligado por ${r.como === "Alta" ? "número de alta" : "factura"}`, folio: r.folio, sigaf: r.s.folio_ingreso, detalle: `OC del reporte ${r.oc}; en SIGAF la OC es ${r.s.orden_compra || "(vacía)"}: revisar captura de la OC`, importe: r.total });
    if (!r.s && !r.cuentaPartida) revisar.push({ tipo: "Partida sin cuenta", folio: r.folio, sigaf: "", detalle: `Partida ${r.partida}: no hay folios ligados de esa partida para saber su cuenta · ${r.proveedor}`, importe: r.total });
  }
  for (const f of sustituidas) revisar.push({ tipo: "Devuelta ya refacturada (no cuenta)", folio: "", sigaf: f.folio_ingreso, detalle: `Fac. ${f.folio_proveedor}, OC ${f.orden_compra}: la OC ya tiene otra factura activa · ${f.proveedor}`, importe: f.importe });
  for (const f of enCaminoSIGAF.filter((x) => !ligadas.has(x.id))) {
    const despues = !Number.isNaN(corteMs) && Date.parse(f.created_at || "") > corteMs;
    revisar.push({ tipo: despues ? "En SIGAF sin CR, capturada después del corte del reporte" : "En SIGAF sin CR que no viene en el reporte", folio: "", sigaf: f.folio_ingreso, detalle: `Fac. ${f.folio_proveedor}, OC ${f.orden_compra || "(vacía)"}, ${f.cuenta} · ${f.proveedor}${despues ? "" : " · revisar la OC"}`, importe: f.importe });
  }

  const ORDEN = ["Cuenta distinta", "Ligado por número de alta", "Ligado por factura", "Partida sin cuenta", "Importe distinto", "En SIGAF sin CR que no viene en el reporte",
    "Devuelta ya refacturada (no cuenta)", "En SIGAF sin CR, capturada después del corte del reporte"];
  const pos = (t) => { const i = ORDEN.indexOf(t); return i < 0 ? 99 : i; };
  revisar.sort((a, b) => pos(a.tipo) - pos(b.tipo) || Math.abs(b.importe) - Math.abs(a.importe));

  // ---- Cruce completo ----
  const cruce = R.map((r) => ({
    folio: r.folio, alta: r.alta, oc: r.oc, fechaFolio: r.fechaFolio, mes: r.mes, partida: r.partida, cuenta: r.cuenta || "", concepto: nombreCta(r.cuenta),
    proveedor: r.proveedor, articulo: r.articulo, factura: r.factura, total: r.total, enSigaf: r.s ? "SI" : "NO", folioSigaf: r.s?.folio_ingreso || "",
    etapa: r.etapa, cr: r.s?.cr || "", importeSigaf: r.s ? r.s.importe : "", _rojo: !r.s,
  })).sort((a, b) => a.cuenta.localeCompare(b.cuenta) || a.articulo.localeCompare(b.articulo));

  return { tarjetas, porCuenta, porEtapa, noLleganProv, ppto, revisar, cruce, partidaCuenta,
    meta: { fechaReporte: reporte.fecha, horaReporte: reporte.hora, fechaDispo: dispo?.fecha || "", folios: R.length, sinFolio: reporte.sinFolio, otraUnidad: reporte.otraUnidad, facturasCE: F.length } };
}
