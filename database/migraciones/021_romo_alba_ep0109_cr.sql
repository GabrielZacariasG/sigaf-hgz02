-- =====================================================================
-- SIGAF · Corrección · 021 · Romo Alba, oficio SIGAF-EP-0109: las 14 facturas "atoradas" sin CR
-- Fecha: 29/10/2026 · export 020 cruzado con N_AP_IMSS_1043 (cuenta 51221001, UI 010102)
-- El sistema SÍ les dio comprobante; todos están PAGADOS (Estado Pago P), programados el 20/10/2026:
--   CR 00475194  "291,292,293,294,295"  = 21291+21292+21293+21294+21295 = 81,213.12 (exacto)
--   CR 00475201  "354,355,356,357,360"  = 21354+21355+21356+21357+21360 = 75,660.44 en SIGAF
--                                          vs 75,660.40 en el sistema (4 centavos; no se toca importe)
--   CR 00475204  "321,316,315,314"      = 21321+21316+21315+21314       = 62,551.83 (exacto)
-- Pasan a Gasto reflejado, firmas autorizadas por Adm. de Contrato, con su CR y fecha de pago.
-- SEGURO: solo cambia facturas de Romo Alba con ese folio, no anuladas y todavía SIN CR.
-- Cómo: SQL Editor de Supabase → Run. Debe mostrar 14 filas.
-- =====================================================================
with pg (folio, cr) as (values
  ('21291','00475194'),('21292','00475194'),('21293','00475194'),('21294','00475194'),('21295','00475194'),
  ('21354','00475201'),('21355','00475201'),('21356','00475201'),('21357','00475201'),('21360','00475201'),
  ('21321','00475204'),('21316','00475204'),('21315','00475204'),('21314','00475204')),
upd as (
  update facturas f set
    estatus_general = 'gasto_reflejado',
    estatus_firmas  = 'autorizada_admin_contrato',
    cr_contrarecibo = pg.cr,
    fecha_pago      = date '2026-10-20'
  from pg, proveedores p
  where p.id = f.proveedor_id and p.razon_social ilike '%ROMO ALBA%'
    and f.folio_proveedor = pg.folio
    and f.anulada = false
    and f.estatus_general = 'en_tramite_ooad'
    and nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is null
  returning f.folio_ingreso, f.folio_proveedor, f.importe_factura, f.cr_contrarecibo
)
select * from upd order by cr_contrarecibo, folio_proveedor;
