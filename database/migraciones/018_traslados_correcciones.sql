-- =====================================================================
-- SIGAF · Corrección · 018 · Traslados 52411011 / 52411024 contra el sistema
-- Fecha: 29/10/2026 · export 017 cruzado con N_AP_IMSS_1043 ene–oct (solo la UI 010102 = HGZ 2)
-- La diferencia de 52411011 (−275,496.34) se explica completa:
--   + 321,891.31  5 comprobantes de Autobuses que no están en SIGAF
--   +   3,050.06  2 reembolsos de fondo fijo de julio que faltan
--   −  37,794.33  Autobuses 40511 capturada DOS veces (CDS-000008 y CDS-000013)
--   −   5,316.00  Cruz Roja 140/141/142: SIGAF tiene la factura completa; al HGZ 2 le toca 7,799 / 495 / 495
--                 (el resto, 2,306 / 1,505 / 1,505, es de la UI 010103)
--   −   3,284.68  T AGO 01 y T AGO 02 están en 52411024 en el sistema, no en 52411011
--   −   3,050.06  "T JUN 04" (CR 00465766) en el sistema es "O JUN 04 - CD066", cuenta 51371004 Mensajería
--                 → NO se toca aquí (decisión de Gabriel)
--   +       0.04  centavos de Autobuses (67901, 34354, 36793 y 36116/36309)
-- 52411024 (−36,492.70): SIGAF no tenía esta cuenta. Se da de alta la partida y el contrato marco
--   "PERNOCTA-REEMB" (Nayeli Alonso, como PERNOCTA), se mueven T AGO 01/02 y se dan de alta 6 reembolsos.
-- Autobuses 40511+40670: el sistema ya les dio CR 00475172 (pagado, programado 29/10/2026).
-- SEGURO: cada cambio filtra por folio de ingreso + valor anterior; las altas no se repiten.
-- Cómo: SQL Editor de Supabase → Run. Al final muestra el total por cuenta.
-- =====================================================================
begin;

-- 1) Partida y contrato marco de 52411024
insert into partidas (capitulo_id, cuenta_finat, nombre)
select (select capitulo_id from partidas where cuenta_finat = '52411011' limit 1),
       '52411024', 'Reembolso de gastos por traslado de pacientes'
where not exists (select 1 from partidas where cuenta_finat = '52411024');

insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin)
select 'PERNOCTA-REEMB',
       (select proveedor_id from contratos where numero_interno = 'PERNOCTA' limit 1),
       (select id from partidas where cuenta_finat = '52411024' limit 1),
       'Reembolso de gastos por traslado de pacientes (fondo fijo)',
       date '2026-01-01', date '2026-12-31'
where not exists (select 1 from contratos where numero_interno = 'PERNOCTA-REEMB');

-- 2) T AGO 01 / T AGO 02 → 52411024
update facturas f set partida_id = c.partida_id, contrato_id = c.id
from contratos c
where c.numero_interno = 'PERNOCTA-REEMB'
  and f.folio_ingreso in ('HGZ2-SS-HIST-000019','HGZ2-SS-HIST-000020')
  and f.cr_contrarecibo in ('469554','470926') and f.anulada = false;

-- 3) Cruz Roja: parte que le toca al HGZ 2 (UI 010102)
with cr (folio_ingreso, ant, nvo) as (values
  ('HGZ2-SS-HIST-000041', 10105.00, 7799.00),
  ('HGZ2-SS-HIST-000042',  2000.00,  495.00),
  ('HGZ2-SS-HIST-000044',  2000.00,  495.00))
update facturas f set importe_factura = cr.nvo
from cr where f.folio_ingreso = cr.folio_ingreso and f.importe_factura = cr.ant and f.anulada = false;

-- 4) Centavos de Autobuses (importe exacto del comprobante)
with ct (folio_ingreso, ant, nvo) as (values
  ('HGZ2-SS-HIST-000075', 48404.62, 48404.63),
  ('HGZ2-SS-HIST-000081', 36543.40, 36543.41),
  ('HGZ2-SS-HIST-000090', 59410.01, 59410.02),
  ('HGZ2-SS-HIST-000088', 57348.00, 57348.01))
update facturas f set importe_factura = ct.nvo
from ct where f.folio_ingreso = ct.folio_ingreso and f.importe_factura = ct.ant and f.anulada = false;

-- 5) Autobuses 40511 duplicada: se anula CDS-000013 (folio mal escrito) y se liga a CDS-000008
update facturas f set anulada = true, sustituida_por_id = b.id
from facturas b
where f.folio_ingreso = 'HGZ2-CDS-2026-000013' and b.folio_ingreso = 'HGZ2-CDS-2026-000008'
  and f.anulada = false and b.anulada = false and f.importe_factura = b.importe_factura;

-- 6) 40511 + 40670 ya pagadas con CR 00475172
update facturas set
  folio_proveedor = case when folio_proveedor = 'SCXCFA-40511' then 'SCXCFA 40511' else folio_proveedor end,
  estatus_general = 'gasto_reflejado',
  estatus_firmas  = 'autorizada_admin_contrato',
  cr_contrarecibo = '00475172',
  fecha_pago      = date '2026-10-29'
where folio_ingreso in ('HGZ2-CDS-2026-000008','HGZ2-CDS-2026-000014')
  and anulada = false and nullif(btrim(coalesce(cr_contrarecibo,'')),'') is null;

