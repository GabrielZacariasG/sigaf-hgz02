// Excel ejecutivo del reporte "Cruce vs compras emergentes" (Reportes · R12), con formato:
// banda de título, tarjetas, tablas con encabezado verde, montos con $, TOTAL resaltado y estatus en color.
// Recibe el objeto `res` que arma la pantalla de Reportes (tarjetas + secciones) y devuelve el archivo como ArrayBuffer.

const VERDE = "FF0B5D3B", VERDE_CLARO = "FFD9EAD3", GRIS = "FF6B7280", BORDE = "FFD1D5DB", ZEBRA = "FFF6F8F7";
const MONEDA = '"$"#,##0.00;[Red]-"$"#,##0.00', ENTERO = "#,##0", PCT = "0.0%";
const ESTATUS = {
  "Falta generar OC": ["FFFCE4C4", "FF9C5700"],
  "Falta poco": ["FFFFF2CC", "FF7F6000"],
  "Cubierto": ["FFE2F0D9", "FF2E6B30"],
  "Sin disponible (pedir póliza)": ["FFF8D7DA", "FF9B1C1C"],
};
const relleno = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fino = { style: "thin", color: { argb: BORDE } };
const bordes = { top: fino, left: fino, bottom: fino, right: fino };

// Valor de celda: montos como número; "89.9%" como porcentaje; "" o null en blanco
function valor(c, v) {
  if (v === "" || v == null) return null;
  if (c.money) return Number(v) || 0;
  if (typeof v === "string" && /^-?\d+(\.\d+)?%$/.test(v)) return Number(v.slice(0, -1)) / 100;
  return v;
}
function formatoNum(c, v) {
  if (c.money) return MONEDA;
  if (typeof v === "string" && /%$/.test(v)) return PCT;
  if (typeof v === "number" && Number.isInteger(v)) return ENTERO;
  return undefined;
}

// Escribe una tabla a partir de la fila `r`; devuelve la siguiente fila libre
function tabla(ws, r, s, { titulo = true, ancho } = {}) {
  const n = s.columns.length;
  if (titulo) {
    const t = ws.getRow(r);
    t.getCell(1).value = s.titulo;
    t.getCell(1).font = { bold: true, size: 12.5, color: { argb: VERDE } };
    t.height = 22;
    ws.mergeCells(r, 1, r, n);
    t.getCell(1).border = { bottom: { style: "medium", color: { argb: VERDE } } };
    r++;
  }
  const h = ws.getRow(r);
  s.columns.forEach((c, i) => {
    const cel = h.getCell(i + 1);
    cel.value = c.label;
    cel.fill = relleno(VERDE);
    cel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cel.alignment = { vertical: "middle", horizontal: c.align === "right" ? "right" : "left", wrapText: true };
    cel.border = bordes;
  });
  h.height = 30;
  const filaEnc = r;
  r++;
  s.rows.forEach((row, k) => {
    const f = ws.getRow(r);
    s.columns.forEach((c, i) => {
      const cel = f.getCell(i + 1);
      cel.value = valor(c, row[c.key]);
      const nf = formatoNum(c, row[c.key]); if (nf) cel.numFmt = nf;
      cel.border = bordes;
      cel.font = { size: 10 };
      cel.alignment = { vertical: "top", horizontal: c.align === "right" ? "right" : "left", wrapText: !c.money && c.key !== "estatus" };
      if (row._rojo) { cel.fill = relleno("FFFDE8E8"); if (c.key === "enSigaf") cel.font = { size: 10, bold: true, color: { argb: "FF9B1C1C" } }; }
      else if (k % 2 === 1) cel.fill = relleno(ZEBRA);
      if (c.key === "estatus" && ESTATUS[row[c.key]]) { const [fondo, letra] = ESTATUS[row[c.key]]; cel.fill = relleno(fondo); cel.font = { size: 10, bold: true, color: { argb: letra } }; }
    });
    r++;
  });
  if (s.rows.length === 0) { const cel = ws.getRow(r).getCell(1); cel.value = "Nada que señalar."; cel.font = { italic: true, color: { argb: GRIS } }; r++; }
  if (s.totales) {
    const f = ws.getRow(r);
    s.columns.forEach((c, i) => {
      const cel = f.getCell(i + 1);
      const v = s.totales[c.key];
      cel.value = v != null ? valor(c, v) : null;
      const nf = formatoNum(c, v); if (nf) cel.numFmt = nf;
      cel.fill = relleno(VERDE_CLARO);
      cel.font = { bold: true, size: 10.5 };
      cel.alignment = { horizontal: c.align === "right" ? "right" : "left" };
      cel.border = { ...bordes, top: { style: "medium", color: { argb: VERDE } } };
    });
    r++;
  }
  if (s.nota) {
    const nr = ws.getRow(r);
    nr.getCell(1).value = s.nota;
    nr.getCell(1).font = { italic: true, size: 9, color: { argb: GRIS } };
    nr.getCell(1).alignment = { wrapText: true, vertical: "top" };
    ws.mergeCells(r, 1, r, Math.max(n, ancho || n));
    nr.height = Math.min(60, 14 * Math.ceil(s.nota.length / 140));
    r++;
  }
  return { siguiente: r + 1, filaEnc, ultima: r - 1 };
}

