// Modelo de estatus de 3 ejes (rediseño). Compartido por lista y detalle.

// Eje GENERAL (lineal)
export const FLUJO_GENERAL = [
  "capturada",
  "en_revision",
  "enviada_ooad",
  "en_tramite_ooad",
  "gasto_reflejado",
];
export const LABEL_GENERAL = {
  capturada: "Capturada",
  en_revision: "En revisión",
  enviada_ooad: "Enviada a OOAD",
  en_tramite_ooad: "En trámite OOAD",
  gasto_reflejado: "Gasto reflejado",
};

// Circuito de FIRMAS (independiente)
export const FLUJO_FIRMAS = [
  "pendiente",
  "envio_firmas_servicio",
  "autorizada_servicio",
  "envio_firmas_admin_contrato",
  "autorizada_admin_contrato",
];
export const LABEL_FIRMAS = {
  pendiente: "Pendiente",
  envio_firmas_servicio: "Envío a firma (servicio)",
  autorizada_servicio: "Autorizada (servicio)",
  envio_firmas_admin_contrato: "Envío a firma (admin. contrato)",
  autorizada_admin_contrato: "Autorizada (admin. contrato)",
};

// Circuito de PEDIDO-RECEPCIÓN (independiente)
export const FLUJO_PEDIDO = ["pendiente", "solicitado_fsi", "generado"];
export const LABEL_PEDIDO = {
  pendiente: "Pendiente de solicitar",
  solicitado_fsi: "Solicitado · en espera de P&R",
  generado: "Recibido (pedido y recepción)",
};

// Qué facturas llevan pedido-recepción: Integrales + estas cuentas de Área Médica.
export const CUENTAS_PR_AREA_MEDICA = ["51251019", "51251006", "51251018"];
export const generaPedidoRecepcion = (capitulo, cuenta) =>
  ["Integrales", "Servicios Integrales"].includes(capitulo) ||
  CUENTAS_PR_AREA_MEDICA.includes(String(cuenta || ""));

// Requisitos para poder enviar a OOAD (mismo candado que el trigger de BD).
export const FIRMAS_COMPLETO = "autorizada_admin_contrato";
export const PEDIDO_COMPLETO = "generado";

// Capítulos que NO requieren firma del Administrador de Contrato: les basta la
// validación del servicio (p. ej. Compra Emergente).
export const SIN_ADMIN_CONTRATO = ["Compra Emergente"];

// Circuito de firmas corto (sin admin de contrato) para esos capítulos.
export const FLUJO_FIRMAS_CE = ["pendiente", "envio_firmas_servicio", "autorizada_servicio"];
export const flujoFirmasDe = (capitulo) =>
  SIN_ADMIN_CONTRATO.includes(capitulo) ? FLUJO_FIRMAS_CE : FLUJO_FIRMAS;

export const puedeEnviarOoad = (estatusFirmas, estatusPedido, capitulo) => {
  const soloServicio = SIN_ADMIN_CONTRATO.includes(capitulo);
  const firmasOk = soloServicio
    ? (estatusFirmas === "autorizada_servicio" || estatusFirmas === FIRMAS_COMPLETO)
    : estatusFirmas === FIRMAS_COMPLETO;
  return firmasOk && estatusPedido === PEDIDO_COMPLETO;
};