-- 7) Altas que faltaban
with nv (n, contrato, folio, importe, p_ini, p_fin, f_factura, gen, cr, f_pago) as (values
  ( 1, 'S6M0030',        'SCXCFA 39200',         57260.00, date '2026-08-01', date '2026-08-31', date '2026-08-10', 'gasto_reflejado', '00470353', date '2026-09-07'),
  ( 2, 'S6M0030',        'SCXCFA 39443-39521',   47133.00, date '2026-08-01', date '2026-08-31', date '2026-08-18', 'gasto_reflejado', '00471552', date '2026-09-17'),
  ( 3, 'S6M0030',        'SCXCFA 39441',         98287.58, date '2026-08-01', date '2026-08-31', date '2026-09-11', 'gasto_reflejado', '00472889', date '2026-10-01'),
  ( 4, 'S6M0030',        'SCXCFA 40264',         62811.96, date '2026-09-01', date '2026-09-30', date '2026-09-07', 'en_tramite_ooad', '00476281', null::date),
  ( 5, 'S6M0030',        'SCXCFA 41097',         56398.77, date '2026-09-01', date '2026-09-30', date '2026-09-30', 'en_tramite_ooad', '00476265', null::date),
  ( 6, 'PERNOCTA',       'T JUL 01 - 16/2026',    1876.96, date '2026-07-01', date '2026-07-31', date '2026-07-10', 'gasto_reflejado', '00467258', date '2026-07-17'),
  ( 7, 'PERNOCTA',       'T JUL 02 - 17/2026',    1173.10, date '2026-07-01', date '2026-07-31', date '2026-07-17', 'gasto_reflejado', '00468033', date '2026-07-24'),
  ( 8, 'PERNOCTA-REEMB', 'T SEP 01 -22/2026',     2111.58, date '2026-09-01', date '2026-09-30', date '2026-09-01', 'gasto_reflejado', '00471756', date '2026-09-07'),
  ( 9, 'PERNOCTA-REEMB', 'T SEP 02 - 23/2026',    2346.20, date '2026-09-01', date '2026-09-30', date '2026-09-14', 'gasto_reflejado', '00473202', date '2026-09-21'),
  (10, 'PERNOCTA-REEMB', 'T OCT 01 - CD113/2026', 10048.00, date '2026-10-01', date '2026-10-31', date '2026-10-15', 'gasto_reflejado', '00475671', date '2026-10-19'),
  (11, 'PERNOCTA-REEMB', 'T OCT 02 - CD115/2026',  9464.00, date '2026-10-01', date '2026-10-31', date '2026-10-19', 'gasto_reflejado', '00475770', date '2026-10-23'),
  (12, 'PERNOCTA-REEMB', 'T OCT 03 -24/2026',      469.24, date '2026-10-01', date '2026-10-31', date '2026-10-19', 'gasto_reflejado', '00475805', date '2026-10-23'),
  (13, 'PERNOCTA-REEMB', 'T OCT 04 - CD116/2026',  8769.00, date '2026-10-01', date '2026-10-31', date '2026-10-20', 'gasto_reflejado', '00475881', date '2026-10-26')),
base as (select coalesce(max(substring(folio_ingreso from 'HGZ2-CDS-2026-(\d+)$')::int), 0) as ultimo
         from facturas where folio_ingreso ~ '^HGZ2-CDS-2026-\d+$'),
nuevos as (
  select nv.*, c.id as contrato_id, c.partida_id, c.proveedor_id, pa.capitulo_id
  from nv
  join contratos c on c.numero_interno = nv.contrato
  join partidas pa on pa.id = c.partida_id
  where not exists (select 1 from facturas f where f.cr_contrarecibo = nv.cr and f.anulada = false))
insert into facturas (
  folio_ingreso, folio_proveedor, fecha_factura, capitulo_id, partida_id, contrato_id, proveedor_id,
  periodo_inicio, periodo_fin, importe_factura, tasa_iva,
  estatus_general, estatus_firmas, estatus_pedido_recepcion, cr_contrarecibo, fecha_pago,
  origen_migracion, created_by
)
select
  'HGZ2-CDS-2026-' || lpad((base.ultimo + row_number() over (order by nuevos.n))::text, 6, '0'),
  nuevos.folio, nuevos.f_factura, nuevos.capitulo_id, nuevos.partida_id, nuevos.contrato_id, nuevos.proveedor_id,
  nuevos.p_ini, nuevos.p_fin, nuevos.importe,
  coalesce((select f.tasa_iva from facturas f where f.contrato_id = nuevos.contrato_id and f.anulada = false limit 1), 0),
  nuevos.gen::estatus_general, 'autorizada_admin_contrato', 'generado', nuevos.cr, nuevos.f_pago,
  'Corrección 29/10/2026 (traslados): N_AP_IMSS_1043 cbte ' || nuevos.cr || ', faltaba en SIGAF',
  (select id from usuarios where nombre = 'Gabriel Zacarias' limit 1)
from nuevos cross join base;

commit;

-- Verificación: debe dar 52411011 = 2,363,189.69 (incluye 3,050.06 de "T JUN 04" pendiente de decidir)
--               y 52411024 = 36,492.70 con 8 facturas
select pa.cuenta_finat, count(f.id) as facturas, sum(f.importe_factura) as importe,
       count(*) filter (where f.estatus_general = 'en_tramite_ooad') as en_tramite
from facturas f join partidas pa on pa.id = f.partida_id
where pa.cuenta_finat in ('52411011','52411024') and f.anulada = false and f.estatus_general <> 'devuelta_proveedor'
group by pa.cuenta_finat order by 1;