export async function excelCruceCE(ExcelJS, res) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGAF HGZ No. 02";
  wb.created = new Date();
  const enDin = res.secciones.filter((s) => !s.hoja);
  const ancho = Math.max(...enDin.map((s) => s.columns.length), 6);

  // ---------------- Dinámicas ----------------
  const ws = wb.addWorksheet("Dinamicas", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: "&L&8SIGAF · HGZ No. 02&R&8Página &P de &N" },
  });
  ws.columns = [{ width: 46 }, ...Array(ancho - 1).fill(0).map((_, i) => ({ width: enDin.some((s) => s.columns[i + 1]?.key === "estatus") ? 30 : 17 }))];
  // Banda de título
  ws.mergeCells(1, 1, 1, ancho);
  const t = ws.getCell(1, 1);
  t.value = "COMPRA EMERGENTE HGZ No. 02  ·  " + res.titulo.toUpperCase();
  t.fill = relleno(VERDE); t.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } }; t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 32;
  ws.mergeCells(2, 1, 2, ancho);
  const st = ws.getCell(2, 1);
  st.value = res.resumen || ""; st.font = { italic: true, size: 10, color: { argb: GRIS } }; st.alignment = { indent: 1 };
  let r = 4;
  // Tarjetas: columna A, luego bloques de 2 columnas
  if (res.tarjetas?.length) {
    const bloques = [[1, 1], [2, 3], [4, 5], [6, 7], [8, 9]];
    res.tarjetas.forEach((tj, i) => {
      const [c1, c2] = bloques[i] || [1, 1];
      const color = tj.alerta ? "FF9B1C1C" : VERDE, fondo = tj.alerta ? "FFFDECEC" : "FFF1F7F3";
      [[r, tj.label.toUpperCase(), { size: 9, bold: true, color: { argb: GRIS } }, null],
       [r + 1, Number(tj.valor) || 0, { size: 18, bold: true, color: { argb: color } }, MONEDA],
       [r + 2, tj.sub, { size: 10, color: { argb: GRIS } }, null]].forEach(([fila, v, font, nf]) => {
        if (c2 > c1) ws.mergeCells(fila, c1, fila, c2);
        const cel = ws.getCell(fila, c1);
        cel.value = v; cel.font = font; if (nf) cel.numFmt = nf;
        cel.alignment = { indent: 1, vertical: "middle", horizontal: "left" };
        for (let c = c1; c <= c2; c++) {
          const x = ws.getCell(fila, c);
          x.fill = relleno(fondo);
          x.border = { left: c === c1 ? { style: "thin", color: { argb: BORDE } } : undefined, right: c === c2 ? { style: "thin", color: { argb: BORDE } } : undefined,
            top: fila === r ? { style: "thick", color: { argb: color } } : undefined, bottom: fila === r + 2 ? { style: "thin", color: { argb: BORDE } } : undefined };
        }
      });
    });
    ws.getRow(r + 1).height = 28;
    r += 4;
  }
  for (const s of enDin) r = tabla(ws, r, s, { ancho }).siguiente;

  // ---------------- Pestañas con tablas grandes (filtro y encabezado fijo) ----------------
  for (const s of res.secciones.filter((x) => x.hoja)) {
    const h = wb.addWorksheet(s.hoja, {
      views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
      pageSetup: { orientation: "landscape", paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1", margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
      headerFooter: { oddFooter: `&L&8${s.titulo} · SIGAF HGZ No. 02&R&8Página &P de &N` },
    });
    const anchos = { folio: 13, alta: 10, oc: 12, fechaFolio: 11, mes: 9, partida: 8, concepto: 34, proveedor: 34, articulo: 34, factura: 12, total: 16, enSigaf: 11, folioSigaf: 21, etapa: 26,
      cr: 11, importeSigaf: 16, tipo: 34, sigaf: 21, detalle: 70, importe: 14 };
    h.columns = s.columns.map((c) => ({ width: anchos[c.key] || 16 }));
    const { filaEnc, ultima } = tabla(h, 1, { ...s, nota: "" }, { titulo: false });
    h.autoFilter = { from: { row: filaEnc, column: 1 }, to: { row: Math.max(filaEnc, ultima - (s.totales ? 1 : 0)), column: s.columns.length } };
    if (s.nota) { const nr = h.getRow(ultima + 2); nr.getCell(1).value = s.nota; nr.getCell(1).font = { italic: true, size: 9, color: { argb: GRIS } }; }
  }
  return wb.xlsx.writeBuffer();
}
