// Fase B · Datos comunes de folios de subrogados (sin dependencias pesadas).
const N = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
// Solo letras y números: "050GYR032N12225-025-00" → "050GYR032N1222502500"
export const claveContrato = (s) => N(s).replace(/[^A-Z0-9]/g, "");

// Un folio que viene en el Avance SMS y también en CD_SMS se guardaba dos veces: la clave es folio + estudio y el
// Avance junta los estudios en un renglón ("EEG… + 306…") mientras CD_SMS trae uno por estudio. Manda el Avance
// (trae la factura y la cancelación); la copia del CD_SMS no cuenta. Si el folio solo está en CD_SMS, sí cuenta.
// Encontrado el 13/11/2026: inflaba el devengo de S6M0047 en $626,883.72 y de S6M0043 en $34,027.68.
export const folioNum = (s) => N(s).replace(/[^A-Z0-9]/g, "");
export function sinDuplicadosCDSMS(folios, avance = folios) {
  const enAvance = new Set(avance.filter((f) => f.origen === "avance_sms").map((f) => `${f.contrato_id ?? ""}|${folioNum(f.folio)}`));
  return folios.filter((f) => f.origen !== "cd_sms" || !enAvance.has(`${f.contrato_id ?? ""}|${folioNum(f.folio)}`));
}

// Hoja del Avance SMS → contrato SAI (columna C de la hoja "avance")
export const HOJAS_AVANCE = {
  "VAL OFT ANGIO": "S6M0010", "MED NUCL": "S6M0016", "PSIC Y ELECTROENCE": "S6M0003", "PROMOTORA": "S6M0005",
  "LABS": "S6M0017", "UNIPIL": "S6M0015", "CATE,CX (1)": "S6M0012", "DOSIMETROS": "S6M0040", "PATOLOGIA": "S6M0041",
  "LABS (2)": "S6M0042", "PSIC Y ELECTROENCE (2)": "S6M0043", "PROMOTORA (2)": "S6M0047", "VENTILACION": "S6M0049",
  "FLUROSCOPIO": "S6M0050", "VAL OFT ANGIO (2)": "S6M0046", "CATE,CX": "S6M0048",
};

// Número de contrato (pedido) → contrato SAI, según la hoja "avance" (columnas B y C). CD_SMS trae el pedido.
export const PEDIDO_A_SAI = {
  "050GYR032N13325-193-00": "S6M0010", "050GYR032N14525-189-00": "S6M0016", "050GYR032N13225-175-00": "S6M0003",
  "050GYR032N13325-176-00": "S6M0005", "050GYR032N14625-190-00": "S6M0017", "050GYR032N13425-177-00": "S6M0015",
  "050GYR032N13325-194-00": "S6M0012", "050GYR032N12225-024-00": "S6M0046", "050GYR032N12225-018-00": "S6M0040",
  "050GYR032N12225-019-00": "S6M0041", "050GYR032N12225-020-00": "S6M0042", "050GYR032N12225-021-00": "S6M0043",
  "050GYR032N12225-025-00": "S6M0047", "050GYR032N12225-027-00": "S6M0049", "050GYR032N12225-028-00": "S6M0050",
  "050GYR032N12225-026-00": "S6M0048", "050GYR032N13525-178-00": "S6M0022", "050GYR032N12426-006-00": "S6M0030",
};

