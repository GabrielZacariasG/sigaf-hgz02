import { supabase } from "./supabaseClient";

// Folio de ingreso: HGZ2-{PREFIJO}-{anio}-{consecutivo 6 díg.}
export async function generarFolioIngreso(prefijoCap, anio) {
  const prefijo = `HGZ2-${prefijoCap}-${anio}-`;
  const { data, error } = await supabase
    .from("facturas")
    .select("folio_ingreso")
    .like("folio_ingreso", `${prefijo}%`)
    .order("folio_ingreso", { ascending: false })
    .limit(1);
  if (error) throw error;
  let consecutivo = 1;
  if (data && data.length > 0) {
    const n = parseInt(data[0].folio_ingreso.slice(prefijo.length), 10);
    if (!Number.isNaN(n)) consecutivo = n + 1;
  }
  return prefijo + String(consecutivo).padStart(6, "0");
}

// Folio consecutivo de oficios de validación (series OF-CUM, OF-INC, ACU-DEV, EF-CE).
// Lo entrega la base de datos (database/migraciones/002_folios_consecutivos.sql):
// se pide SOLO al guardar, para no gastar números en borradores.
export async function siguienteFolioSerie(serie, anio = new Date().getFullYear()) {
  const { data, error } = await supabase.rpc("fn_siguiente_folio", { p_serie: serie, p_anio: anio });
  if (error) throw new Error("No se pudo asignar el folio (" + error.message + "). ¿Ya se corrió la migración 002_folios_consecutivos.sql?");
  return `${serie}-${String(data).padStart(4, "0")}/${anio}`;
}
export const FOLIO_PENDIENTE = "(se asigna al guardar)";

// Inserta una factura asignando el folio de ingreso al guardar. Si dos personas
// capturan a la vez y chocan con el candado de unicidad del folio, reintenta con
// el siguiente número (antes la segunda captura fallaba y se perdía).
// Devuelve { data, error } como supabase (data = fila insertada con `columnas`).
export async function insertarFacturaConFolio(datos, prefijoCap, anio, columnas = "id, folio_ingreso") {
  let ultimoError = null;
  for (let intento = 0; intento < 10; intento++) {
    const folio_ingreso = await generarFolioIngreso(prefijoCap, anio);
    const { data, error } = await supabase.from("facturas").insert({ ...datos, folio_ingreso }).select(columnas).single();
    if (!error) return { data, error: null };
    const chocaFolio = error.code === "23505" && /folio_ingreso/i.test(`${error.message} ${error.details || ""}`);
    if (!chocaFolio) return { data: null, error };
    ultimoError = error;
  }
  return { data: null, error: ultimoError || new Error("No se pudo asignar un folio de ingreso único.") };
}
