-- =====================================================================
-- SIGAF · Área Médica — PILOTO (22 facturas)
-- Capítulo "Área Médica": 4 partidas, 7 proveedores, 16 contratos.
-- Idempotente. Correr en el SQL Editor de Supabase.
-- =====================================================================
begin;
alter table facturas disable trigger trg_a_historial;
alter table facturas disable trigger trg_b_auto_en_revision;

-- 1) Capítulo
insert into capitulos (nombre) select 'Área Médica' where not exists (select 1 from capitulos where nombre='Área Médica');

-- 2) Partidas (cuenta_prei NULL para respetar el check de formato; la cuenta va en cuenta_finat)
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Área Médica'), '51251006', 'Medicina Magistral' where not exists (select 1 from partidas where cuenta_finat='51251006');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Área Médica'), '51251018', 'Aparatos de Ortopedia y Prótesis (Órtesis)' where not exists (select 1 from partidas where cuenta_finat='51251018');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Área Médica'), '51251019', 'Osteosíntesis y Endoprótesis' where not exists (select 1 from partidas where cuenta_finat='51251019');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Área Médica'), '51221001', 'Víveres (Abarrotes, Leches, Frutas y Verduras)' where not exists (select 1 from partidas where cuenta_finat='51221001');

-- 3) Proveedores
insert into proveedores (razon_social) select 'Derma Body, S.A. de C.V.' where not exists (select 1 from proveedores where razon_social='Derma Body, S.A. de C.V.');
insert into proveedores (razon_social) select 'Tecnología en Órtesis y Prótesis' where not exists (select 1 from proveedores where razon_social='Tecnología en Órtesis y Prótesis');
insert into proveedores (razon_social) select 'BIODIST, S.A. de C.V.' where not exists (select 1 from proveedores where razon_social='BIODIST, S.A. de C.V.');
insert into proveedores (razon_social) select 'TRAUMASERVICE INTERNACIONAL' where not exists (select 1 from proveedores where razon_social='TRAUMASERVICE INTERNACIONAL');
insert into proveedores (razon_social) select 'Jesús Manuel Romo Alba' where not exists (select 1 from proveedores where razon_social='Jesús Manuel Romo Alba');
insert into proveedores (razon_social) select 'Mercedes Adriana Diaz Cano' where not exists (select 1 from proveedores where razon_social='Mercedes Adriana Diaz Cano');
insert into proveedores (razon_social) select 'Ana Karen Perez Alvarez' where not exists (select 1 from proveedores where razon_social='Ana Karen Perez Alvarez');

