// Resumen en PDF de la Bandeja de avisos (17/11/2026): qué facturas pueden pasar con los saldos de dictamen y la dispo
// de hoy, para Gabriel y la jefa de Finanzas. Se arma con los mismos datos de /avisos (cargarAvisos) y se abre en una
// ventana lista para imprimir: en el diálogo se elige "Guardar como PDF".
// Regla (17/11/2026): con saldo en el dictamen NO basta; si el contrato en FINAT no trae la ampliación (dinero del
// dictamen "sin contrato" en el IMKK036) la factura no pasa hasta que se registre el convenio modificatorio.
//   1) Ya tienen saldo o dispo y su CR está en error → pedir a OOAD que lo revalide
//   2) Pasan con oficio de apoyo de otra unidad del mismo dictamen
//   3) No pasan: ampliación de dictamen o presupuesto de la cuenta
//   4) Ya tienen presupuesto → presionar el avance (firmas, pedido-recepción, OOAD)
const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const imp = (x) => Number(x.f.importe_factura) || 0;
const suma = (items) => items.reduce((t, x) => t + imp(x), 0);
const enOoad = (f) => ["en_tramite_ooad", "enviada_ooad"].includes(f.estatus_general);
const contratoTxt = (s) => (s.contrato?.numero_interno ? `${s.contrato.numero_interno}${s.dictamen ? ` · dictamen ${s.dictamen}` : ""}` : s.cuenta ? `Cuenta ${s.cuenta}` : "—");

