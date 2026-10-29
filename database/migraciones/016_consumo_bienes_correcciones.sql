-- =====================================================================
-- SIGAF · Corrección · 016 · Consumo de bienes (Compra Emergente) contra el sistema
-- Fecha: 29/10/2026 · Revisión del 28/10 (cb) + export 015 cruzado con N_AP_IMSS_1043 ene–oct
-- Solo se corrige lo que el sistema confirma (comprobante vivo, Estado Pago = P):
--
-- A) Cuenta equivocada (se mueve partida + contrato CE-<cuenta>):
--    HGZ2-CE-2026-000195  Horacio González 21045   51251007 → 51251005   CR 00455398
--    HGZ2-CE-2026-000260  Dimeex FV18612            51251003 → 51251005   CR 00456005
--    HGZ2-CE-2026-000324  Dimeex FV18849            51251002 → 51251007   CR 00455369
--    HGZ2-CE-2026-000162/163/164  AX-LEX 3570/3574/3577  51251017 → 51251022  CR 00452468
--    HGZ2-CE-2026-000807  Bajío PH23986             51251017 → 51251022   CR 00469532
--    HGZ2-CE-2026-000305  Neuroquirúrgica DF754     51251024 → 51251022   CR 00465425
-- B) Ibarra: folios cruzados en la migración. El sistema dice:
--    CR 00452865 = "A 22"   $27,248.40 en 51251022 (SIGAF lo tenía como "3050" en 51251017)
--    CR 00452740 = "B 3050" $32,108.80 en 51251024 (SIGAF lo tenía como "A22"  en 51251017)
-- C) Importes: MDSC A3126 10,040 → 14,040 · Covamedic 227 9,940 → 9,490 · JOCA BFC4 1,613.34 → 1,631.34
-- D) CR equivocado: Ibarra 4024 456122 → 00456103 · Bajío PH24231/PH24237 470128 (eliminado) → 00471466
--    Fondo fijo Nayeli: S/F → CD07 y CD019; FVC25 $943 sin CR → 00470495 (CD089)
-- E) "En revisión" que el sistema YA PAGÓ (pasan a Gasto reflejado con su CR y fecha programada):
--    Mendoza A 18591 00468633 · Ibarra 4370 00468505 · 4440 00472547 · 4474 00472548 · 4476 00472550
--    4477 00472552 · 4472 00472229 · 4475 00472231 · Saldívar 391 00472233 · Bajío PH 24165 00472311
--    Bajío PH 24163 00472225 · Representaciones B 03694 00472308
-- F) Duplicadas: Ibarra "4519" (000653) y "4520" (000764) son las mismas que B4519 (000654) y B4520 (000765),
--    que ya tienen CR 00472730 / 00472731 → se ANULAN las repetidas (ligadas a la buena).
-- G) Altas que faltaban (pagadas en el sistema):
--    Los Socios 215 S113 $17,930 (51251005) CR 00452708 · Galomaya 02398 $1,840.92 (51251020) CR 00452847
--    Representaciones B02370 $4,002 (51251022) CR 00452745 (el CR trae 2370+2864+2865+2869 = 9,713.84)
-- NO se toca: Dueñas 2100–2102 y O2103 (el sistema carga 84.75 y 14 de más a gasto y los regresa a
--    retenciones; la factura real es la que tiene SIGAF). 4178, 4518, 8154 siguen sin comprobante.
-- SEGURO: cada cambio filtra por folio de ingreso + valor anterior; si ya se corrigió, no hace nada.
-- Cómo: SQL Editor de Supabase → Run. Al final muestra las facturas tocadas para revisarlas.
-- =====================================================================
begin;

-- A) Cuenta equivocada
with mv (folio_ingreso, cuenta_ant, cuenta_nva) as (values
  ('HGZ2-CE-2026-000195','51251007','51251005'),
  ('HGZ2-CE-2026-000260','51251003','51251005'),
  ('HGZ2-CE-2026-000324','51251002','51251007'),
  ('HGZ2-CE-2026-000162','51251017','51251022'),
  ('HGZ2-CE-2026-000163','51251017','51251022'),
  ('HGZ2-CE-2026-000164','51251017','51251022'),
  ('HGZ2-CE-2026-000807','51251017','51251022'),
  ('HGZ2-CE-2026-000305','51251024','51251022'))
update facturas f set partida_id = c.partida_id, contrato_id = c.id
from mv
join contratos c on c.numero_interno = 'CE-' || mv.cuenta_nva
where f.folio_ingreso = mv.folio_ingreso and f.anulada = false
  and (select pa.cuenta_finat from partidas pa where pa.id = f.partida_id) = mv.cuenta_ant;

