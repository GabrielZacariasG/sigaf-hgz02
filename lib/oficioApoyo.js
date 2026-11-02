// Oficio de apoyo presupuestal en Word: llena public/plantillas/oficio-apoyo.docx (formato del OF 107 de Gabriel)
// con las facturas que caben en un contrato. El número de oficio queda en blanco para ponerlo en Word.
const MES_CORTO = ["", "ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pesos = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const xmlSeguro = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const quitaAcentos = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// Datos del oficio a partir de las facturas de la lista "oficio" de un contrato ({ f, s } de lib/avisos.js)
export function datosOficio(items, hoy = new Date()) {
  const { contrato } = items[0].s;
  const sufijo = `${contrato.numero_interno}-${String(hoy.getFullYear()).slice(-2)}`;
  const cuentas = new Map();
  for (const { f, s } of items) {
    const cuenta = s.lineas?.[0]?.cuenta || f.partidas?.cuenta_finat || f.partidas?.cuenta_prei || "";
    if (!cuentas.has(cuenta)) cuentas.set(cuenta, f.partidas?.nombre || "");
  }
  // Todos los oficios de muestra los firma la Dra. Hilda; si el administrador es otro, el cargo se completa en Word
  const adminCaptura = String(contrato.administrador_contrato || "").trim();
  const esHilda = /HILDA/.test(quitaAcentos(adminCaptura).toUpperCase());
  return {
    oficio: `019001/2H0100/____/${hoy.getFullYear()}`,
    fecha: `${hoy.getDate()} de ${MES_LARGO[hoy.getMonth()]} de ${hoy.getFullYear()}`,
    encabezado: `Contrato ${sufijo}, Proveedor ${contrato.proveedores?.razon_social || ""}, ${[...cuentas].map(([c, n]) => `Cuenta ${c} “${n}”`).join(", ")}:`,
    admin: esHilda ? "Dra. Hilda Mónica López Cervantes" : adminCaptura,
    cargo: `${esHilda ? "Coordinadora de prevención y atención a la salud/" : ""}Administrador del contrato ${sufijo}.`,
    facturas: items.slice().sort((a, b) => String(a.f.folio_proveedor).localeCompare(String(b.f.folio_proveedor), "es", { numeric: true })).map(({ f, s }) => ({
      cr: f.cr_contrarecibo || "",
      factura: `(${MES_CORTO[Number(f.mes_presupuestal)] || "—"}) ${f.folio_proveedor || ""}`,
      importe: pesos(f.importe_factura),
      apoyos: (s.lineas || []).slice().sort((a, b) => String(a.ui).localeCompare(String(b.ui))).map((l) => ({ ui: l.ui, cc: l.centro || "", importe: pesos(l.importe) })),
    })),
  };
}

// Llena el document.xml de la plantilla. Quita los identificadores de párrafo al repetir renglones (Word los pide únicos).
export function llenarDocumento(xml, d) {
  const fila = xml.match(/<w:tr[ >](?:(?!<\/w:tr>)[\s\S])*?\{\{CR\}\}[\s\S]*?<\/w:tr>/)[0];
  const siguiente = xml.slice(xml.indexOf(fila) + fila.length).match(/^\s*<w:tr[ >][\s\S]*?<\/w:tr>/)[0];
  const limpia = (s) => s.replace(/ w14:(paraId|textId)="[^"]*"/g, "");
  const poner = (molde, v) => limpia(molde).replace(/\{\{([A-Z]+)\}\}/g, (m, k) => (k in v ? xmlSeguro(v[k]) : m));
  const filas = d.facturas.flatMap((f) => {
    const [pri, ...resto] = f.apoyos.length ? f.apoyos : [{ ui: "", cc: "", importe: "" }];
    return [
      poner(fila, { CR: f.cr, FACTURA: f.factura, IMPORTE: f.importe, UI: pri.ui, CC: pri.cc, APOYO: pri.importe }),
      ...resto.map((a) => poner(siguiente, { UI: a.ui, CC: a.cc, APOYO: a.importe })),
    ];
  }).join("");
  return xml.replace(fila + siguiente, () => filas)
    .replace(/\{\{OFICIO\}\}/g, () => xmlSeguro(d.oficio)).replace(/\{\{FECHA\}\}/g, () => xmlSeguro(d.fecha))
    .replace(/\{\{ENCABEZADO\}\}/g, () => xmlSeguro(d.encabezado)).replace(/\{\{ADMIN\}\}/g, () => xmlSeguro(d.admin)).replace(/\{\{CARGO\}\}/g, () => xmlSeguro(d.cargo));
}

// Unidades de la muestra: el último dígito de la UI es el número de HGZ (010101 = HGZ 1, 010103 = HGZ 3)
export function nombreArchivo(items) {
  const hgz = [...new Set(items.flatMap(({ s }) => (s.lineas || []).map((l) => Number(String(l.ui).slice(-1)))))].sort();
  return `OFICIO DE APOYO HGZ ${hgz.join(" ")} CONTRATO ${items[0].s.contrato.numero_interno}.docx`;
}

export async function descargarOficio(items) {
  const JSZip = (await import("jszip")).default;
  const r = await fetch("/plantillas/oficio-apoyo.docx");
  if (!r.ok) throw new Error("No se encontró la plantilla del oficio.");
  const zip = await JSZip.loadAsync(await r.arrayBuffer());
  zip.file("word/document.xml", llenarDocumento(await zip.file("word/document.xml").async("string"), datosOficio(items)));
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombreArchivo(items);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
