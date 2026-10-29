-- =====================================================================
-- SIGAF · Corrección · 038 · Ávila Cajero A7294–A7297: NO están pagadas → En trámite OOAD
-- Fecha: 30/10/2026 · Aprobado por Gabriel
-- CR 00452834 ("(2025) 7294, 7295, 7296, 7297", $105,844.20, cuenta 51251017): el comprobante sigue vivo
-- pero su Estado Pago es X (pago CANCELADO). El comprobante que lo iba a reponer (00464748, "7294,7295",
-- $50,576) se eliminó. Ninguno aparece en el 4002 (pagos 02/01–30/10/2026).
-- SIGAF las tenía como "Gasto reflejado" (venían así del Excel). Pasan a "En trámite OOAD", conservan su CR
-- y quedan sin fecha de pago.
-- SEGURO: solo esas 4 si siguen en Gasto reflejado con el CR 452834. Debe mostrar 4 filas.
-- =====================================================================
with upd as (
  update facturas set estatus_general = 'en_tramite_ooad', fecha_pago = null
  where folio_ingreso in ('HGZ2-CE-2026-000024','HGZ2-CE-2026-000025','HGZ2-CE-2026-000026','HGZ2-CE-2026-000027')
    and anulada = false and estatus_general = 'gasto_reflejado'
    and ltrim(btrim(cr_contrarecibo), '0') = '452834'
  returning folio_ingreso, folio_proveedor, importe_factura, estatus_general, cr_contrarecibo
)
select * from upd order by folio_ingreso;
