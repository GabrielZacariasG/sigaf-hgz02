-- =====================================================================
-- SIGAF · Corrección · 026 · En trámite OOAD contra el N_AP_IMSS_1043 del 29/10/2026
-- Fecha: 29/10/2026 · export 025 cruzado con N_AP 1043 (ene–oct + corte 1020 del 29/10)
-- Resultado del cruce:
--  · 56 CR válidos en SIGAF: TODOS siguen "sin pagar" en el sistema (Estado Pago N) → no se tocan.
--  · Biodist 51251019 (56 facturas migradas con CR = "SI"): cada una tiene su comprobante propio y
--    YA PAGADO (programados 15, 19 y 27/10/2026) → se pone el CR real, Gasto reflejado y fecha de pago.
--    Dos importes estaban mal capturados en la migración: 8579 68,678.00 → 68,672.00 y
--    9240 66,672.00 → 68,672.00 (el comprobante es de una sola factura, así que su importe es el bueno).
--  · Derma Body A1703: su CR 471022 se eliminó; el bueno es 00473323 (,510.81), PAGADO 08/10/2026.
--  · Ana Karen Pérez 4398: su CR 471000 se eliminó; el nuevo es 00476312 (,887), aún sin pagar.
-- SEGURO: Biodist solo si su CR sigue siendo "SI"; los otros solo si conservan el CR eliminado.
-- Cómo: SQL Editor de Supabase → Run. Al final: biodist_con_si = 0, derma_y_ana = 2 y biodist_pagadas >= 56.
-- =====================================================================
begin;

with bio (folio, cr, importe, fecha_pago) as (values
  ('7873','00474656',18798.96,date '2026-10-27'),
  ('8266','00474691',1044,date '2026-10-27'),
  ('8278','00474657',22446,date '2026-10-27'),
  ('8579','00473989',68672,date '2026-10-15'),
  ('8611','00473991',42509.36,date '2026-10-15'),
  ('8740','00473976',35990.16,date '2026-10-15'),
  ('8800','00474128',522,date '2026-10-19'),
  ('8801','00474673',18242.16,date '2026-10-27'),
  ('8802','00474674',17840.8,date '2026-10-27'),
  ('8803','00474806',1044,date '2026-10-27'),
  ('8804','00474677',19488,date '2026-10-27'),
  ('8805','00473996',53663.92,date '2026-10-15'),
  ('8807','00474130',522,date '2026-10-19'),
  ('8809','00474694',1044,date '2026-10-27'),
  ('8812','00474131',522,date '2026-10-19'),
  ('8813','00473985',34384.72,date '2026-10-15'),
  ('8815','00474697',7714,date '2026-10-27'),
  ('8816','00473967',68470.16,date '2026-10-15'),
  ('8817','00473974',34044.84,date '2026-10-15'),
  ('8818','00474701',11734.56,date '2026-10-27'),
  ('8820','00474703',7192,date '2026-10-27'),
  ('8825','00473984',48518.16,date '2026-10-15'),
  ('8826','00474707',9632.64,date '2026-10-27'),
  ('8827','00474132',522,date '2026-10-19'),
  ('8828','00474710',10556,date '2026-10-27'),
  ('8829','00473971',68672,date '2026-10-15'),
  ('8830','00473960',47399.92,date '2026-10-15'),
  ('8831','00474122',1044,date '2026-10-19'),
  ('8844','00474714',9739.36,date '2026-10-27'),
  ('8849','00474718',1566,date '2026-10-27'),
  ('8985','00473977',35444.96,date '2026-10-15'),
  ('8992','00473982',42456,date '2026-10-15'),
  ('9171','00474124',1044,date '2026-10-19'),
  ('9173','00474722',10672,date '2026-10-27'),
  ('9176','00474739',29842.16,date '2026-10-27'),
  ('9177','00473994',43588.16,date '2026-10-15'),
  ('9178','00474725',9632.64,date '2026-10-27'),
  ('9182','00473980',68672,date '2026-10-15'),
  ('9183','00473983',34714.16,date '2026-10-15'),
  ('9184','00473993',40018.84,date '2026-10-15'),
  ('9185','00474728',8704.64,date '2026-10-27'),
  ('9188','00473988',57682.16,date '2026-10-15'),
  ('9191','00473990',55246.16,date '2026-10-15'),
  ('9194','00474731',2204,date '2026-10-27'),
  ('9199','00474733',10556,date '2026-10-27'),
  ('9200','00474736',3480,date '2026-10-27'),
  ('9201','00473966',68672,date '2026-10-15'),
  ('9202','00473973',42454.84,date '2026-10-15'),
  ('9240','00473961',68672,date '2026-10-15'),
  ('9242','00474126',522,date '2026-10-19'),
  ('9244','00474125',1044,date '2026-10-19'),
  ('9245','00474738',9632.64,date '2026-10-27'),
  ('9246','00474761',29842.16,date '2026-10-27'),
  ('9249','00474742',7192,date '2026-10-27'),
  ('9251','00473986',68672,date '2026-10-15'),
  ('9254','00473979',40598.84,date '2026-10-15')

)
update facturas f set
  cr_contrarecibo = bio.cr,
  importe_factura = bio.importe,
  estatus_general = 'gasto_reflejado',
  fecha_pago      = bio.fecha_pago
from bio, proveedores p
where p.id = f.proveedor_id and p.razon_social ilike 'BIODIST%'
  and f.folio_proveedor = bio.folio and f.anulada = false
  and f.estatus_general = 'en_tramite_ooad' and upper(btrim(f.cr_contrarecibo)) = 'SI'
  and abs(f.importe_factura - bio.importe) <= 2000;

update facturas set cr_contrarecibo = '00473323', estatus_general = 'gasto_reflejado', fecha_pago = date '2026-10-08'
where folio_ingreso = 'HGZ2-AM-HIST-000009' and folio_proveedor = 'A1703' and cr_contrarecibo = '471022' and anulada = false;

update facturas set cr_contrarecibo = '00476312'
where folio_ingreso = 'HGZ2-AM-HIST-001557' and folio_proveedor = '4398' and cr_contrarecibo = '471000' and anulada = false;

commit;

-- Verificación
select count(*) filter (where p.razon_social ilike 'BIODIST%' and pa.cuenta_finat = '51251019'
                        and f.estatus_general = 'gasto_reflejado' and f.fecha_pago between date '2026-10-15' and date '2026-10-27') as biodist_pagadas,
       count(*) filter (where p.razon_social ilike 'BIODIST%' and upper(btrim(coalesce(f.cr_contrarecibo,''))) = 'SI') as biodist_con_si,
       count(*) filter (where f.cr_contrarecibo in ('00473323','00476312')) as derma_y_ana
from facturas f join proveedores p on p.id = f.proveedor_id join partidas pa on pa.id = f.partida_id
where f.anulada = false;