-- 4) Contratos
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032N14025-184-00', (select id from proveedores where razon_social='Derma Body, S.A. de C.V.' limit 1), (select id from partidas where cuenta_finat='51251006' limit 1), 'DRA. HILDA MÓNICA LOPEZ', 'Medicina magistral', '2026-01-01'::date, '2026-02-28'::date, 3496.68 where not exists (select 1 from contratos where numero_interno='050GYR032N14025-184-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032N12025-195-00', (select id from proveedores where razon_social='Derma Body, S.A. de C.V.' limit 1), (select id from partidas where cuenta_finat='51251006' limit 1), 'DRA. HILDA MÓNICA LOPEZ', 'Medicina magistral', '2026-03-01'::date, '2026-12-31'::date, 423071 where not exists (select 1 from contratos where numero_interno='050GYR032N12025-195-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032T14125-185-00', (select id from proveedores where razon_social='Tecnología en Órtesis y Prótesis' limit 1), (select id from partidas where cuenta_finat='51251018' limit 1), 'DRA. HILDA MÓNICA LOPEZ', 'Órtesis y prótesis externas', '2026-01-01'::date, '2026-02-28'::date, 738607 where not exists (select 1 from contratos where numero_interno='050GYR032T14125-185-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032T12125-009-00', (select id from proveedores where razon_social='Tecnología en Órtesis y Prótesis' limit 1), (select id from partidas where cuenta_finat='51251018' limit 1), 'DRA. HILDA MÓNICA LOPEZ', 'Órtesis y prótesis externas', '2026-03-01'::date, '2026-12-31'::date, 650000 where not exists (select 1 from contratos where numero_interno='050GYR032T12125-009-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032T14225-187-00', (select id from proveedores where razon_social='BIODIST, S.A. de C.V.' limit 1), (select id from partidas where cuenta_finat='51251019' limit 1), 'Dra. Maria Josefina Rodarte', 'Osteosíntesis y endoprótesis', '2026-01-01'::date, '2026-02-28'::date, 5269698.24 where not exists (select 1 from contratos where numero_interno='050GYR032T14225-187-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032T00126-016-00', (select id from proveedores where razon_social='BIODIST, S.A. de C.V.' limit 1), (select id from partidas where cuenta_finat='51251019' limit 1), 'Dra. Maria Josefina Rodarte', 'Osteosíntesis y endoprótesis', '2026-03-01'::date, '2026-12-31'::date, 64336589.46 where not exists (select 1 from contratos where numero_interno='050GYR032T00126-016-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032T08425-098-00', (select id from proveedores where razon_social='BIODIST, S.A. de C.V.' limit 1), (select id from partidas where cuenta_finat='51251019' limit 1), 'Dra. Maria Josefina Rodarte', 'Osteosíntesis (pasivo 2025)', '2025-07-05'::date, '2025-09-15'::date, 782536 where not exists (select 1 from contratos where numero_interno='050GYR032T08425-098-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032T14024-434-00', (select id from proveedores where razon_social='TRAUMASERVICE INTERNACIONAL' limit 1), (select id from partidas where cuenta_finat='51251019' limit 1), 'Dra. Maria Josefina Rodarte', 'Osteosíntesis (pasivo 2025)', '2025-01-16'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='050GYR032T14024-434-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032T14024-433-00', (select id from proveedores where razon_social='BIODIST, S.A. de C.V.' limit 1), (select id from partidas where cuenta_finat='51251019' limit 1), 'Dra. Maria Josefina Rodarte', 'Osteosíntesis (pasivo 2025)', '2025-01-01'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='050GYR032T14024-433-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032T00425-002-00', (select id from proveedores where razon_social='BIODIST, S.A. de C.V.' limit 1), (select id from partidas where cuenta_finat='51251019' limit 1), 'Dra. Maria Josefina Rodarte', 'Osteosíntesis (pasivo 2025)', '2025-01-01'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='050GYR032T00425-002-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select '050GYR032T10425-121-00', (select id from proveedores where razon_social='BIODIST, S.A. de C.V.' limit 1), (select id from partidas where cuenta_finat='51251019' limit 1), 'Dra. Maria Josefina Rodarte', 'Osteosíntesis (pasivo 2025)', '2025-01-01'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='050GYR032T10425-121-00');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'D5M0013', (select id from proveedores where razon_social='Jesús Manuel Romo Alba' limit 1), (select id from partidas where cuenta_finat='51221001' limit 1), 'DRA. HILDA MÓNICA LOPEZ', 'Abarrotes (pasivo 2025)', '2025-01-01'::date, '2025-12-31'::date, 349550.94 where not exists (select 1 from contratos where numero_interno='D5M0013');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'D6M0018', (select id from proveedores where razon_social='Jesús Manuel Romo Alba' limit 1), (select id from partidas where cuenta_finat='51221001' limit 1), 'DRA. HILDA MÓNICA LOPEZ', 'Abarrotes', '2026-01-01'::date, '2026-02-28'::date, 1457000 where not exists (select 1 from contratos where numero_interno='D6M0018');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'D6M0032', (select id from proveedores where razon_social='Jesús Manuel Romo Alba' limit 1), (select id from partidas where cuenta_finat='51221001' limit 1), 'DRA. HILDA MÓNICA LOPEZ', 'Abarrotes', '2026-03-01'::date, '2026-12-31'::date, 3348467.1 where not exists (select 1 from contratos where numero_interno='D6M0032');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'D6M0033', (select id from proveedores where razon_social='Mercedes Adriana Diaz Cano' limit 1), (select id from partidas where cuenta_finat='51221001' limit 1), 'DRA. HILDA MÓNICA LOPEZ', 'Frutas y verduras', '2026-03-01'::date, '2026-12-31'::date, 1569593.95 where not exists (select 1 from contratos where numero_interno='D6M0033');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'D6M0034', (select id from proveedores where razon_social='Ana Karen Perez Alvarez' limit 1), (select id from partidas where cuenta_finat='51221001' limit 1), 'DRA. HILDA MÓNICA LOPEZ', 'Leches', '2026-03-01'::date, '2026-12-31'::date, 261598.99 where not exists (select 1 from contratos where numero_interno='D6M0034');

-- 5) Facturas
insert into facturas
  (folio_ingreso, folio_proveedor, capitulo_id, partida_id, contrato_id, proveedor_id,
   periodo_inicio, periodo_fin, mes_asignado, anio_asignado, tasa_iva, importe_factura,
   estatus_general, estatus_firmas, estatus_pedido_recepcion, es_pasivo, cr_contrarecibo)
select v.folio_ingreso, v.folio_proveedor, pa.capitulo_id, c.partida_id, c.id, c.proveedor_id,
  v.periodo_inicio::date, v.periodo_fin::date, v.mes_asig, v.anio_asig, 0.16, v.importe,
  v.gen::estatus_general, v.fir::estatus_firmas, v.ped::estatus_pedido_recepcion, v.es_pasivo, v.cr
