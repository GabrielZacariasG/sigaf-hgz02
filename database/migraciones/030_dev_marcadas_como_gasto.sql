-- =====================================================================
-- SIGAF · Corrección · 030 · 4 facturas con "DEV" en el CR que SIGAF cuenta como gasto
-- Fecha: 29/10/2026 · revisión 029 + N_AP_IMSS_1043 ene–29/10
-- La migración del Excel dejó en el campo CR la nota de devolución, pero el estatus quedó "Gasto reflejado",
-- así que SIGAF las suma como gasto. Ninguna tiene comprobante en el sistema:
--   HGZ2-AM-HIST-000246  Biodist 8258     $522.00     CR "DEV"
--   HGZ2-AM-HIST-000321  Biodist 8607     $6,380.00   CR "DEV"
--   HGZ2-SS-HIST-000228  ISSEA SP 1671    $13,440.00  CR "DEVOLUCION AL PROVEEDOR 07/07"
--   HGZ2-SS-HIST-000230  ISSEA SP 1673    $13,440.00  CR "DEVOLUCION AL PROVEEDOR 07/07"
-- Pasan a "Devuelta al proveedor"; la nota se guarda como motivo y el CR queda vacío.
-- SEGURO: solo si conservan ese texto en el CR. Cómo: SQL Editor → Run. Debe mostrar 4 filas.
-- =====================================================================
with upd as (
  update facturas set
    estatus_general   = 'devuelta_proveedor',
    motivo_devolucion = coalesce(nullif(motivo_devolucion, ''), 'Migración cédula: ' || cr_contrarecibo || ' (sin comprobante en el sistema)'),
    fecha_devolucion  = coalesce(fecha_devolucion,
                          case when cr_contrarecibo ilike '%07/07%' then timestamp '2026-07-07' end),
    cr_contrarecibo   = null
  where folio_ingreso in ('HGZ2-AM-HIST-000246','HGZ2-AM-HIST-000321','HGZ2-SS-HIST-000228','HGZ2-SS-HIST-000230')
    and anulada = false
    and upper(btrim(cr_contrarecibo)) like 'DEV%'
  returning folio_ingreso, folio_proveedor, importe_factura, estatus_general, motivo_devolucion
)
select * from upd order by folio_ingreso;