export function abrirPdfAvisos(a, dondeVa) {
  const P = a.presupuesto;
  const hoy = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dispo = a.dispoFecha ? new Date(a.dispoFecha + "T00:00:00").toLocaleDateString("es-MX") : "—";

  // 1) Con dinero pero con CR en error: revalidar
  const revalidar = P.presupuesto.filter((x) => x.s.error).sort((p, q) => imp(q) - imp(p));
  const crsRev = new Set(revalidar.map((x) => x.f.cr_contrarecibo).filter(Boolean));
  // 2) Oficio de apoyo
  const oficio = P.oficio.slice().sort((p, q) => imp(q) - imp(p));
  const apoyoDe = (s) => (s.apoyo || []).reduce((t, [, v]) => t + (Number(v) || 0), 0);
  const totalApoyo = oficio.reduce((t, x) => t + apoyoDe(x.s), 0);
  const otrasDe = (s) => (a.resumen.find((r) => r.contrato.id === s.contrato?.id && r.dictamen === s.dictamen)?.otras || []);
  // 2b) Hay saldo en el dictamen pero el contrato en FINAT no trae la ampliación: esperan el convenio modificatorio
  const convenio = (P.convenio || []).slice().sort((p, q) => imp(q) - imp(p));
  const porConv = {}; for (const x of convenio) (porConv[`${x.s.contrato?.numero_interno}|${x.s.dictamen}`] ||= []).push(x);
  // 3) No pasan
  const gDic = P.gestion.filter((x) => x.s.dictamen), gCta = P.gestion.filter((x) => !x.s.dictamen);
  const porCuenta = {}; for (const x of gCta) (porCuenta[x.s.cuenta || "—"] ||= []).push(x);
  // 4) Avance: por contrato
  const grupos = {}; for (const x of P.presupuesto) (grupos[x.s.contrato?.numero_interno || `Cuenta ${x.s.cuenta || "—"}`] ||= []).push(x);
  const listaG = Object.entries(grupos).map(([k, items]) => {
    const provs = new Set(items.map((x) => x.f.proveedores?.razon_social));
    const o = items.filter((x) => enOoad(x.f)).length;
    return { k, prov: provs.size > 1 ? "Varios proveedores" : items[0].f.proveedores?.razon_social || "", n: items.length, total: suma(items), donde: [o && `${o} en OOAD`, items.length - o && `${items.length - o} en firmas o pedido-recepción`].filter(Boolean).join(" · ") + (items.some((x) => x.s.error) ? " · CR en error: revalidar" : "") };
  }).sort((p, q) => q.total - p.total);
  const top = listaG.slice(0, 16), resto = listaG.slice(16);

  const fila = (celdas, cls = "") => `<tr class="${cls}">${celdas.map((c) => `<td${c.n ? ' class="n"' : ""}>${c.t ?? c}</td>`).join("")}</tr>`;
  const N = (t) => ({ t, n: true });

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Facturas que pueden pasar ${hoy}</title><style>
@page { size: Letter landscape; margin: 13mm; }
* { box-sizing: border-box; } body { font-family: Calibri, "Segoe UI", Arial, sans-serif; color: #1f2937; font-size: 10.5pt; margin: 0; }
h1 { font-size: 19pt; margin: 0 0 2px; } .sub { color: #4b5563; margin-bottom: 8px; }
.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 8px 0 10px; }
.m { background: #f1ebfd; } .m .n { color: #6d28d9; } h2.m { background: #6d28d9; }
.kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; } .kpi .n { font-size: 16pt; font-weight: 700; } .kpi .l { font-size: 9.5pt; color: #4b5563; }
.v { background: #e6f4ea; } .v .n { color: #1a6b3c; } .a { background: #fff4d6; } .a .n { color: #9a6700; } .r { background: #fde8e7; } .r .n { color: #b42318; } .z { background: #e8f0fb; } .z .n { color: #2f5f9e; }
h2 { font-size: 12.5pt; margin: 12px 0 4px; padding: 5px 9px; border-radius: 6px; color: #fff; page-break-after: avoid; break-after: avoid; }
h2.v { background: #1a6b3c; } h2.a { background: #9a6700; } h2.r { background: #b42318; } h2.z { background: #2f5f9e; }
.nota { font-size: 9.5pt; color: #4b5563; margin: 2px 0 5px; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; margin: 3px 0 6px; } tr { page-break-inside: avoid; }
th { background: #2f3b48; color: #fff; font-size: 9pt; text-align: left; padding: 4px 6px; } td { border-bottom: 1px solid #e5e7eb; padding: 4px 6px; font-size: 9.5pt; vertical-align: top; }
td.n, th.n { text-align: right; white-space: nowrap; } tr.tot td { font-weight: 700; background: #eef0f3; }
.caja { border: 1px solid #e5e7eb; border-left: 5px solid #2f5f9e; border-radius: 6px; padding: 6px 10px; margin: 6px 0; font-size: 10pt; page-break-inside: avoid; }
.bloque { page-break-inside: avoid; break-inside: avoid; } .pie { margin-top: 10px; font-size: 8.5pt; color: #6b7280; }
.boton { position: fixed; top: 10px; right: 10px; padding: 8px 14px; background: #1a6b3c; color: #fff; border: 0; border-radius: 8px; font-size: 11pt; cursor: pointer; }
@media print { .boton { display: none; } }
</style></head><body>
<button class="boton" onclick="window.print()">Guardar como PDF</button>
<h1>Facturas que pueden pasar con los saldos de dictamen del ${hoy}</h1>
<div class="sub">HGZ No. 2 · Oficina de Presupuesto · IMKK036 de FINAT y dispo del ${dispo} · Fuente: SIGAF, Bandeja de avisos</div>
<div class="kpis">
  <div class="kpi v"><div class="n">${money(suma(revalidar))}</div><div class="l">Pedir a OOAD que revalide: ${revalidar.length} factura(s), ${crsRev.size} CR en error que ya tienen saldo o dispo</div></div>
  <div class="kpi a"><div class="n">${money(suma(oficio))}</div><div class="l">Con oficio de apoyo: ${oficio.length} factura(s) (apoyo a pedir ${money(totalApoyo)})</div></div>
  <div class="kpi m"><div class="n">${money(suma(convenio))}</div><div class="l">En espera de convenio modificatorio: ${convenio.length} factura(s); hay dictamen, pero el contrato en FINAT no trae la ampliación</div></div>
  <div class="kpi r"><div class="n">${money(suma(P.gestion))}</div><div class="l">No pasan: ${P.gestion.length} factura(s) requieren ampliación de dictamen o presupuesto</div></div>
  <div class="kpi z"><div class="n">${money(suma(P.presupuesto))}</div><div class="l">Ya tienen presupuesto: ${P.presupuesto.length} factura(s) para empujar el avance</div></div>
</div>

<h2 class="v">1. Ya tienen saldo: pedir a OOAD que revaliden el CR</h2>
<div class="nota">Cayeron en error de presupuesto cuando no había dinero; con los saldos de hoy ya alcanzan.</div>
${revalidar.length ? `<table><tr><th>Factura SIGAF</th><th>Factura</th><th>Proveedor</th><th>Contrato / cuenta</th><th>CR</th><th class="n">Importe</th><th>Acción</th></tr>
${revalidar.map((x) => fila([esc(x.f.folio_ingreso), esc(x.f.folio_proveedor), esc(x.f.proveedores?.razon_social), esc(contratoTxt(x.s)), esc(x.f.cr_contrarecibo), N(money(imp(x))), esc(x.s.t)])).join("")}
${fila([`Total · ${revalidar.length} factura(s), ${crsRev.size} CR`, "", "", "", "", N(money(suma(revalidar))), ""], "tot")}</table>` : `<div class="nota">Ninguna factura con CR en error tiene ya dinero.</div>`}

<div class="bloque"><h2 class="a">2. Pueden pasar con oficio de apoyo</h2>
<div class="nota">El saldo del HGZ 2 no alcanza para la factura completa, pero otra unidad del mismo dictamen tiene saldo. El oficio se genera en Bandeja de avisos → "Ver lista completa y generar oficio".</div>
${oficio.length ? `<table><tr><th>Factura SIGAF</th><th>Factura</th><th>Contrato · dictamen</th><th>Dónde va</th><th class="n">Importe</th><th class="n">Paga HGZ 2</th><th class="n">Apoyo a pedir</th><th>Unidad que apoya (saldo al día)</th></tr>
${oficio.map((x) => fila([esc(x.f.folio_ingreso), esc(x.f.folio_proveedor), esc(`${x.s.contrato?.numero_interno || ""} ${x.s.contrato?.proveedores?.razon_social || ""} · ${x.s.dictamen || ""}`), esc(dondeVa(x.f)) + (x.s.error ? " · CR en error" : ""), N(money(imp(x))), N(money(imp(x) - apoyoDe(x.s))), N(`<b>${money(apoyoDe(x.s))}</b>`), esc((x.s.apoyo || []).map(([ui]) => `UI ${ui}${(() => { const o = otrasDe(x.s).find(([u]) => u === ui); return o ? ` (${money(o[1])})` : ""; })()}`).join(", "))])).join("")}
${fila(["Total", "", "", "", N(money(suma(oficio))), N(money(suma(oficio) - totalApoyo)), N(money(totalApoyo)), ""], "tot")}</table>` : `<div class="nota">Ninguna factura necesita oficio de apoyo.</div>`}</div>

${convenio.length ? `<div class="bloque"><h2 class="m">En espera del convenio modificatorio (no pasan todavía)</h2>
<div class="nota">El dictamen ya tiene el dinero, pero FINAT valida contra el <b>contrato</b>, y el contrato todavía no trae la ampliación (IMKK036, página 3: "Saldo comprometido sin contrato" = importe definitivo − máximo de los contratos asociados). Aunque se pida revalidar el CR, no pasan hasta que se formalice y se registre el convenio modificatorio en FINAT ("en espera CM"). Lo que hay que empujar es el convenio, no el presupuesto.</div>
${Object.values(porConv).map((items) => { const s = items[0].s; return `<div class="caja" style="border-left-color:#6d28d9"><b>${esc(s.contrato?.numero_interno)} · ${esc(s.contrato?.proveedores?.razon_social)}</b> · dictamen ${esc(s.dictamen)} · saldo del contrato en FINAT <b>${money(s.saldoContrato)}</b> · del dictamen sin contrato <b>${money(s.sinContrato)}</b> · el saldo del contrato lo comparten las tres unidades</div>
<table><tr><th>Factura SIGAF</th><th>Factura</th><th>Dónde va</th><th>CR</th><th class="n">Importe</th><th>Qué falta</th></tr>
${items.map((x) => fila([esc(x.f.folio_ingreso), esc(x.f.folio_proveedor), esc(dondeVa(x.f)), esc(x.f.cr_contrarecibo || "—") + (x.s.error ? " (error)" : ""), N(money(imp(x))), x.s.apoyo?.length ? "Convenio, luego oficio de apoyo y revalidar" : x.s.error ? "Convenio registrado en FINAT, luego revalidar el CR" : "Convenio registrado en FINAT"])).join("")}
${fila(["Total", "", "", "", N(money(suma(items))), ""], "tot")}</table>`; }).join("")}</div>` : ""}

<div class="bloque"><h2 class="r">3. No pasan con los saldos de hoy</h2>
${gDic.length ? `<table><tr><th>Factura SIGAF</th><th>Factura</th><th>Proveedor · contrato</th><th>CR</th><th class="n">Importe</th><th class="n">Faltan</th><th>Qué se necesita</th></tr>
${gDic.sort((p, q) => imp(q) - imp(p)).map((x) => fila([esc(x.f.folio_ingreso), esc(x.f.folio_proveedor), esc(`${x.f.proveedores?.razon_social || ""} · ${contratoTxt(x.s)}`), esc(x.f.cr_contrarecibo || "—") + (x.s.error ? " error" : ""), N(money(imp(x))), N(money(x.s.falta)), "Ampliación de dictamen"])).join("")}
${fila(["Total con dictamen", "", "", "", N(money(suma(gDic))), "", ""], "tot")}</table>` : ""}
${gCta.length ? `<div class="nota">Sin dictamen y sin dispo suficiente en ${esc(a.mes)}: ${gCta.length} factura(s) por ${money(suma(gCta))} que dependen del presupuesto de la cuenta: ${Object.entries(porCuenta).sort(([, p], [, q]) => suma(q) - suma(p)).map(([c, items]) => `${esc(c)} (${money(suma(items))}, ${items.length} fact.)`).join(" · ")}.</div>` : ""}
${!P.gestion.length ? `<div class="nota">Ninguna factura se queda sin camino.</div>` : ""}</div>

<h2 class="z">4. Ya tienen presupuesto: presionar el avance</h2>
<div class="nota">${P.presupuesto.length} factura(s) por ${money(suma(P.presupuesto))} tienen dinero, pero muchas siguen en el servicio, en firmas o sin pedido-recepción. Mientras no avanzan, el saldo se queda ocioso.</div>
<table><tr><th>Contrato</th><th>Proveedor</th><th class="n">Facturas</th><th class="n">Importe</th><th>Dónde están</th></tr>
${top.map((g) => fila([esc(g.k), esc(g.prov), N(g.n), N(money(g.total)), esc(g.donde)])).join("")}
${resto.length ? fila([`Otros ${resto.length} contrato(s)`, "", N(resto.reduce((t, g) => t + g.n, 0)), N(money(resto.reduce((t, g) => t + g.total, 0))), ""]) : ""}
${fila(["Total con presupuesto", "", N(P.presupuesto.length), N(money(suma(P.presupuesto))), ""], "tot")}</table>
${a.conPR.length ? `<div class="caja"><b>Con pedido-recepción ya generado y sin mandar a OOAD:</b> ${a.conPR.map(({ f, lista }) => `${esc(f.proveedores?.razon_social)} ${esc(f.folio_proveedor)} ${money(f.importe_factura)} (${lista ? "lista para OOAD" : "faltan firmas"})`).join(" · ")}.</div>` : ""}
<div class="caja">${a.listasOOAD.length ? `<b>Listas para mandar a OOAD hoy:</b> ${a.listasOOAD.length} factura(s) por ${money(a.listasOOAD.reduce((t, x) => t + (Number(x.f.importe_factura) || 0), 0))}.` : "<b>No hay facturas listas para mandar a OOAD hoy:</b> a todas les falta firma o pedido-recepción."}</div>
${a.ooadSinPR.length || P.aclarar.length ? `<div class="caja" style="border-left-color:#b42318">${a.ooadSinPR.length ? `<b>Revisar hoy:</b> ${a.ooadSinPR.map((f) => `${esc(f.folio_ingreso)} (${esc(f.proveedores?.razon_social)}, ${esc(f.folio_proveedor)}, ${money(f.importe_factura)})`).join(" · ")} marcada(s) en OOAD sin CR y sin cumplir el candado.<br>` : ""}${P.aclarar.length ? `<b>Por aclarar:</b> ${P.aclarar.length} factura(s) (${money(suma(P.aclarar))}) donde FINAT trae pagos que SIGAF no tiene como pagados: ${P.aclarar.map((x) => `${esc(x.f.proveedores?.razon_social)} ${esc(x.f.folio_proveedor)} ${money(imp(x))}`).join(" · ")}.` : ""}</div>` : ""}
<div class="pie">Saldo de cada dictamen = "Disponible Acum" del IMKK036 menos los CR validados después del corte y los apoyos registrados. Las facturas de un mismo dictamen se acomodan en el orden en que piden dinero (primero las de OOAD). Generado con SIGAF HGZ 2 el ${hoy}.</div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) throw new Error("El navegador bloqueó la ventana: permite ventanas emergentes para SIGAF");
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 400);
}
