// Formato uniforme del contra-recibo (CR) en toda la app.
// FINAT/OOAD lo manejan a 8 dígitos con ceros a la izquierda (p. ej. 00478607); algunos CR capturados a mano
// quedaron a 6 dígitos (452743). Este helper los empareja a 8 dígitos SOLO para mostrarlos; no toca la base de
// datos ni la búsqueda (que compara el valor crudo). Rellena cada bloque numérico a 8; deja texto/separadores
// tal cual, y nunca recorta un CR que ya sea más largo.
export function formatCR(cr) {
  const s = String(cr ?? "").trim();
  if (!s) return "";
  return s.replace(/\d+/g, (d) => d.padStart(8, "0"));
}
