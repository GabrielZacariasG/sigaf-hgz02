-- =====================================================================
-- SIGAF · Corrección · 024 · Pendientes de la puesta al día: 2 CR confirmados
-- Fecha: 29/10/2026 · N_AP_IMSS_1043 + revisión 023 (ningún otro registro de SIGAF tiene esos CR ni folios)
--   HGZ2-INT-2026-000002  PISA "640857022" → el folio real es 64085702 (tenía un 2 de más).
--     CR 00471190, $212,024.12, PAGADO (programado 14/09/2026). Es el ciclo 26/06–14/07, que sigue a
--     64012706 (CR 00468531, ciclo 26/05–13/06), que ya está en SIGAF.
--   HGZ2-INT-HIST-091  Productos Hospitalarios 4601567994 ($78,547.43, julio)
--     CR 00475355 (el sistema lo capturó como "46015679994"), aún SIN pagar → sigue En trámite OOAD.
-- Se descartaron (no se tocan): 4601587649 (su CR candidato es de 4601580626, que ya lo tiene),
--   SIE 33002983 (el CR candidato es de 33002969, que ya lo tiene) y Médica San Juan 3979
--   (el comprobante 3979 del sistema es de otra unidad, la 010101, por $8,004).
-- SEGURO: solo si siguen sin CR. Cómo: SQL Editor → Run. Debe mostrar 2 filas.
-- =====================================================================
with pg (folio_ingreso, folio_ant, folio_nvo, cr, gen, fecha_pago) as (values
  ('HGZ2-INT-2026-000002', '640857022',  '64085702',   '00471190', 'gasto_reflejado', date '2026-09-14'),
  ('HGZ2-INT-HIST-091',    '4601567994', '4601567994', '00475355', 'en_tramite_ooad', null::date)),
upd as (
  update facturas f set
    folio_proveedor = pg.folio_nvo,
    cr_contrarecibo = pg.cr,
    estatus_general = pg.gen::estatus_general,
    fecha_pago      = coalesce(pg.fecha_pago, f.fecha_pago)
  from pg
  where f.folio_ingreso = pg.folio_ingreso and f.folio_proveedor = pg.folio_ant
    and f.anulada = false and nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is null
  returning f.folio_ingreso, f.folio_proveedor, f.importe_factura, f.estatus_general, f.cr_contrarecibo, f.fecha_pago
)
select * from upd order by folio_ingreso;
