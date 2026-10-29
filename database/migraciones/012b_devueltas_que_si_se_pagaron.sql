-- =====================================================================
-- SIGAF · Corrección · 012b · Facturas marcadas "devueltas" que el sistema tiene PAGADAS
-- Fecha: 29/10/2026 · Aprobado por Gabriel
--
-- Revisión de las 23 "devueltas" de SIGAF contra los comprobantes del sistema (N_AP_IMSS_1043 ene–oct):
-- 4 vienen de la migración del Excel, sin oficio DP ni motivo, y SÍ se pagaron:
--   HGZ2-SS-HIST-000109  Labopath 1216     SIGAF $1,216 (¡era el folio!) → $62,060   CR 00472785 pagado (prog. 30/09/2026)
--   HGZ2-SS-HIST-000110  Labopath 1249     SIGAF $1,249 (¡era el folio!) → $23,200   CR 00472788 pagado (prog. 30/09/2026)
--   HGZ2-SS-HIST-000224  ISSEA IS524       $216,341                                  CR 00458791 pagado (prog. 04/05/2026)
--                        (un solo CR $339,656 = IS524 $216,341 + IM555 $109,677 + SPHM116 $13,638)
--   HGZ2-SS-HIST-000239  ISSEA SPHM110     $27,276                                   CR 00463208 pagado (prog. 22/06/2026)
-- Importes confirmados también en la cédula (hoja ss, 51331003 filas 177–178; 51331010 filas 5 y 8).
-- Se quedan como devueltas (correcto): Romo Alba 21074/21075/21100/21148 (sin comprobante en el sistema),
-- Levi A310 (su comprobante se eliminó), las de importe $0 y las que tienen oficio DP.
-- SEGURO: solo cambia estas 4 si siguen "devueltas" y no anuladas. Fecha de pago = programada del 1043.
-- Cómo: SQL Editor de Supabase → Run. Debe decir "UPDATE 4" / mostrar 4 filas actualizadas.
-- =====================================================================
with datos (folio_ingreso, importe, cr, fecha_pago) as (
  values ('HGZ2-SS-HIST-000109', 62060.00::numeric, '00472785', date '2026-09-30'),
         ('HGZ2-SS-HIST-000110', 23200.00::numeric, '00472788', date '2026-09-30'),
         ('HGZ2-SS-HIST-000224', null::numeric,     '00458791', date '2026-05-04'),
         ('HGZ2-SS-HIST-000239', null::numeric,     '00463208', date '2026-06-22')
),
upd as (
  update facturas f set
    importe_factura          = coalesce(d.importe, f.importe_factura),
    estatus_general          = 'gasto_reflejado',
    estatus_firmas           = 'autorizada_admin_contrato',
    cr_contrarecibo          = d.cr,
    fecha_pago               = d.fecha_pago
  from datos d
  where f.folio_ingreso = d.folio_ingreso
    and f.anulada = false
    and f.estatus_general = 'devuelta_proveedor'
  returning f.folio_ingreso, f.folio_proveedor, f.importe_factura, f.cr_contrarecibo
)
select * from upd order by folio_ingreso;
