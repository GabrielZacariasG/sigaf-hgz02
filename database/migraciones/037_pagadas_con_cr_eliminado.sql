-- =====================================================================
-- SIGAF · Corrección · 037 · "Gasto reflejado" con CR eliminado o sin CR: su CR bueno y fecha real de pago
-- Fecha: 30/10/2026 · revisión 036 + N_AP_IMSS_1043 + N_AP_IMSS_4002
-- De las 20 que la 036 sacó, 16 SÍ están pagadas: tenían el CR viejo (que el sistema eliminó y volvió a
-- registrar con otro número) o no tenían CR. Se pone el CR vigente y la fecha real de pago del 4002:
--   Ana Karen 4396/4397        471000 (X) → 00471339  pagado 17/09/2026  ("4396-4397-4399")
--   Biodist 8275               470301 (X) → 00470390  pagado 07/09/2026
--   Biodist 8588               471063 (pago cancelado) → 00471483  pagado 17/09/2026
--   Biodist 9086               439838 (no existe) → 00469649  pagado 31/08/2026
--   Biodist 9132               471179 (X) → 00471264  pagado 14/09/2026
--   Promotora 85520            464760 (X) → 00464841  pagado 08/07/2026
--   Promotora B85209           453845 (X) → 00460448  pagado 29/05/2026
--   Promotora 86048            471712 (X) → 00472705  pagado 30/09/2026  ("86048-86047-86179")
--   Gabinete MN3241            455979 (X) → 00461309  pagado 29/06/2026
--   ISSEA IM555 y SPHM116      sin CR → 00458791  pagado 04/05/2026  ("IS524-IM555-SPHM116", IS524 ya lo tiene)
--   ISSEA IS531                sin CR → 00459712  pagado 13/05/2026
--   ISSEA IS560                sin CR → 00460408  pagado 20/05/2026
--   Baxter EF587826            sin CR → 00469668  pagado 31/08/2026
--   PISA 63948091              sin CR → 00468111  pagado 10/08/2026
-- NO se tocan aquí las 4 de Ávila Cajero (A7294–A7297): su CR 452834 sigue vivo pero con el PAGO CANCELADO
--   y el que lo iba a reponer (464748) se eliminó → en el sistema NO están pagadas. Decisión aparte.
-- SEGURO: solo si conservan el CR viejo (o vacío). Cómo: SQL Editor → Run. Debe mostrar 16 filas.
-- =====================================================================
with c (folio_ingreso, cr_ant, cr_nvo, fecha_pago, pedido, recepcion) as (values
  ('HGZ2-AM-HIST-001555', '471000', '00471339', date '2026-09-17', null, null),
  ('HGZ2-AM-HIST-001556', '471000', '00471339', date '2026-09-17', null, null),
  ('HGZ2-AM-HIST-000263', '470301', '00470390', date '2026-09-07', '44995', '43788'),
  ('HGZ2-AM-HIST-000304', '471063', '00471483', date '2026-09-17', '44468', '43263'),
  ('HGZ2-AM-HIST-000459', '439838', '00469649', date '2026-08-31', '44818', '43611'),
  ('HGZ2-AM-HIST-000474', '471179', '00471264', date '2026-09-14', '44861', '43654'),
  ('HGZ2-SS-HIST-000139', '464760', '00464841', date '2026-07-08', null, null),
  ('HGZ2-SS-HIST-000065', '453845', '00460448', date '2026-05-29', null, null),
  ('HGZ2-SS-HIST-000209', '471712', '00472705', date '2026-09-30', null, null),
  ('HGZ2-SS-HIST-000021', '455979', '00461309', date '2026-06-29', null, null),
  ('HGZ2-SS-HIST-000223', '',       '00458791', date '2026-05-04', null, null),
  ('HGZ2-SS-HIST-000240', '',       '00458791', date '2026-05-04', null, null),
  ('HGZ2-SS-HIST-000225', '',       '00459712', date '2026-05-13', null, null),
  ('HGZ2-SS-HIST-000226', '',       '00460408', date '2026-05-20', null, null),
  ('HGZ2-INT-HIST-020',   '',       '00469668', date '2026-08-31', '44643', '43436'),
  ('HGZ2-INT-HIST-012',   '',       '00468111', date '2026-08-10', '44433', '43228')),
upd as (
  update facturas f set
    cr_contrarecibo  = c.cr_nvo,
    fecha_pago       = c.fecha_pago,
    numero_pedido    = coalesce(nullif(btrim(f.numero_pedido), ''), c.pedido),
    numero_recepcion = coalesce(nullif(btrim(f.numero_recepcion), ''), c.recepcion)
  from c
  where f.folio_ingreso = c.folio_ingreso and f.anulada = false
    and ltrim(btrim(coalesce(f.cr_contrarecibo, '')), '0') = c.cr_ant
  returning f.folio_ingreso, f.folio_proveedor, f.importe_factura, f.cr_contrarecibo, f.fecha_pago
)
select * from upd order by folio_ingreso;
