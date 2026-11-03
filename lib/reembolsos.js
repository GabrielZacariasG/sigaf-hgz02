// Fondo fijo: tipos de gasto, cuotas y armado del reembolso (Relación de Gastos y memorándum a la Oficina de Trámite).
// Cuentas y centros de costo: los que traen los comprobantes de OOAD y la disponibilidad.

export const UNIDAD = "010102";
export const PERMANENTE = "010102 200200";
export const PROVEEDOR_FONDO = "49051";
const CUOTA_PERNOCTA = { 2025: 113.14, 2026: 117.31 }; // observada en la captura; sin documento oficial todavía

export const TIPOS_GASTO = {
  PLIEGO: { nombre: "Pliego de comisión", cuenta: "51371007", cc: "141901", prefijo: "V" },
  PERNOCTA: { nombre: "Pernocta a paciente (STP)", cuenta: "52411024", cc: "200905", prefijo: "T" },
  BOLETO: { nombre: "Boletos a paciente", cuenta: "52411024", cc: "200905", prefijo: "T" },
  PASAJE: { nombre: "Pasajes al personal", cuenta: "51371004", cc: "200200", prefijo: "O" },
  OTRA: { nombre: "Otra cuenta (factura)", cuenta: "", cc: "", prefijo: "O" },
};
export const CC_PASAJES = ["200200", "340909"];
export const OTRAS_CUENTAS = [
  { cuenta: "51391001", nombre: "Derechos federales, estatales y municipales", cc: "200200" },
  { cuenta: "51251002", nombre: "Medicamentos", cc: "200223" },
  { cuenta: "51371005", nombre: "Pasajes terrestres nacionales", cc: "141901" },
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const fechaLarga = (iso) => { const [a, m, d] = String(iso).split("-"); return a && m && d ? `${d} / ${MESES[+m - 1]} / ${a}` : ""; };
export const fechaCorta = (iso) => { const [a, m, d] = String(iso).split("-"); return a && m && d ? `${d}/${m}/${a}` : ""; };
export const folioFormato = (f) => String(f || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const dividirCuenta = (c) => ({ cuenta: String(c).slice(0, 4), sub: String(c).slice(4) });
const dias = (de, al) => Math.round((new Date(al) - new Date(de)) / 86400000) + 1;

// Pernocta: cuota diaria por días contando el primero y el último.
export function cuotaPernocta(de, al) {
  if (!de || !al || al < de) return null;
  const cuota = CUOTA_PERNOCTA[String(de).slice(0, 4)];
  return cuota ? { dias: dias(de, al), cuota, importe: r2(cuota * dias(de, al)) } : null;
}

// Revisa la captura de un gasto que no es pliego.
export function revisarGasto(g, capturados = [], hoy = new Date().toISOString().slice(0, 10)) {
  const av = [];
  const bloquea = (t) => av.push({ nivel: "bloquea", t });
  const avisa = (t) => av.push({ nivel: "avisa", t });
  const tipo = TIPOS_GASTO[g.tipo];
  const importe = Number(g.importe) || 0;
  let sugerido = null;
  if (!tipo) return { avisos: [{ nivel: "bloquea", t: "Elige el tipo de gasto." }], puedeGuardar: false, sugerido };
  if (!String(g.folio || "").trim()) bloquea("Falta el folio.");
  const repetido = capturados.find((c) => c.tipo === g.tipo && folioFormato(c.folio) === folioFormato(g.folio));
  if (g.folio && repetido) bloquea(`El folio ${g.folio} ya está capturado.`);
  if (!g.fecha) bloquea("Falta la fecha.");
  if (g.fecha && g.fecha > hoy) bloquea("La fecha es futura.");
  if (!importe) bloquea("Falta el importe.");
  if (g.tipo === "PERNOCTA" || g.tipo === "BOLETO") {
    if (!String(g.nss || "").trim() || !String(g.paciente || "").trim()) bloquea("Faltan NSS y paciente.");
    if (!String(g.acompanante || "").trim()) avisa("Falta el acompañante.");
    if (!String(g.destino || "").trim()) bloquea("Falta la unidad de destino.");
  }
  if (g.tipo === "PERNOCTA") {
    if (!g.de || !g.al) bloquea("Faltan las fechas de la estancia.");
    else if (g.al < g.de) bloquea("La fecha final es anterior a la inicial.");
    else {
      sugerido = cuotaPernocta(g.de, g.al);
      const mismo = capturados.find((c) => c.tipo === "PERNOCTA" && c.nss === g.nss && c.de <= g.al && g.de <= c.al);
      if (g.nss && mismo) bloquea(`El mismo NSS ya tiene pernocta en esas fechas (folio ${mismo.folio}).`);
      if (sugerido && importe && Math.abs(importe - sugerido.importe) > 0.01) avisa(`POR CONFIRMAR: con $${sugerido.cuota} por ${sugerido.dias} día(s) serían $${sugerido.importe.toFixed(2)}.`);
    }
  }
  if (g.tipo === "BOLETO" && !String(g.comprobante || "").trim()) avisa("Falta el número de boleto o comprobante.");
  if (g.tipo === "PASAJE") {
    if (!String(g.matricula || "").trim() || !String(g.persona || "").trim()) bloquea("Faltan matrícula y persona.");
    if (!Number(g.dias)) bloquea("Faltan los días pagados.");
    if (!CC_PASAJES.includes(g.cc)) bloquea("Elige el centro de costo.");
    if (!String(g.destino || "").trim()) avisa("Falta la unidad a la que se trasladó.");
  }
  if (g.tipo === "OTRA") {
    if (!/^\d{8}$/.test(String(g.cuenta || ""))) bloquea("Elige una sola cuenta de 8 dígitos.");
    if (!String(g.cc || "").trim()) bloquea("Falta el centro de costo.");
    if (!String(g.proveedor || "").trim()) bloquea("Falta el proveedor.");
    const misma = capturados.find((c) => c.tipo === "OTRA" && c.proveedor === g.proveedor && folioFormato(c.folio) === folioFormato(g.folio));
    if (misma) bloquea("Esa factura de ese proveedor ya está capturada.");
    const parecida = capturados.find((c) => c.tipo === "OTRA" && c.proveedor === g.proveedor && Math.abs((c.importe || 0) - importe) < 0.01 && importe);
    if (parecida) avisa(`Mismo proveedor e importe que el folio ${parecida.folio}: revisa que no sea doble.`);
  }
  return { avisos: av, puedeGuardar: !av.some((a) => a.nivel === "bloquea"), sugerido };
}

const cuentaDe = (m) => m.cuenta || TIPOS_GASTO[m.tipo]?.cuenta || "";
const ccDe = (m) => m.cc || TIPOS_GASTO[m.tipo]?.cc || "";

// Arma el reembolso. "movs" son los comprobantes elegidos.
export function armarReembolso(movs, { numero, anio, fecha, acumuladoAnterior = 0, usados = [] } = {}) {
  const av = [];
  if (!movs.length) av.push({ nivel: "bloquea", t: "Selecciona al menos un comprobante." });
  const prefijos = [...new Set(movs.map((m) => TIPOS_GASTO[m.tipo]?.prefijo))];
  if (prefijos.length > 1) av.push({ nivel: "bloquea", t: "No mezcles viáticos, traslados y otras cuentas en un mismo reembolso." });
  const cuentas = [...new Set(movs.map(cuentaDe))];
  if (cuentas.length > 1) av.push({ nivel: "avisa", t: `El reembolso lleva ${cuentas.length} cuentas: ${cuentas.join(", ")}.` });
  if (!numero) av.push({ nivel: "bloquea", t: "Falta el número de solicitud." });
  if (numero && usados.includes(`${numero}/${anio}`)) av.push({ nivel: "bloquea", t: `El número CD${numero}/${anio} ya se usó.` });
  const sinCC = movs.filter((m) => !ccDe(m));
  if (sinCC.length) av.push({ nivel: "bloquea", t: `Falta el centro de costo en: ${sinCC.map((m) => m.folio).join(", ")}.` });
  const yaEn = movs.filter((m) => m.reembolso);
  if (yaEn.length) av.push({ nivel: "bloquea", t: `Ya están en otro reembolso: ${yaEn.map((m) => m.folio).join(", ")}.` });
  const fechas = movs.map((m) => m.fecha).filter(Boolean).sort();
  const lineas = movs.map((m) => {
    const { cuenta, sub } = dividirCuenta(cuentaDe(m));
    return { folio: folioFormato(m.folio), fecha: m.fecha, importe: r2(m.importe), cc: ccDe(m), pp: cuentaDe(m), cuenta, sub, proveedor: m.proveedorMemo || "Alonso Orozco Nayeli" };
  });
  const total = r2(lineas.reduce((s, l) => s + l.importe, 0));
  return {
    avisos: av, puedeGenerar: !av.some((a) => a.nivel === "bloquea"), lineas, total,
    solicitud: numero ? `CD${numero}/${anio}` : "", numero, comprobantes: lineas.length, fecha,
    periodoDe: fechas[0] || "", periodoAl: fechas[fechas.length - 1] || "", acumuladoAnterior: r2(acumuladoAnterior),
    prefijo: prefijos[0] || "",
  };
}

// El comprobante de OOAD se reconoce por su texto: "V OCT 05 - 114/2026", "T OCT 01 - CD113/2026".
export function numeroEnComprobante(texto) {
  const m = /-\s*(?:CD\s*)?0*(\d+)\s*\/\s*(\d{4})/i.exec(String(texto || ""));
  return m ? { numero: Number(m[1]), anio: m[2] } : null;
}
