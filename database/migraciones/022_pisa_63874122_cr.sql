-- =====================================================================
-- SIGAF · Corrección · 022 · PISA 63874122: NO hay doble pago; ponerle su CR
-- Fecha: 29/10/2026 · N_AP_IMSS_1043 ene–oct
-- La factura 63874122 ($11,361.42, cuenta 51251012) tuvo 3 comprobantes:
--   00467047 (13/07) y 00468968 (04/08): ELIMINADOS (Estado Entrada X), nunca se pagaron.
--   00470455 (17/08): vivo y PAGADO, programado el 07/09/2026, pedido 45129 / recepción 43919.
-- El "segundo comprobante vivo" 00476524 que marcó la puesta al día era un falso positivo: son otras
--   facturas de PISA (4118-4120-4121-4122-4123, UI 018001); "4122" coincidía con el final del folio.
-- En SIGAF (HGZ2-INT-HIST-011) sigue "En trámite OOAD" sin CR → pasa a Gasto reflejado con 00470455.
-- SEGURO: solo cambia esa factura si sigue sin CR.
-- Cómo: SQL Editor de Supabase → Run. Debe mostrar 1 fila.
-- =====================================================================
update facturas set
  estatus_general  = 'gasto_reflejado',
  cr_contrarecibo  = '00470455',
  fecha_pago       = date '2026-09-07',
  numero_pedido    = coalesce(nullif(numero_pedido, ''), '45129'),
  numero_recepcion = coalesce(nullif(numero_recepcion, ''), '43919')
where folio_ingreso = 'HGZ2-INT-HIST-011'
  and folio_proveedor = '63874122'
  and anulada = false
  and nullif(btrim(coalesce(cr_contrarecibo, '')), '') is null
returning folio_ingreso, folio_proveedor, importe_factura, estatus_general, cr_contrarecibo, fecha_pago;
