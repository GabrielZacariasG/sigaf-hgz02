// Precarga de pliegos que manda Servicios Generales: Control semanal (detalle por folio) e Informe quincenal (totales por persona).

const nk = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const folioNorm = (s) => nk(String(s ?? "").split("/")[0]).replace(/^FP0*/, "FP");
const anioDe = (s) => (/\/(\d{4})\s*$/.exec(String(s ?? "")) || [])[1] || "";
function fechaISO(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  return "";
}
const num = (v) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,\s]/g, "")) || 0);

function buscarEncabezado(grid, requeridas) {
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cab = grid[i].map(nk);
    if (requeridas.every((r) => cab.includes(nk(r)))) return { i, col: (n) => cab.indexOf(nk(n)) };
  }
  return null;
}

// Lugar del Control -> destino del catálogo. MEXICO no se adivina: hay tres destinos con ese nombre.
export function destinoDe(lugar) {
  const k = nk(lugar);
  if (k.startsWith("LEON")) return "LEON, GTO.";
  if (k.startsWith("GUADALAJARA") || k === "JALISCO") return "GUADALAJARA, JAL.";
  if (k.startsWith("DURANGO")) return "DURANGO";
  if (k.startsWith("FRESNILLO")) return "FRESNILLO, ZAC.";
  if (k.startsWith("PUEBLA")) return "PUEBLA, PUE.";
  if (k === "MEXICOORIENTE") return "MEXICO ORIENTE";
  if (k === "MEXICOPONIENTE") return "MEXICO PONIENTE";
  if (k === "CDMX" || k === "CIUDADDEMEXICO") return "CIUDAD DE MEXICO";
  return "";
}

export function leerControl(grid) {
  const e = buscarEncabezado(grid, ["FOLIO", "MATRICULA", "LUGAR", "MONTO"]);
  if (!e) return null;
  const c = e.col;
  return grid.slice(e.i + 1).filter((f) => String(f[c("FOLIO")] ?? "").trim()).map((f) => {
    const folio = String(f[c("FOLIO")]).trim(), fecha = fechaISO(f[c("FECHA")]);
    const monto = num(f[c("MONTO")]), peaje = num(f[c("PEAJE")]);
    return {
      folio, clave: folioNorm(folio), anio: anioDe(folio) || fecha.slice(0, 4), fecha, matricula: String(f[c("MATRICULA")] ?? "").trim(),
      nombre: String(f[c("NOMBRE")] ?? "").trim(), turnoSG: String(f[c("TURNO")] ?? "").trim(), lugar: String(f[c("LUGAR")] ?? "").trim(),
      destino: destinoDe(f[c("LUGAR")]), importe: monto ? Math.round((monto - peaje) * 100) / 100 : null, casetas: peaje,
      unidad: String(f[c("UNIDAD")] ?? "").trim(), estatusSG: String(f[c("ESTATUS")] ?? "").trim(), obsSG: String(f[c("OBSERVACIONES")] ?? "").trim(),
    };
  });
}

export function leerInforme(grid) {
  const e = buscarEncabezado(grid, ["Núm. Provedor", "NVIA", "PLIEGOS", "NOMBRE"]);
  if (!e) return null;
  const c = e.col;
  return grid.slice(e.i + 1).filter((f) => String(f[c("Núm. Provedor")] ?? "").trim() && String(f[c("PLIEGOS")] ?? "").trim()).map((f) => ({
    matricula: String(f[c("Núm. Provedor")]).trim(), nombre: String(f[c("NOMBRE")] ?? "").trim(), total: num(f[c("Importe del Viático")]),
    gravado: num(f[c("Importe gravado (VIG)")]), exento: num(f[c("Importe exento (VIE)")]),
    folios: String(f[c("PLIEGOS")]).split(",").map((s) => s.trim()).filter(Boolean),
  }));
}

// Une ambos por folio. Del Informe solo se toma importe por folio si la persona trae un solo folio.
export function unirPrecarga(control = [], informe = []) {
  const items = new Map();
  for (const r of control) items.set(r.clave + "|" + r.anio, { ...r, fuentes: ["Control"] });
  for (const p of informe) {
    for (const folio of p.folios) {
      const clave = folioNorm(folio), anio = anioDe(folio);
      const k = clave + "|" + anio;
      const solo = p.folios.length === 1;
      const previo = items.get(k);
      if (previo) {
        previo.fuentes.push("Informe");
        previo.totalPersona = p.total; previo.foliosPersona = p.folios.length;
        if (previo.importe == null && solo) { previo.importe = p.exento || null; previo.casetas = p.exento ? p.gravado : previo.casetas; }
      } else {
        items.set(k, { folio, clave, anio, fecha: "", matricula: p.matricula, nombre: p.nombre, turnoSG: "", lugar: "", destino: "", importe: solo && p.exento ? p.exento : null, casetas: solo && p.exento ? p.gravado : 0, unidad: "", estatusSG: "", obsSG: "", fuentes: ["Informe"], totalPersona: p.total, foliosPersona: p.folios.length });
      }
    }
  }
  return [...items.values()];
}

// Compara lo que dice el pliego físico con lo precargado.
export function compararConPrecarga(item, p) {
  const av = [];
  if (!item) return av;
  if (item.matricula && p.matricula && item.matricula !== p.matricula) av.push(`La matrícula no coincide con la relación (${item.matricula}).`);
  if (item.fecha && p.fecha && item.fecha !== p.fecha) av.push(`La fecha no coincide con la relación (${item.fecha}).`);
  if (item.destino && p.destino && item.destino !== p.destino) av.push(`El destino no coincide con la relación (${item.destino}).`);
  if (item.importe != null && p.importe !== "" && Math.abs(Number(p.importe) - item.importe) > 0.01) av.push(`El importe no coincide con la relación ($${item.importe.toFixed(2)}).`);
  if (item.casetas && Math.abs((Number(p.casetas) || 0) - item.casetas) > 0.01) av.push(`Las casetas no coinciden con la relación ($${item.casetas.toFixed(2)}).`);
  return av;
}