from (values
  ('HGZ2-AM-HIST-0001', 'A1538', '050GYR032N14025-184-00', '2026-01-01', '2026-01-31', 1, 2026, 3204.78, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '457243'),
  ('HGZ2-AM-HIST-0002', 'A1541', '050GYR032N14025-184-00', '2026-01-01', '2026-01-31', 1, 2026, 291.9, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '457274'),
  ('HGZ2-AM-HIST-0003', 'A1580', '050GYR032N12025-195-00', '2026-03-01', '2026-03-31', 3, 2026, 10117.9, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '459398'),
  ('HGZ2-AM-HIST-0004', 'A1608', '050GYR032N12025-195-00', '2026-03-01', '2026-03-31', 3, 2026, 15159.33, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '461481'),
  ('HGZ2-AM-HIST-0005', 'A1611', '050GYR032N12025-195-00', '2026-04-01', '2026-04-30', 4, 2026, 9193.63, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '461484'),
  ('HGZ2-AM-HIST-0006', 'A1626', '050GYR032N12025-195-00', '2026-04-01', '2026-04-30', 4, 2026, 22430.01, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '463210'),
  ('HGZ2-AM-HIST-0011', 'A10399', '050GYR032T14125-185-00', '2026-01-01', '2026-01-31', 1, 2026, 151211.4, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '456783'),
  ('HGZ2-AM-HIST-0012', 'A10401', '050GYR032T14125-185-00', '2026-01-01', '2026-01-31', 1, 2026, 242277.18, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '456784'),
  ('HGZ2-AM-HIST-0013', 'A10587', '050GYR032T12125-009-00', '2026-05-01', '2026-05-31', 5, 2026, 182131.57, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', false, null),
  ('HGZ2-AM-HIST-0014', 'A10612', '050GYR032T12125-009-00', '2026-05-01', '2026-05-31', 5, 2026, 206277.84, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466517'),
  ('HGZ2-AM-HIST-0015', 'A66173', '050GYR032T14024-434-00', '2025-11-01', '2025-11-30', 5, 2026, 39208, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460921'),
  ('HGZ2-AM-HIST-0016', 'A66174', '050GYR032T14024-434-00', '2025-11-01', '2025-11-30', 5, 2026, 39208, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460926'),
  ('HGZ2-AM-HIST-0017', 'A66451', '050GYR032T14024-434-00', '2025-12-01', '2025-12-31', 5, 2026, 39208, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460945'),
  ('HGZ2-AM-HIST-0018', 'A66579', '050GYR032T14024-434-00', '2025-12-01', '2025-12-31', 5, 2026, 39208, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460946'),
  ('HGZ2-AM-HIST-0019', 'A66581', '050GYR032T14024-434-00', '2025-12-01', '2025-12-31', 5, 2026, 17284, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460951'),
  ('HGZ2-AM-HIST-0020', 'A67978', '050GYR032T14024-434-00', '2025-03-01', '2025-03-31', 5, 2026, 53592, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460928'),
  ('HGZ2-AM-HIST-0921', 'A18846', 'D5M0013', '2025-09-01', '2025-09-30', 6, 2026, 1905.19, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460882'),
  ('HGZ2-AM-HIST-0922', 'A19443', 'D5M0013', '2025-12-01', '2025-12-31', 6, 2026, 47369.94, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461095'),
  ('HGZ2-AM-HIST-0923', 'A19444', 'D5M0013', '2025-12-01', '2025-12-31', 6, 2026, 5718.7, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461095'),
  ('HGZ2-AM-HIST-0924', 'A19445', 'D5M0013', '2025-12-01', '2025-12-31', 6, 2026, 1287.9, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461095'),
  ('HGZ2-AM-HIST-0925', 'A19446', 'D5M0013', '2025-12-01', '2025-12-31', 6, 2026, 6177.68, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461095'),
  ('HGZ2-AM-HIST-0926', 'A19449', 'D5M0013', '2025-12-01', '2025-12-31', 6, 2026, 4989.66, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460974')
) as v(folio_ingreso, folio_proveedor, contrato, periodo_inicio, periodo_fin, mes_asig, anio_asig, importe, gen, fir, ped, es_pasivo, cr)
join contratos c on c.numero_interno = v.contrato
join partidas pa on pa.id = c.partida_id
where not exists (select 1 from facturas f where f.folio_proveedor = v.folio_proveedor and f.contrato_id = c.id);

alter table facturas enable trigger trg_a_historial;
alter table facturas enable trigger trg_b_auto_en_revision;
commit;
