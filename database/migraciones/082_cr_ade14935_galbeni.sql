-- 082 · Asigna el CR que FINAT ya tiene a 2 facturas de Medicinas (cuenta 51251002)
-- que SIGAF mostraba "sin CR" por diferencia de folio / comprobante multi-factura.
-- Verificado contra el 1043 (N_AP_IMSS_1043_123.xls, corte 24/11/2026); ambos comprobantes
-- con Estado Entrada = P (ya ejercidos por FINAT):
--   · HGZ2-CE-2026-001163  FA_26_ADE14935  $9,750.00  ->  CR 00478583
--        comprobante 00478583 = "(OCT) 13993, 14935" por $21,636 (las 2 ADEMEX juntas);
--        la 13993 ya traía ese CR, a esta no se le había asignado.
--   · HGZ2-CE-2026-001201  FGP82 (Galbeni)  $3,550.00  ->  CR 00478881
--        comprobante 00478881 = "(NOV) F-GP-82"; en SIGAF el folio quedó como "FGP82"
--        (el guion rompió el empate automático).
--
-- NO se marca gasto reflejado (FINAT Estado Pago = N): quedan "OOAD con CR", igual que las
-- otras 36 facturas de Medicinas en tramite. Idempotente: solo toca las que sigan sin CR.
--
-- Efecto en la cedula de Medicinas: "sin CR" queda solo A26 ($18,750) y
-- "Cuentas por pagar" = A26 ($18,750) + 13373 ($15,000) = $33,750, auditable al centavo.

begin;

update facturas
   set cr_contrarecibo = '00478583'
 where folio_ingreso = 'HGZ2-CE-2026-001163'
   and cr_contrarecibo is null;

update facturas
   set cr_contrarecibo = '00478881'
 where folio_ingreso = 'HGZ2-CE-2026-001201'
   and cr_contrarecibo is null;

commit;

-- Verificacion: las 2 deben aparecer ya con su CR.
select folio_ingreso, folio_proveedor, importe_factura, cr_contrarecibo, estatus_general
  from facturas
 where folio_ingreso in ('HGZ2-CE-2026-001163', 'HGZ2-CE-2026-001201')
 order by folio_ingreso;
