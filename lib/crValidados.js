// CR que FINAT ya validó (estado presupuestal V) a partir de una fecha, de TODAS las unidades (HGZ 1, 2, 3, …),
// tal como vienen en el N_AP 1043 guardado en comprobantes_ooad. Con ellos se calcula el saldo al día de cada
// dictamen entre un IMKK036 y el siguiente (lib/dictamenVivo.js · saldoAlDia).
//   desde:    fecha AAAA-MM-DD (el corte más viejo de los dictámenes que se van a revisar)
//   contratos: opcional, números de contrato (S6M0047, 050GYR…): solo trae los CR de esos contratos
// Si la tabla no se puede leer regresa [] y las pantallas siguen con el saldo del PDF.
import { supabase } from "./supabaseClient";
import { leerTodo } from "./paginar";

const COLS = "cbte, linea, contrato, ui, centro_costo, cuenta, importe_cuenta, fecha_ppto, estado_ppto, estado_entrada, factura_txt";

export async function leerCrValidados(desde, contratos = null) {
  if (!desde) return [];
  const nums = contratos ? [...new Set(contratos.map((c) => String(c || "").trim().toUpperCase()).filter((c) => /^[A-Z0-9-]+$/.test(c)))] : null;
  if (nums && !nums.length) return [];
  const r = await leerTodo((d, h) => {
    let q = supabase.from("comprobantes_ooad").select(COLS).eq("estado_ppto", "V").neq("estado_entrada", "X").gte("fecha_ppto", String(desde).slice(0, 10));
    if (nums) q = q.or(nums.map((n) => `contrato.ilike.${n}%`).join(","));
    return q.order("cbte").order("linea").range(d, h);
  });
  return r.error ? [] : r.data || [];
}

// Corte más viejo de una lista de dictámenes ({ corte }) o de un mapa numero → corte.
export const corteMasViejo = (cortes) => (Array.isArray(cortes) ? cortes.map((d) => d?.corte) : Object.values(cortes || {}))
  .map((c) => String(c || "").slice(0, 10)).filter(Boolean).sort()[0] || null;
