-- 082 · Cuadre al centavo de "Cuentas por pagar" de Medicinas (cuenta 51251002).
-- Verificado contra el 1043 (N_AP_IMSS_1043_123.xls, corte 24/11/2026).
--
-- (A) Asigna el CR que FINAT YA tiene a 2 facturas que SIGAF mostraba "sin CR"
--     por diferencia de folio / comprobante multi-factura (Estado Entrada = P, ya ejercidas):
--   · HGZ2-CE-2026-001163  FA_26_ADE14935  $9,750.00  ->  CR 00478583
--        comprobante 00478583 = "(OCT) 13993, 14935" por $21,636 (las 2 ADEMEX juntas);
--        la 13993 ya traia ese CR, a esta no se le habia asignado.
--   · HGZ2-CE-2026-001201  FGP82 (Galbeni)  $3,550.00  ->  CR 00478881
--        comprobante 00478881 = "(NOV) F-GP-82"; en SIGAF el folio quedo como "FGP82".
--   -> Con esto salen de "sin CR": FINAT ya las ejercio, NO son cuenta por pagar.
--
-- (B) Limpia el CR eliminado de la 13373: FINAT TIRO el CR 00477072 (entrada X, movido a
--     GLOSACXP), asi que ese CR ya no existe del lado de FINAT. La factura sigue PENDIENTE
--     pero sin CR vigente -> se regresa a "sin CR" para que aparezca por nombre en la cedula.
--   · HGZ2-CE-2026-001063  13373 (ADEMEX)  $15,000.00  ->  CR = null
--
-- No se marca gasto reflejado en ninguna (ninguna esta pagada). Idempotente.
--
-- Efecto en la cedula de Medicinas, "De que se compone":
--   Facturas sin CR = A26 ($18,750) + 13373 ($15,000) = $33,750
--   Remanente (cruce 1043) = $0.00
--   = Cuentas por pagar = $33,750, cada peso clavado a una factura con nombre.

begin;

-- (A) ADE14935 y Galbeni: FINAT ya las ejercio, se les pone su CR.
update facturas
   set cr_contrarecibo = '00478583'
 where folio_ingreso = 'HGZ2-CE-2026-001163'
   and cr_contrarecibo is null;

update facturas
   set cr_contrarecibo = '00478881'
 where folio_ingreso = 'HGZ2-CE-2026-001201'
   and cr_contrarecibo is null;

-- (B) 13373: FINAT elimino su CR; se limpia para que quede como pendiente sin CR vigente.
update facturas
   set cr_contrarecibo = null
 where folio_ingreso = 'HGZ2-CE-2026-001063'
   and cr_contrarecibo = '00477072';

commit;

-- Verificacion: ADE14935/Galbeni ya con CR; 13373 ya sin CR.
select folio_ingreso, folio_proveedor, importe_factura, cr_contrarecibo, estatus_general
  from facturas
 where folio_ingreso in ('HGZ2-CE-2026-001163', 'HGZ2-CE-2026-001201', 'HGZ2-CE-2026-001063')
 order by folio_ingreso;
