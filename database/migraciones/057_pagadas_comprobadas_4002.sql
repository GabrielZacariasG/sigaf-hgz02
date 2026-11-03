-- =====================================================================
-- SIGAF · 057 · 11 facturas que el sistema ya pagó y SIGAF seguía teniendo sin pagar ($382,852.68)
-- Fecha: 03/11/2026
-- Prueba: N_AP_IMSS_4002 con pagos del 14 al 30/09 (descargado el 03/11) y del 12/10 al 03/11. Todos con Estado Entrada P.
--   CR 00472239 "(JUL) 389-390"     = 39,556.00 + 10,440.00 = 49,996.00 (exacto)
--   CR 00472305 "(JUL) 3695,3696"   = 39,718.40 +  9,233.60 = 48,952.00 (exacto)
--   CR 00472297 "(JUL) 9745, 9744"  =  4,526.20 + 41,035.24 = 45,561.44 (exacto; la 9744 ya estaba pagada en SIGAF con este CR)
-- Comprobado antes de escribir esto: ningún otro renglón de SIGAF tiene estos CR, salvo la 9744.
-- Compra Emergente queda con firma "autorizada_servicio" (no lleva Adm. de Contrato), como la 391 del mismo proveedor.
-- La fecha de pago es la del reporte: la 1154 se pagó el 30/09, no el 28/09 que dice la cédula.
-- La 4178 ($8,077.08) NO va aquí: no tiene CR ni en la cédula ni en los reportes.
-- SEGURO: solo cambia facturas con ese folio de ingreso, folio e importe, no anuladas, sin CR y en el estatus esperado.
-- Si no son exactamente 11, marca error y no aplica nada. Se puede correr solo una vez: la segunda marca error sin cambiar nada.
-- Cómo: SQL Editor de Supabase → Run. Al final muestra las 11 facturas.
-- =====================================================================
do $$
declare
  n_ce integer;
  n_otras integer;
begin
  update facturas f set
    estatus_general = 'gasto_reflejado',
    estatus_firmas  = 'autorizada_servicio',
    cr_contrarecibo = v.cr,
    fecha_pago      = v.pago
  from (values
    ('HGZ2-CE-2026-000852', '388',      31900.00::numeric, '00472235', date '2026-09-28'),
    ('HGZ2-CE-2026-000853', '389',      39556.00::numeric, '00472239', date '2026-09-28'),
    ('HGZ2-CE-2026-000854', '390',      10440.00::numeric, '00472239', date '2026-09-28'),
    ('HGZ2-CE-2026-000868', 'PH 24164',  4408.00::numeric, '00472313', date '2026-09-28'),
    ('HGZ2-CE-2026-000870', 'PH 24175', 39936.48::numeric, '00472315', date '2026-09-28'),
    ('HGZ2-CE-2026-000882', 'B 03695',  39718.40::numeric, '00472305', date '2026-09-28'),
    ('HGZ2-CE-2026-000883', 'B 03696',   9233.60::numeric, '00472305', date '2026-09-28'),
    ('HGZ2-CE-2026-000884', '1154',      8700.00::numeric, '00472767', date '2026-09-30')
  ) as v (folio_ingreso, folio_proveedor, importe, cr, pago)
  where f.folio_ingreso = v.folio_ingreso
    and f.folio_proveedor = v.folio_proveedor
    and f.importe_factura = v.importe
    and f.anulada = false
    and f.estatus_general = 'en_revision'
    and nullif(btrim(coalesce(f.cr_contrarecibo::text, '')), '') is null;
  get diagnostics n_ce = row_count;

  update facturas f set
    estatus_general = 'gasto_reflejado',
    estatus_firmas  = 'autorizada_admin_contrato',
    cr_contrarecibo = v.cr,
    fecha_pago      = v.pago
  from (values
    ('HGZ2-AM-HIST-000010',  'A1717',     34324.60::numeric, '00471705', date '2026-09-21'),
    ('HGZ2-AM-HIST-001498',  '9745',       4526.20::numeric, '00472297', date '2026-09-17'),
    ('HGZ2-INT-2026-000016', 'EF592313', 160109.40::numeric, '00473972', date '2026-10-15')
  ) as v (folio_ingreso, folio_proveedor, importe, cr, pago)
  where f.folio_ingreso = v.folio_ingreso
    and f.folio_proveedor = v.folio_proveedor
    and f.importe_factura = v.importe
    and f.anulada = false
    and f.estatus_general in ('en_revision', 'en_tramite_ooad')
    and nullif(btrim(coalesce(f.cr_contrarecibo::text, '')), '') is null;
  get diagnostics n_otras = row_count;

  if n_ce <> 8 or n_otras <> 3 then
    raise exception 'Se esperaban 8 de Compra Emergente y 3 más; salieron % y %. No se aplicó nada.', n_ce, n_otras;
  end if;
end $$;

select folio_ingreso, folio_proveedor, importe_factura, estatus_general, estatus_firmas, cr_contrarecibo, fecha_pago
  from facturas
 where folio_ingreso in ('HGZ2-CE-2026-000852','HGZ2-CE-2026-000853','HGZ2-CE-2026-000854','HGZ2-CE-2026-000868',
                         'HGZ2-CE-2026-000870','HGZ2-CE-2026-000882','HGZ2-CE-2026-000883','HGZ2-CE-2026-000884',
                         'HGZ2-AM-HIST-000010','HGZ2-AM-HIST-001498','HGZ2-INT-2026-000016')
 order by cr_contrarecibo, folio_proveedor;
