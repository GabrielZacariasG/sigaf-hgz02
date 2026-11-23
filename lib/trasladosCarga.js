// Folios de traslado (autobuses) ligados a una factura — mismo modelo que subrogados (23/11/2026).
// Un folio TP del SCACE es un viaje del contrato (cuenta 52411011). Al capturar la factura de autobuses se
// seleccionan los folios que cubre y quedan LIGADOS (factura_id). Un folio ligado está "facturado" y no se
// puede volver a usar; al devolver/anular/eliminar la factura se liberan y vuelven a DEVENGO.
import { supabase } from "./supabaseClient";
import { leerTodo } from "./paginar";

// Folio contable (del contrato): transporte contratado, con importe y que NO es fondo fijo.
export const esFolioTrasladoContable = (f) =>
  /CONTRATADO/i.test(String(f.transporte || "")) && !f.fondo_fijo && Number(f.importe_emitido) > 0;

// Estatus de un folio de traslado: facturado (ligado) · devengo (contable sin ligar) · otro (ambulancia/fondo fijo/sin importe)
export const estatusFolioTraslado = (f) => (f.factura_id ? "facturado" : esFolioTrasladoContable(f) ? "devengo" : "otro");

// Folios de un contrato de traslados (para la captura y el detalle de la factura).
export async function foliosTrasladoDelContrato(contratoId) {
  if (!contratoId) return [];
  const r = await leerTodo((d, h) => supabase.from("traslados_folios")
    .select("folio, fecha_viaje, ciudad, unidad_receptora, especialidad, con_acompanante, boletos, importe_emitido, transporte, fondo_fijo, estado_tp, factura_id")
    .eq("contrato_id", contratoId).order("fecha_viaje").order("folio").range(d, h));
  return r.error ? [] : (r.data || []);
}

export async function ligarFoliosTraslado(folios, facturaId) {
  if (!folios.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  for (let i = 0; i < folios.length; i += 200) {
    const { error } = await supabase.from("traslados_folios")
      .update({ factura_id: facturaId, ligado_por: user?.id || null, ligado_at: new Date().toISOString() })
      .in("folio", folios.slice(i, i + 200));
    if (error) throw new Error("No se pudieron ligar los folios de traslado: " + error.message);
  }
}

export async function desligarFoliosTraslado(folios) {
  if (!folios.length) return;
  for (let i = 0; i < folios.length; i += 200) {
    const { error } = await supabase.from("traslados_folios")
      .update({ factura_id: null, ligado_por: null, ligado_at: null })
      .in("folio", folios.slice(i, i + 200));
    if (error) throw new Error("No se pudieron quitar los folios de traslado: " + error.message);
  }
}

// Liberar TODOS los folios de traslado de una factura (devolución, anulación, re-factura, eliminación).
export async function liberarFoliosTrasladoDeFactura(facturaId) {
  if (!facturaId) return 0;
  const { data, error } = await supabase.from("traslados_folios")
    .update({ factura_id: null, ligado_por: null, ligado_at: null })
    .eq("factura_id", facturaId).select("folio");
  if (error) throw new Error("No se pudieron liberar los folios de traslado: " + error.message);
  return (data || []).length;
}