-- B) Ibarra A22 / B3050 (en 3 pasos para no chocar folios)
update facturas set folio_proveedor = 'A22-tmp'
 where folio_ingreso = 'HGZ2-CE-2026-000010' and folio_proveedor = '3050' and cr_contrarecibo = '452865';
update facturas f set folio_proveedor = 'B3050', partida_id = c.partida_id, contrato_id = c.id
  from contratos c
 where c.numero_interno = 'CE-51251024'
   and f.folio_ingreso = 'HGZ2-CE-2026-000013' and f.folio_proveedor = 'A22' and f.cr_contrarecibo = '452740';
update facturas f set folio_proveedor = 'A22', partida_id = c.partida_id, contrato_id = c.id
  from contratos c
 where c.numero_interno = 'CE-51251022'
   and f.folio_ingreso = 'HGZ2-CE-2026-000010' and f.folio_proveedor = 'A22-tmp';

-- C) Importes
with im (folio_ingreso, ant, nvo) as (values
  ('HGZ2-CE-2026-000859', 10040.00, 14040.00),
  ('HGZ2-CE-2026-000899',  9940.00,  9490.00),
  ('HGZ2-CE-2026-000263',  1613.34,  1631.34))
update facturas f set importe_factura = im.nvo
from im where f.folio_ingreso = im.folio_ingreso and f.importe_factura = im.ant and f.anulada = false;

-- D) CR / folio equivocados
update facturas set cr_contrarecibo = '00456103'
 where folio_ingreso = 'HGZ2-CE-2026-000298' and cr_contrarecibo = '456122';
update facturas set cr_contrarecibo = '00471466', fecha_pago = coalesce(fecha_pago, date '2026-09-17')
 where folio_ingreso in ('HGZ2-CE-2026-000875','HGZ2-CE-2026-000876') and cr_contrarecibo = '470128';
update facturas set folio_proveedor = 'CD07'  where folio_ingreso = 'HGZ2-CE-2026-000327' and folio_proveedor = 'S/F';
update facturas set folio_proveedor = 'CD019' where folio_ingreso = 'HGZ2-CE-2026-000328' and folio_proveedor = 'S/F';
update facturas set cr_contrarecibo = '00470495', fecha_pago = coalesce(fecha_pago, date '2026-08-21')
 where folio_ingreso = 'HGZ2-CE-2026-000906' and nullif(btrim(coalesce(cr_contrarecibo,'')),'') is null;

-- E) En revisión que ya se pagaron
with pg (folio_ingreso, cr, fecha_pago) as (values
  ('HGZ2-CE-2026-000794','00468633', date '2026-08-17'),
  ('HGZ2-CE-2026-000738','00468505', date '2026-08-13'),
  ('HGZ2-CE-2026-000817','00472547', date '2026-09-28'),
  ('HGZ2-CE-2026-000821','00472548', date '2026-09-28'),
  ('HGZ2-CE-2026-000823','00472550', date '2026-09-28'),
  ('HGZ2-CE-2026-000824','00472552', date '2026-09-28'),
  ('HGZ2-CE-2026-000820','00472229', date '2026-09-28'),
  ('HGZ2-CE-2026-000822','00472231', date '2026-09-28'),
  ('HGZ2-CE-2026-000855','00472233', date '2026-09-28'),
  ('HGZ2-CE-2026-000869','00472311', date '2026-09-28'),
  ('HGZ2-CE-2026-000867','00472225', date '2026-09-28'),
  ('HGZ2-CE-2026-000881','00472308', date '2026-09-28'))
update facturas f set
  estatus_general = 'gasto_reflejado',
  estatus_firmas  = 'autorizada_servicio',
  cr_contrarecibo = pg.cr,
  fecha_pago      = pg.fecha_pago
from pg
where f.folio_ingreso = pg.folio_ingreso and f.anulada = false
  and f.estatus_general = 'en_revision'
  and nullif(btrim(coalesce(f.cr_contrarecibo,'')),'') is null;

-- F) Duplicadas → anuladas y ligadas a la buena
update facturas f set anulada = true, sustituida_por_id = b.id
from facturas b
where (f.folio_ingreso, b.folio_ingreso) in (('HGZ2-CE-2026-000653','HGZ2-CE-2026-000654'),
                                             ('HGZ2-CE-2026-000764','HGZ2-CE-2026-000765'))
  and f.anulada = false and f.estatus_general = 'en_revision'
  and b.anulada = false and b.importe_factura = f.importe_factura;

-- G) Altas que faltaban
insert into proveedores (no_proveedor, razon_social)
select v.np, v.rs from (values ('161526','LOS SOCIOS 215 SA DE CV'),
                               ('149889','COMERCIALIZADORA GALOMAYA, SA DE CV')) v(np, rs)
where not exists (select 1 from proveedores p where p.no_proveedor = v.np or p.razon_social ilike split_part(replace(v.rs, ',', ''), ' SA', 1) || '%');

with nv (n, folio, prov_like, cuenta, importe, f_factura, p_ini, p_fin, mes, cr, f_pago) as (values
  (1, 'S113',   'LOS SOCIOS 215%',                 '51251005', 17930.00, date '2025-05-22', date '2025-05-01', date '2025-05-31', 3, '00452708', date '2026-02-12'),
  (2, '02398',  'COMERCIALIZADORA GALOMAYA%',      '51251020',  1840.92, date '2025-01-28', date '2025-01-01', date '2025-01-31', 2, '00452847', date '2026-02-16'),
  (3, 'B02370', 'REPRESENTACIONES MEDICAS Y DE L%', '51251022',  4002.00, date '2025-06-04', date '2025-06-01', date '2025-06-30', 3, '00452745', date '2026-02-16')),
base as (select coalesce(max(substring(folio_ingreso from 'HGZ2-CE-2026-(\d+)$')::int), 0) as ultimo
         from facturas where folio_ingreso ~ '^HGZ2-CE-2026-\d+$'),
pv as (select distinct on (nv.n) nv.n, p.id from nv join proveedores p on p.razon_social ilike nv.prov_like order by nv.n, p.razon_social)
insert into facturas (
  folio_ingreso, folio_proveedor, fecha_factura, capitulo_id, partida_id, contrato_id, proveedor_id,
  periodo_inicio, periodo_fin, importe_factura, tasa_iva, es_pasivo, mes_asignado, anio_asignado,
  estatus_general, estatus_firmas, cr_contrarecibo, fecha_pago, origen_migracion, created_by
)
select
  'HGZ2-CE-2026-' || lpad((base.ultimo + row_number() over (order by nv.n))::text, 6, '0'),
  nv.folio, nv.f_factura, pa.capitulo_id, c.partida_id, c.id, pv.id,
  nv.p_ini, nv.p_fin, nv.importe, 0, true, nv.mes, 2026,
  'gasto_reflejado', 'autorizada_servicio', nv.cr, nv.f_pago,
  'Corrección 29/10/2026 (cb 28/10): N_AP_IMSS_1043 cbte ' || nv.cr || ' pagado, faltaba en SIGAF',
  (select id from usuarios where nombre = 'Gabriel Zacarias' limit 1)
from nv
cross join base
join pv on pv.n = nv.n
join contratos c on c.numero_interno = 'CE-' || nv.cuenta
join partidas pa on pa.id = c.partida_id
where not exists (
  select 1 from facturas f
  where f.proveedor_id = pv.id and f.anulada = false
    and regexp_replace(f.folio_proveedor, '\D', '', 'g')::text = regexp_replace(nv.folio, '\D', '', 'g')
    and f.importe_factura = nv.importe);

commit;

-- Verificación: las facturas tocadas (deben salir 36: 33 corregidas/anuladas + 3 altas)
select f.folio_ingreso, f.folio_proveedor, pr.razon_social as proveedor, pa.cuenta_finat,
       f.importe_factura, f.estatus_general, f.cr_contrarecibo, f.fecha_pago, f.anulada
from facturas f
join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
where f.folio_ingreso in (
  'HGZ2-CE-2026-000195','HGZ2-CE-2026-000260','HGZ2-CE-2026-000324','HGZ2-CE-2026-000162','HGZ2-CE-2026-000163',
  'HGZ2-CE-2026-000164','HGZ2-CE-2026-000807','HGZ2-CE-2026-000305','HGZ2-CE-2026-000010','HGZ2-CE-2026-000013',
  'HGZ2-CE-2026-000859','HGZ2-CE-2026-000899','HGZ2-CE-2026-000263','HGZ2-CE-2026-000298','HGZ2-CE-2026-000875',
  'HGZ2-CE-2026-000876','HGZ2-CE-2026-000327','HGZ2-CE-2026-000328','HGZ2-CE-2026-000906','HGZ2-CE-2026-000794',
  'HGZ2-CE-2026-000738','HGZ2-CE-2026-000817','HGZ2-CE-2026-000821','HGZ2-CE-2026-000823','HGZ2-CE-2026-000824',
  'HGZ2-CE-2026-000820','HGZ2-CE-2026-000822','HGZ2-CE-2026-000855','HGZ2-CE-2026-000869','HGZ2-CE-2026-000867',
  'HGZ2-CE-2026-000881','HGZ2-CE-2026-000653','HGZ2-CE-2026-000764')
   or f.origen_migracion like 'Corrección 29/10/2026 (cb 28/10)%'
order by pa.cuenta_finat, f.folio_ingreso;
