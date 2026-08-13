-- SIGAF · Subrogados — carga (201 facturas). Idempotente.
begin;
alter table facturas disable trigger trg_a_historial;
alter table facturas disable trigger trg_b_auto_en_revision;

insert into capitulos (nombre) select 'Subrogados' where not exists (select 1 from capitulos where nombre='Subrogados');

-- Partidas
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Subrogados'), '51331003', 'Estudios y servicios de diagnóstico subrogados' where not exists (select 1 from partidas where cuenta_finat='51331003');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Subrogados'), '51331001', 'Servicios subrogados (valoraciones)' where not exists (select 1 from partidas where cuenta_finat='51331001');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Subrogados'), '51331005', 'Cirugías subrogadas (cateterismo/angiografía/oftalmología)' where not exists (select 1 from partidas where cuenta_finat='51331005');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Subrogados'), '52411011', 'Gastos por traslado de pacientes' where not exists (select 1 from partidas where cuenta_finat='52411011');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Subrogados'), '51331010', 'Servicios del Acuerdo General de Intercambio de Servicios' where not exists (select 1 from partidas where cuenta_finat='51331010');

-- Proveedores
insert into proveedores (razon_social) select 'AUTOBUSES DE LA PIEDAD, S.A. DE C.V.' where not exists (select 1 from proveedores where razon_social='AUTOBUSES DE LA PIEDAD, S.A. DE C.V.');
insert into proveedores (razon_social) select 'CRUZ ROJA MEXICANA' where not exists (select 1 from proveedores where razon_social='CRUZ ROJA MEXICANA');
insert into proveedores (razon_social) select 'FISICA MEDICA FIMERA, S.A. DE C.V.' where not exists (select 1 from proveedores where razon_social='FISICA MEDICA FIMERA, S.A. DE C.V.');
insert into proveedores (razon_social) select 'GABINETE DE ESTUDIOS DIAGNOSTICOS DE AGUASCALIENTES' where not exists (select 1 from proveedores where razon_social='GABINETE DE ESTUDIOS DIAGNOSTICOS DE AGUASCALIENTES');
insert into proveedores (razon_social) select 'INSTITUTO DE SERVICIOS DE SALUD DEL ESTADO DE AGUASCALIENTES' where not exists (select 1 from proveedores where razon_social='INSTITUTO DE SERVICIOS DE SALUD DEL ESTADO DE AGUASCALIENTES');
insert into proveedores (razon_social) select 'LABOPATH, S.A. DE C.V. (EN PARTICIPACION CON GRUPO LAPCIT)' where not exists (select 1 from proveedores where razon_social='LABOPATH, S.A. DE C.V. (EN PARTICIPACION CON GRUPO LAPCIT)');
insert into proveedores (razon_social) select 'LABORATORIO CLINICO PROFESIONAL Y BACTERIOLOGICO' where not exists (select 1 from proveedores where razon_social='LABORATORIO CLINICO PROFESIONAL Y BACTERIOLOGICO');
insert into proveedores (razon_social) select 'MEDICA SAN JUAN DE AGUASCALIENTES' where not exists (select 1 from proveedores where razon_social='MEDICA SAN JUAN DE AGUASCALIENTES');
insert into proveedores (razon_social) select 'PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.' where not exists (select 1 from proveedores where razon_social='PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.');
insert into proveedores (razon_social) select 'SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.' where not exists (select 1 from proveedores where razon_social='SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.');
insert into proveedores (razon_social) select 'UNIDAD MEDICA DEL PILAR, S.A. DE C.V.' where not exists (select 1 from proveedores where razon_social='UNIDAD MEDICA DEL PILAR, S.A. DE C.V.');

-- Contratos
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S5M0003', (select id from proveedores where razon_social='GABINETE DE ESTUDIOS DIAGNOSTICOS DE AGUASCALIENTES' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Servicio subrogado', '2025-01-01'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='S5M0003');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S5M0005', (select id from proveedores where razon_social='MEDICA SAN JUAN DE AGUASCALIENTES' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Servicio subrogado', '2025-01-01'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='S5M0005');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S5M0007', (select id from proveedores where razon_social='PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331001' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'PASIVO', '2025-01-01'::date, '2025-12-31'::date, 9277.68 where not exists (select 1 from contratos where numero_interno='S5M0007');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S5M0008', (select id from proveedores where razon_social='PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Servicio subrogado', '2025-01-01'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='S5M0008');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S5M0009', (select id from proveedores where razon_social='PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331005' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Cirugía de Cateterismos (31) Cirugía de Angio (32) Cirugía de Oftalmo (29)', '2025-01-01'::date, '2025-12-31'::date, 3058640 where not exists (select 1 from contratos where numero_interno='S5M0009');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S5M0010', (select id from proveedores where razon_social='SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Servicio subrogado', '2025-01-01'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='S5M0010');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S5M0022', (select id from proveedores where razon_social='LABORATORIO CLINICO PROFESIONAL Y BACTERIOLOGICO' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Servicio subrogado', '2025-01-01'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='S5M0022');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S5M0025', (select id from proveedores where razon_social='MEDICA SAN JUAN DE AGUASCALIENTES' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Servicio subrogado', '2025-01-01'::date, '2025-12-31'::date, null where not exists (select 1 from contratos where numero_interno='S5M0025');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S5M0081', (select id from proveedores where razon_social='CRUZ ROJA MEXICANA' limit 1), (select id from partidas where cuenta_finat='52411011' limit 1), 'NA', 'Gastos x traslado de pacientes', '2025-01-01'::date, '2025-12-31'::date, 50000 where not exists (select 1 from contratos where numero_interno='S5M0081');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0003', (select id from proveedores where razon_social='MEDICA SAN JUAN DE AGUASCALIENTES' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '1 PRUEBAS PSICOLOGIGAS Y 16 ELECTROENCEFALOGRAMAS', '2026-01-01'::date, '2026-02-28'::date, 185003 where not exists (select 1 from contratos where numero_interno='S6M0003');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0005', (select id from proveedores where razon_social='PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '2 TAC, RMN,  7 OFTALMO, 11 CPRES,  13 ENDOSCOPIAS, 19 CARDIOLOGIA', '2026-01-01'::date, '2026-02-28'::date, 2579465 where not exists (select 1 from contratos where numero_interno='S6M0005');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0010', (select id from proveedores where razon_social='PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331001' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '26 VALORACION OFTALMO  ENE FEB', '2026-01-01'::date, '2026-02-28'::date, 3333 where not exists (select 1 from contratos where numero_interno='S6M0010');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0015', (select id from proveedores where razon_social='UNIDAD MEDICA DEL PILAR, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '24 FLUOROSCOPIO', '2026-01-01'::date, '2026-02-28'::date, 51397 where not exists (select 1 from contratos where numero_interno='S6M0015');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0016', (select id from proveedores where razon_social='GABINETE DE ESTUDIOS DIAGNOSTICOS DE AGUASCALIENTES' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'PARTIDA 14 MEDICINA NUCLEAR', '2026-01-01'::date, '2026-02-28'::date, 684810 where not exists (select 1 from contratos where numero_interno='S6M0016');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0017', (select id from proveedores where razon_social='LABORATORIO CLINICO PROFESIONAL Y BACTERIOLOGICO' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '9 LABORATORIO', '2026-01-01'::date, '2026-02-28'::date, 175537 where not exists (select 1 from contratos where numero_interno='S6M0017');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0022', (select id from proveedores where razon_social='AUTOBUSES DE LA PIEDAD, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='52411011' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Gastos x traslado de pacientes', '2026-01-01'::date, '2026-02-28'::date, 1550000 where not exists (select 1 from contratos where numero_interno='S6M0022');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0030', (select id from proveedores where razon_social='AUTOBUSES DE LA PIEDAD, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='52411011' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Gastos x traslado de pacientes', '2026-03-01'::date, '2026-12-31'::date, 4650000 where not exists (select 1 from contratos where numero_interno='S6M0030');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0040', (select id from proveedores where razon_social='FISICA MEDICA FIMERA, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '15 DOSIMETRIA', '2026-03-01'::date, '2026-12-31'::date, 303500 where not exists (select 1 from contratos where numero_interno='S6M0040');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0041', (select id from proveedores where razon_social='LABOPATH, S.A. DE C.V. (EN PARTICIPACION CON GRUPO LAPCIT)' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '17 SERVICIO DE PATOLOGIA', '2026-03-01'::date, '2026-12-31'::date, 1201482 where not exists (select 1 from contratos where numero_interno='S6M0041');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0042', (select id from proveedores where razon_social='LABORATORIO CLINICO PROFESIONAL Y BACTERIOLOGICO' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '9 LABORATORIO', '2026-03-01'::date, '2026-12-31'::date, 877686 where not exists (select 1 from contratos where numero_interno='S6M0042');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0043', (select id from proveedores where razon_social='MEDICA SAN JUAN DE AGUASCALIENTES' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '1 PRUEBAS PSICOLOGIGAS Y 16 ELECTROENCEFALOGRAMAS', '2026-03-01'::date, '2026-12-31'::date, 925013 where not exists (select 1 from contratos where numero_interno='S6M0043');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0046', (select id from proveedores where razon_social='PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331001' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '26 VALORACION OFTALMO  MZO DIC', '2026-03-01'::date, '2026-03-31'::date, 16667 where not exists (select 1 from contratos where numero_interno='S6M0046');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0047', (select id from proveedores where razon_social='PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '2 TAC, RMN,  7 OFTALMO, 11 CPRES,  13 ENDOSCOPIAS, 19 CARDIOLOGIA', '2026-03-01'::date, '2026-12-31'::date, 17460008 where not exists (select 1 from contratos where numero_interno='S6M0047');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0048', (select id from proveedores where razon_social='PROMOTORA MEDICA AGUASCALIENTES, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331005' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', 'Servicio subrogado', '2026-03-01'::date, '2026-12-31'::date, 3450704 where not exists (select 1 from contratos where numero_interno='S6M0048');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0049', (select id from proveedores where razon_social='SERVICIOS DE INGENIERIA EN MEDICINA, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '10 APOYO MECÁNICO VENTILATORIO', '2026-03-01'::date, '2026-12-31'::date, 516567 where not exists (select 1 from contratos where numero_interno='S6M0049');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S6M0050', (select id from proveedores where razon_social='UNIDAD MEDICA DEL PILAR, S.A. DE C.V.' limit 1), (select id from partidas where cuenta_finat='51331003' limit 1), 'DRA. HILDA MÓNICA LOPEZ CERVANTES', '24 FLUOROSCOPIO', '2026-03-01'::date, '2026-12-31'::date, 256986 where not exists (select 1 from contratos where numero_interno='S6M0050');
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_maximo) select 'S7M0163', (select id from proveedores where razon_social='INSTITUTO DE SERVICIOS DE SALUD DEL ESTADO DE AGUASCALIENTES' limit 1), (select id from partidas where cuenta_finat='51331010' limit 1), 'Dr Victor iVan Garcia Godinez', 'Serv Del Acuerdo Gral De Inter De Serv', '2026-01-01'::date, '2026-12-31'::date, 2798396 where not exists (select 1 from contratos where numero_interno='S7M0163');

-- Facturas
insert into facturas (folio_ingreso, folio_proveedor, capitulo_id, partida_id, contrato_id, proveedor_id, periodo_inicio, periodo_fin, mes_asignado, anio_asignado, tasa_iva, importe_factura, estatus_general, estatus_firmas, estatus_pedido_recepcion, es_pasivo, cr_contrarecibo)
select v.folio_ingreso, v.folio_proveedor, pa.capitulo_id, c.partida_id, c.id, c.proveedor_id, v.periodo_inicio::date, v.periodo_fin::date, v.mes_asig, v.anio_asig, 0.16, v.importe, v.gen::estatus_general, v.fir::estatus_firmas, v.ped::estatus_pedido_recepcion, v.es_pasivo, v.cr
from (values
  ('HGZ2-SS-HIST-0001', 'AGS/2026/00134', 'S5M0081', '2025-02-01', '2025-02-28', 6, 2026, 1500, 'en_revision', 'pendiente', 'generado', true, '458198'),
  ('HGZ2-SS-HIST-0002', 'AGS/2026/00135', 'S5M0081', '2025-02-01', '2025-02-28', 6, 2026, 2000, 'en_revision', 'pendiente', 'generado', true, '458197'),
  ('HGZ2-SS-HIST-0003', 'AGS/2026/00136', 'S5M0081', '2025-02-01', '2025-02-28', 6, 2026, 8810, 'en_revision', 'pendiente', 'generado', true, '458189'),
  ('HGZ2-SS-HIST-0004', 'AGS/2026/00137', 'S5M0081', '2025-02-01', '2025-02-28', 6, 2026, 8810, 'en_revision', 'pendiente', 'generado', true, '458188'),
  ('HGZ2-SS-HIST-0005', 'AGS/2026/00138', 'S5M0081', '2025-02-01', '2025-02-28', 6, 2026, 1500, 'en_revision', 'pendiente', 'generado', true, '458187'),
  ('HGZ2-SS-HIST-0006', 'AGS/2026/00139', 'S5M0081', '2025-02-01', '2025-02-28', 6, 2026, 8810, 'en_revision', 'pendiente', 'generado', true, '458186'),
  ('HGZ2-SS-HIST-0007', 'AGS/2026/00172', 'S5M0081', '2025-02-01', '2025-02-28', 6, 2026, 2000, 'en_revision', 'pendiente', 'generado', true, '458185'),
  ('HGZ2-SS-HIST-0008', 'AGS/2026/00140', 'S5M0081', '2025-01-01', '2025-01-31', 6, 2026, 4789, 'en_revision', 'pendiente', 'generado', true, '458211'),
  ('HGZ2-SS-HIST-0009', 'AGS/2026/00141', 'S5M0081', '2025-01-01', '2025-01-31', 6, 2026, 2000, 'en_revision', 'pendiente', 'generado', true, '458209'),
  ('HGZ2-SS-HIST-0010', 'AGS/2026/00142', 'S5M0081', '2025-02-01', '2025-02-28', 6, 2026, 2000, 'en_revision', 'pendiente', 'generado', true, '458207'),
  ('HGZ2-SS-HIST-0011', 'AGS/2026/00243', 'S5M0081', '2025-01-01', '2025-01-31', 6, 2026, 7780, 'en_revision', 'pendiente', 'pendiente', true, null),
  ('HGZ2-SS-HIST-0012', 'PCXCFA 67679', 'S6M0022', '2026-01-01', '2026-01-31', 1, 2026, 47284.8, 'en_revision', 'pendiente', 'generado', false, '456849'),
  ('HGZ2-SS-HIST-0013', 'PCXCFA 67682', 'S6M0022', '2026-01-01', '2026-01-31', 1, 2026, 49995.81, 'en_revision', 'pendiente', 'generado', false, '456850'),
  ('HGZ2-SS-HIST-0014', 'PCXCFA 67685', 'S6M0022', '2026-01-01', '2026-01-31', 1, 2026, 44565.67, 'en_revision', 'pendiente', 'generado', false, '456845'),
  ('HGZ2-SS-HIST-0015', 'PCXCFA 67697', 'S6M0022', '2026-01-01', '2026-01-31', 1, 2026, 68284.73, 'en_revision', 'pendiente', 'generado', false, '456851'),
  ('HGZ2-SS-HIST-0016', 'PCXCFA 67901', 'S6M0022', '2026-02-01', '2026-02-28', 2, 2026, 48404.62, 'en_revision', 'pendiente', 'generado', false, '456852'),
  ('HGZ2-SS-HIST-0017', 'PCXCFA 68039', 'S6M0022', '2026-02-01', '2026-02-28', 2, 2026, 64662.03, 'en_revision', 'pendiente', 'generado', false, '456848'),
  ('HGZ2-SS-HIST-0018', 'PCXCFA 68253', 'S6M0022', '2026-02-01', '2026-02-28', 2, 2026, 54590.96, 'en_revision', 'pendiente', 'generado', false, '456846'),
  ('HGZ2-SS-HIST-0019', 'SCXCFA 33723', 'S6M0022', '2026-02-01', '2026-02-28', 2, 2026, 36233.554, 'en_revision', 'pendiente', 'generado', false, '456844'),
  ('HGZ2-SS-HIST-0020', 'SCXCFA 33838', 'S6M0030', '2026-03-01', '2026-03-31', 3, 2026, 64924.81, 'en_revision', 'pendiente', 'generado', false, '459365'),
  ('HGZ2-SS-HIST-0021', 'SCXCFA 34125', 'S6M0030', '2026-03-01', '2026-03-31', 3, 2026, 61074.22, 'en_revision', 'pendiente', 'generado', false, '459366'),
  ('HGZ2-SS-HIST-0022', 'SCXCFA 34354', 'S6M0030', '2026-03-01', '2026-03-31', 3, 2026, 36543.4, 'en_revision', 'pendiente', 'generado', false, '459367'),
  ('HGZ2-SS-HIST-0023', 'SCXCFA 34696', 'S6M0030', '2026-03-01', '2026-03-31', 3, 2026, 70421.15, 'en_revision', 'pendiente', 'generado', false, '459616'),
  ('HGZ2-SS-HIST-0024', 'SCXCFA 35068', 'S6M0030', '2026-04-01', '2026-04-30', 4, 2026, 71536.44, 'en_revision', 'pendiente', 'generado', false, '460328'),
  ('HGZ2-SS-HIST-0025', 'SCXCFA 35487', 'S6M0030', '2026-04-01', '2026-04-30', 4, 2026, 57011.97, 'en_revision', 'pendiente', 'generado', false, '461467'),
  ('HGZ2-SS-HIST-0026', 'SCXCFA 35631', 'S6M0030', '2026-04-01', '2026-04-30', 4, 2026, 56134.9, 'en_revision', 'pendiente', 'generado', false, '461467'),
  ('HGZ2-SS-HIST-0027', 'SCXCFA 35717', 'S6M0030', '2026-04-01', '2026-04-30', 4, 2026, 42881.94, 'en_revision', 'pendiente', 'generado', false, '463194'),
  ('HGZ2-SS-HIST-0028', 'SCXCFA 36116', 'S6M0030', '2026-05-01', '2026-05-31', 5, 2026, 58488.441199999994, 'en_revision', 'pendiente', 'generado', false, '463849'),
  ('HGZ2-SS-HIST-0029', 'SCXCFA 36309', 'S6M0030', '2026-05-01', '2026-05-31', 5, 2026, 57348.00459999999, 'en_revision', 'pendiente', 'generado', false, '463849'),
  ('HGZ2-SS-HIST-0030', 'SCXCFA 36543', 'S6M0030', '2026-05-01', '2026-05-31', 5, 2026, 63637.82619999999, 'en_revision', 'pendiente', 'generado', false, '464370'),
  ('HGZ2-SS-HIST-0031', 'SCXCFA 36793', 'S6M0030', '2026-05-01', '2026-05-31', 5, 2026, 59410.00899999999, 'en_revision', 'pendiente', 'generado', false, '465521'),
  ('HGZ2-SS-HIST-0032', 'SCXCFA 37042', 'S6M0030', '2026-06-01', '2026-06-30', 6, 2026, 57620.18, 'en_revision', 'pendiente', 'generado', false, '465678'),
  ('HGZ2-SS-HIST-0033', 'PCXCFA 68558', 'S6M0030', '2026-06-01', '2026-06-30', 6, 2026, 56812.44999999999, 'en_revision', 'pendiente', 'generado', false, '466264'),
  ('HGZ2-SS-HIST-0034', 'SCXCFA 37631', 'S6M0030', '2026-06-01', '2026-06-30', 6, 2026, 63567.269199999995, 'en_revision', 'pendiente', 'generado', false, '468986'),
  ('HGZ2-SS-HIST-0035', 'SCXCFA 37801', 'S6M0030', '2026-06-01', '2026-06-30', 6, 2026, 86349.42, 'en_revision', 'pendiente', 'generado', false, '468986'),
  ('HGZ2-SS-HIST-0036', 'SCXCFA 38350', 'S6M0030', '2026-07-01', '2026-07-31', 7, 2026, 73342.62, 'en_revision', 'pendiente', 'generado', false, '468987'),
  ('HGZ2-SS-HIST-0037', 'SCXCFA 38440', 'S6M0030', '2026-07-01', '2026-07-31', 7, 2026, 50141.18, 'en_revision', 'pendiente', 'generado', false, '468987'),
  ('HGZ2-SS-HIST-0038', 'SCXCFA 38708', 'S6M0030', '2026-07-01', '2026-07-31', 7, 2026, 3.081, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0039', 'SCXCFA 38973', 'S6M0030', '2026-07-01', '2026-07-31', 7, 2026, 11.08, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0040', 'SCXCFA 39188', 'S6M0030', '2026-08-01', '2026-08-31', 8, 2026, 1308, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0041', 'B85087', 'S5M0007', '2025-01-01', '2025-01-31', 6, 2026, 9277.68, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461298'),
  ('HGZ2-SS-HIST-0042', 'B85209', 'S6M0010', '2026-01-01', '2026-01-31', 1, 2026, 4638.84, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '453845'),
  ('HGZ2-SS-HIST-0043', '85520', 'S6M0046', '2026-04-01', '2026-04-30', 4, 2026, 5798.84, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '464760'),
  ('HGZ2-SS-HIST-0044', '86046', 'S6M0046', '2026-07-01', '2026-07-31', 7, 2026, 5798.84, 'en_revision', 'envio_firmas_servicio', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0045', 'MN3241', 'S5M0003', '2025-01-01', '2025-01-31', 3, 2026, 23200, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '455979'),
  ('HGZ2-SS-HIST-0046', '33002687', 'S5M0010', '2025-12-01', '2025-12-31', 3, 2026, 6463.52, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461311'),
  ('HGZ2-SS-HIST-0047', '33002688', 'S5M0010', '2025-12-01', '2025-12-31', 3, 2026, 1160, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461296'),
  ('HGZ2-SS-HIST-0048', '33002703', 'S5M0010', '2025-01-01', '2025-01-31', 3, 2026, 1615.88, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '455968'),
  ('HGZ2-SS-HIST-0049', '4018', 'S5M0022', '2025-01-01', '2025-01-31', 4, 2026, 22556.2, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461304'),
  ('HGZ2-SS-HIST-0050', '4017', 'S5M0022', '2025-01-01', '2025-01-31', 4, 2026, 6003, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461304'),
  ('HGZ2-SS-HIST-0051', '85084', 'S5M0008', '2025-01-01', '2025-01-31', 6, 2026, 165416, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461307'),
  ('HGZ2-SS-HIST-0052', '85086', 'S5M0008', '2025-01-01', '2025-01-31', 6, 2026, 245050, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461307'),
  ('HGZ2-SS-HIST-0053', '85085', 'S5M0008', '2025-01-01', '2025-01-31', 6, 2026, 221433.56, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461307'),
  ('HGZ2-SS-HIST-0054', '2258', 'S5M0025', '2025-01-01', '2025-01-31', 5, 2026, 4988, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460429'),
  ('HGZ2-SS-HIST-0055', '2257', 'S5M0005', '2025-01-01', '2025-01-31', 5, 2026, 17284, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '460426'),
  ('HGZ2-SS-HIST-0056', '85153', 'S6M0005', '2026-01-01', '2026-01-31', 1, 2026, 83520, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '453691'),
  ('HGZ2-SS-HIST-0057', '85152', 'S6M0005', '2026-01-01', '2026-01-31', 1, 2026, 224576, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '454216'),
  ('HGZ2-SS-HIST-0058', '85154', 'S6M0005', '2026-01-01', '2026-01-31', 1, 2026, 159906, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '454217'),
  ('HGZ2-SS-HIST-0059', '85208', 'S6M0005', '2026-01-01', '2026-01-31', 1, 2026, 216995.4, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '453846'),
  ('HGZ2-SS-HIST-0060', '85205', 'S6M0005', '2026-01-01', '2026-01-31', 1, 2026, 60262, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '454219'),
  ('HGZ2-SS-HIST-0061', '85206', 'S6M0005', '2026-01-01', '2026-01-31', 1, 2026, 21344, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '454218'),
  ('HGZ2-SS-HIST-0062', '85253', 'S6M0005', '2026-02-01', '2026-02-28', 2, 2026, 147320, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '455976'),
  ('HGZ2-SS-HIST-0063', '85255', 'S6M0005', '2026-02-01', '2026-02-28', 2, 2026, 211584, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '455975'),
  ('HGZ2-SS-HIST-0064', '85287', 'S6M0005', '2026-02-01', '2026-02-28', 2, 2026, 62640, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '455977'),
  ('HGZ2-SS-HIST-0065', '85286', 'S6M0005', '2026-02-01', '2026-02-28', 2, 2026, 75975.36, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '455980'),
  ('HGZ2-SS-HIST-0066', '85364', 'S6M0005', '2026-02-01', '2026-02-28', 2, 2026, 44566.04, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '456145'),
  ('HGZ2-SS-HIST-0067', '85366', 'S6M0005', '2026-02-01', '2026-02-28', 2, 2026, 25056, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '456145'),
  ('HGZ2-SS-HIST-0068', '85367', 'S6M0005', '2026-02-01', '2026-02-28', 2, 2026, 59566, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '456145'),
  ('HGZ2-SS-HIST-0069', '85398', 'S6M0047', '2026-03-01', '2026-03-31', 3, 2026, 44080, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '459938'),
  ('HGZ2-SS-HIST-0070', '85416', 'S6M0047', '2026-03-01', '2026-03-31', 3, 2026, 85967.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '459938'),
  ('HGZ2-SS-HIST-0071', '85395', 'S6M0047', '2026-03-01', '2026-03-31', 3, 2026, 36540, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '457458'),
  ('HGZ2-SS-HIST-0072', '85396', 'S6M0047', '2026-03-01', '2026-03-31', 3, 2026, 90074, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '457458'),
  ('HGZ2-SS-HIST-0073', '85397', 'S6M0047', '2026-03-01', '2026-03-31', 3, 2026, 144768, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '457458'),
  ('HGZ2-SS-HIST-0074', '85507', 'S6M0047', '2026-03-01', '2026-03-31', 3, 2026, 97208, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '460447'),
  ('HGZ2-SS-HIST-0075', '85508', 'S6M0047', '2026-03-01', '2026-03-31', 3, 2026, 187746, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '460447'),
  ('HGZ2-SS-HIST-0076', '85522', 'S6M0047', '2026-03-01', '2026-03-31', 3, 2026, 12760, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '460447'),
  ('HGZ2-SS-HIST-0077', '85510', 'S6M0047', '2026-03-01', '2026-03-31', 3, 2026, 66120, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '460581'),
  ('HGZ2-SS-HIST-0078', '85563', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 182584, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462307'),
  ('HGZ2-SS-HIST-0079', '85564', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 110200, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462307'),
  ('HGZ2-SS-HIST-0080', '85565', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 31262, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462307'),
  ('HGZ2-SS-HIST-0081', '85566', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 13340, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462307'),
  ('HGZ2-SS-HIST-0082', '85581', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 217556.84, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462307'),
  ('HGZ2-SS-HIST-0083', '85657', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 154048, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '464383'),
  ('HGZ2-SS-HIST-0084', '85659', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 88160, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '464383'),
  ('HGZ2-SS-HIST-0085', '85658', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 20880, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '464383'),
  ('HGZ2-SS-HIST-0086', '85590', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 87532.44, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '464378'),
  ('HGZ2-SS-HIST-0087', '85656', 'S6M0047', '2026-04-01', '2026-04-30', 4, 2026, 129804, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '464383'),
  ('HGZ2-SS-HIST-0088', '85735', 'S6M0047', '2026-05-01', '2026-05-31', 5, 2026, 136300, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465522'),
  ('HGZ2-SS-HIST-0089', '85736', 'S6M0047', '2026-05-01', '2026-05-31', 5, 2026, 69600, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466124'),
  ('HGZ2-SS-HIST-0090', '85737', 'S6M0047', '2026-05-01', '2026-05-31', 5, 2026, 175856, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465522'),
  ('HGZ2-SS-HIST-0091', '85738', 'S6M0047', '2026-05-01', '2026-05-31', 5, 2026, 185848.24, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465481'),
  ('HGZ2-SS-HIST-0092', '85739', 'S6M0047', '2026-05-01', '2026-05-31', 5, 2026, 110200, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465480'),
  ('HGZ2-SS-HIST-0093', '85850', 'S6M0047', '2026-05-01', '2026-05-31', 5, 2026, 219704, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466120'),
  ('HGZ2-SS-HIST-0094', '85853', 'S6M0047', '2026-05-01', '2026-05-31', 5, 2026, 351016, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466120'),
  ('HGZ2-SS-HIST-0095', '85854', 'S6M0047', '2026-05-01', '2026-05-31', 5, 2026, 90480, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466120'),
  ('HGZ2-SS-HIST-0096', '85855', 'S6M0047', '2026-05-01', '2026-05-31', 5, 2026, 8630.4, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467789'),
  ('HGZ2-SS-HIST-0097', '85856', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 44080, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465523'),
  ('HGZ2-SS-HIST-0098', '85857', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 203354.96, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466124'),
  ('HGZ2-SS-HIST-0099', '85878', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 68498, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466126'),
  ('HGZ2-SS-HIST-0100', '85880', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 102080, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467163'),
  ('HGZ2-SS-HIST-0101', '85881', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 44080, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466126'),
  ('HGZ2-SS-HIST-0102', '85879', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 92800, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467940'),
  ('HGZ2-SS-HIST-0103', '85896', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 79228, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467951'),
  ('HGZ2-SS-HIST-0104', '85903', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 20880, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467970'),
  ('HGZ2-SS-HIST-0105', '85904', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 117856, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467968'),
  ('HGZ2-SS-HIST-0106', '85905', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 22040, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467054'),
  ('HGZ2-SS-HIST-0107', '85906', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 122891.56, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467163'),
  ('HGZ2-SS-HIST-0108', '85907', 'S6M0047', '2026-06-01', '2026-06-30', 6, 2026, 22446, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467956'),
  ('HGZ2-SS-HIST-0109', '85998', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 200216, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '468975'),
  ('HGZ2-SS-HIST-0110', '85999', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 300672, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '469666'),
  ('HGZ2-SS-HIST-0111', '86000', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 198940, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '468973'),
  ('HGZ2-SS-HIST-0112', '86001', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 85260, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '468975'),
  ('HGZ2-SS-HIST-0113', '86003', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 7551.6, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', false, null),
  ('HGZ2-SS-HIST-0114', '86004', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 194482.12, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '469666'),
  ('HGZ2-SS-HIST-0115', '86041', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 198592, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', false, null),
  ('HGZ2-SS-HIST-0116', '86042', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 162806, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', false, null),
  ('HGZ2-SS-HIST-0117', '86043', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 34800, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', false, null),
  ('HGZ2-SS-HIST-0118', '86044', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 105212, 'en_revision', 'envio_firmas_servicio', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0119', '86049', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 25351.8, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', false, null),
  ('HGZ2-SS-HIST-0120', '86050', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 77716.52, 'en_revision', 'envio_firmas_servicio', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0121', '86117', 'S6M0047', '2026-07-01', '2026-07-31', 7, 2026, 211060.84, 'en_revision', 'envio_firmas_servicio', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0122', 'A1753/A1719', 'S6M0015', '2026-01-01', '2026-01-31', 1, 2026, 48691, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '459383'),
  ('HGZ2-SS-HIST-0123', '1775', 'S6M0050', '2026-03-01', '2026-03-31', 3, 2026, 77905.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465520'),
  ('HGZ2-SS-HIST-0124', '1787', 'S6M0050', '2026-03-01', '2026-03-31', 3, 2026, 29214.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465450'),
  ('HGZ2-SS-HIST-0125', '1824', 'S6M0050', '2026-03-01', '2026-03-31', 3, 2026, 58429.2, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '469665'),
  ('HGZ2-SS-HIST-0126', '1847', 'S6M0050', '2026-03-01', '2026-03-31', 3, 2026, 58429.2, 'capturada', 'pendiente', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0127', '4053', 'S6M0017', '2026-01-01', '2026-01-31', 1, 2026, 19325.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '454214'),
  ('HGZ2-SS-HIST-0128', '4052', 'S6M0017', '2026-01-01', '2026-01-31', 1, 2026, 24818.2, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '454214'),
  ('HGZ2-SS-HIST-0129', '4111', 'S6M0042', '2026-03-01', '2026-03-31', 3, 2026, 43906, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '460308'),
  ('HGZ2-SS-HIST-0130', '4121', 'S6M0042', '2026-03-01', '2026-03-31', 3, 2026, 63574.96, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '459396'),
  ('HGZ2-SS-HIST-0131', '4160', 'S6M0042', '2026-04-01', '2026-04-30', 4, 2026, 54810, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '464382'),
  ('HGZ2-SS-HIST-0132', '4181', 'S6M0042', '2026-04-01', '2026-04-30', 4, 2026, 21112, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '463195'),
  ('HGZ2-SS-HIST-0133', '4202', 'S6M0042', '2026-05-01', '2026-05-31', 5, 2026, 44428, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465452'),
  ('HGZ2-SS-HIST-0134', '4228', 'S6M0042', '2026-06-01', '2026-06-30', 6, 2026, 52026, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467794'),
  ('HGZ2-SS-HIST-0135', '3250', 'S6M0016', '2026-01-01', '2026-01-31', 1, 2026, 108460, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '456003'),
  ('HGZ2-SS-HIST-0136', '3251', 'S6M0016', '2026-02-01', '2026-02-28', 2, 2026, 18206.660000000003, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '456015'),
  ('HGZ2-SS-HIST-0137', '2519', 'S6M0003', '2026-01-01', '2026-01-31', 1, 2026, 17208.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462661'),
  ('HGZ2-SS-HIST-0138', '2521', 'S6M0003', '2026-01-01', '2026-01-31', 1, 2026, 17208.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462661'),
  ('HGZ2-SS-HIST-0139', '2522', 'S6M0003', '2026-01-01', '2026-01-31', 1, 2026, 7835.14, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462946'),
  ('HGZ2-SS-HIST-0140', '2525', 'S6M0003', '2026-02-01', '2026-02-28', 2, 2026, 17208.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '456137'),
  ('HGZ2-SS-HIST-0141', '2569', 'S6M0003', '2026-02-01', '2026-02-28', 2, 2026, 11472.4, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '456137'),
  ('HGZ2-SS-HIST-0142', '2842', 'S6M0043', '2026-03-01', '2026-03-31', 3, 2026, 15341, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '463200'),
  ('HGZ2-SS-HIST-0143', '2843', 'S6M0043', '2026-03-01', '2026-03-31', 3, 2026, 15341, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '463200'),
  ('HGZ2-SS-HIST-0144', '2946', 'S6M0043', '2026-03-01', '2026-03-31', 3, 2026, 15341, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462554'),
  ('HGZ2-SS-HIST-0145', '2947', 'S6M0043', '2026-04-01', '2026-04-30', 4, 2026, 9204.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462554'),
  ('HGZ2-SS-HIST-0146', '2952', 'S6M0043', '2026-04-01', '2026-04-30', 4, 2026, 15341, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462557'),
  ('HGZ2-SS-HIST-0147', '2953', 'S6M0043', '2026-04-01', '2026-04-30', 4, 2026, 6136.4, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462557'),
  ('HGZ2-SS-HIST-0148', '3105', 'S6M0043', '2026-05-01', '2026-05-31', 5, 2026, 18409.2, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466265'),
  ('HGZ2-SS-HIST-0149', '3126', 'S6M0043', '2026-05-01', '2026-05-31', 5, 2026, 15341, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466265'),
  ('HGZ2-SS-HIST-0150', '3173', 'S6M0043', '2026-05-01', '2026-05-31', 5, 2026, 12272.8, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465741'),
  ('HGZ2-SS-HIST-0151', '3174', 'S6M0043', '2026-05-01', '2026-05-31', 5, 2026, 15341, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465741'),
  ('HGZ2-SS-HIST-0152', '3175', 'S6M0043', '2026-05-01', '2026-05-31', 5, 2026, 15341, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '465741'),
  ('HGZ2-SS-HIST-0153', '3244', 'S6M0043', '2026-05-01', '2026-05-31', 5, 2026, 9204.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467960'),
  ('HGZ2-SS-HIST-0154', '3249', 'S6M0043', '2026-06-01', '2026-06-30', 6, 2026, 3068.2, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467960'),
  ('HGZ2-SS-HIST-0155', '3258', 'S6M0043', '2026-06-01', '2026-06-30', 6, 2026, 9482.07, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467960'),
  ('HGZ2-SS-HIST-0156', '3259', 'S6M0043', '2026-06-01', '2026-06-30', 6, 2026, 9204.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467960'),
  ('HGZ2-SS-HIST-0157', '3451', 'S6M0043', '2026-07-01', '2026-07-31', 7, 2026, 15341, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '469757'),
  ('HGZ2-SS-HIST-0158', '3559', 'S6M0043', '2026-07-01', '2026-07-31', 7, 2026, 15341, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', false, null),
  ('HGZ2-SS-HIST-0159', '3560', 'S6M0043', '2026-07-01', '2026-07-31', 7, 2026, 15341, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', false, null),
  ('HGZ2-SS-HIST-0160', '3561', 'S6M0043', '2026-07-01', '2026-07-31', 7, 2026, 6136.4, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', false, null),
  ('HGZ2-SS-HIST-0161', '12873', 'S6M0040', '2026-03-01', '2026-03-31', 3, 2026, 6252.4, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462551'),
  ('HGZ2-SS-HIST-0162', '13046', 'S6M0040', '2026-04-01', '2026-04-30', 4, 2026, 7145.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462548'),
  ('HGZ2-SS-HIST-0163', '13217', 'S6M0040', '2026-05-01', '2026-05-31', 5, 2026, 7145.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '466267'),
  ('HGZ2-SS-HIST-0164', '13460', 'S6M0040', '2026-06-01', '2026-06-30', 6, 2026, 7145.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '469664'),
  ('HGZ2-SS-HIST-0165', '13775', 'S6M0040', '2026-07-01', '2026-07-31', 7, 2026, 7145.6, 'capturada', 'pendiente', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0166', '1216', 'S6M0041', '2026-03-01', '2026-03-31', 3, 2026, 1216, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', false, null),
  ('HGZ2-SS-HIST-0167', '1249', 'S6M0041', '2026-04-01', '2026-04-30', 4, 2026, 1249, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', false, null),
  ('HGZ2-SS-HIST-0168', '33002830', 'S6M0049', '2026-03-01', '2026-03-31', 3, 2026, 1696.67, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467796'),
  ('HGZ2-SS-HIST-0169', '33002832', 'S6M0049', '2026-03-01', '2026-03-31', 3, 2026, 1218, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467798'),
  ('HGZ2-SS-HIST-0170', '33002833', 'S6M0049', '2026-03-01', '2026-03-31', 3, 2026, 1218, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467798'),
  ('HGZ2-SS-HIST-0171', '33002834', 'S6M0049', '2026-05-01', '2026-05-31', 5, 2026, 1696.67, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467801'),
  ('HGZ2-SS-HIST-0172', '33002835', 'S6M0049', '2026-05-01', '2026-05-31', 5, 2026, 1696.67, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467801'),
  ('HGZ2-SS-HIST-0173', '33002836', 'S6M0049', '2026-04-01', '2026-04-30', 4, 2026, 1218, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467811'),
  ('HGZ2-SS-HIST-0174', '33002837', 'S6M0049', '2026-04-01', '2026-04-30', 4, 2026, 1696.67, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '467811'),
  ('HGZ2-SS-HIST-0175', 'B85088', 'S5M0009', '2025-01-01', '2025-01-31', 6, 2026, 92800, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461301'),
  ('HGZ2-SS-HIST-0176', '85369', 'S6M0005', '2026-02-01', '2026-02-28', 2, 2026, 89700.83, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '461372'),
  ('HGZ2-SS-HIST-0177', '85368', 'S6M0005', '2026-02-01', '2026-02-28', 2, 2026, 33640, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '461372'),
  ('HGZ2-SS-HIST-0178', '85521', 'S6M0048', '2026-04-01', '2026-04-30', 4, 2026, 35148, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462358'),
  ('HGZ2-SS-HIST-0179', '85572', 'S6M0048', '2026-04-01', '2026-04-30', 4, 2026, 87754, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462358'),
  ('HGZ2-SS-HIST-0180', '85580', 'S6M0048', '2026-04-01', '2026-04-30', 4, 2026, 115570.8, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '464766'),
  ('HGZ2-SS-HIST-0181', '86045', 'S6M0048', '2026-07-01', '2026-07-31', 7, 2026, 40598.84, 'capturada', 'pendiente', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0182', '86047', 'S6M0048', '2026-07-01', '2026-07-31', 7, 2026, 87754, 'capturada', 'pendiente', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0183', '86048', 'S6M0048', '2026-07-01', '2026-07-31', 7, 2026, 115570.8, 'capturada', 'pendiente', 'pendiente', false, null),
  ('HGZ2-SS-HIST-0184', 'IS524', 'S7M0163', '2025-10-01', '2025-10-31', 6, 2026, 216341, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', true, null),
  ('HGZ2-SS-HIST-0185', 'IS531', 'S7M0163', '2025-11-01', '2025-11-30', 6, 2026, 135081, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', true, null),
  ('HGZ2-SS-HIST-0186', 'IM555', 'S7M0163', '2025-12-01', '2025-12-31', 6, 2026, 109677, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', true, null),
  ('HGZ2-SS-HIST-0187', 'SPHM110', 'S7M0163', '2025-12-01', '2025-12-31', 6, 2026, 27276, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', true, null),
  ('HGZ2-SS-HIST-0188', 'IS560', 'S7M0163', '2025-12-01', '2025-12-31', 6, 2026, 140910, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', true, null),
  ('HGZ2-SS-HIST-0189', 'SPHM116', 'S7M0163', '2025-01-01', '2025-01-31', 6, 2026, 13638, 'en_tramite_ooad', 'autorizada_admin_contrato', 'generado', true, null),
  ('HGZ2-SS-HIST-0190', 'SP 1670', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 10752, 'capturada', 'pendiente', 'generado', true, '468151'),
  ('HGZ2-SS-HIST-0191', 'SP 1671', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 707, 'capturada', 'pendiente', 'pendiente', true, null),
  ('HGZ2-SS-HIST-0192', 'SP 1672', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 8960, 'capturada', 'pendiente', 'generado', true, '468122'),
  ('HGZ2-SS-HIST-0193', 'SP 1673', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 707, 'capturada', 'pendiente', 'pendiente', true, null),
  ('HGZ2-SS-HIST-0194', 'SP 1674', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 7168, 'capturada', 'pendiente', 'generado', true, '468119'),
  ('HGZ2-SS-HIST-0195', 'SP 1675', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 14336, 'capturada', 'pendiente', 'generado', true, '468117'),
  ('HGZ2-SS-HIST-0196', 'SP 1676', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 12544, 'capturada', 'pendiente', 'generado', true, '468152'),
  ('HGZ2-SS-HIST-0197', 'SP 1677', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 7168, 'capturada', 'pendiente', 'generado', true, '468152'),
  ('HGZ2-SS-HIST-0198', 'SP 1678', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 14336, 'capturada', 'pendiente', 'generado', true, '468152'),
  ('HGZ2-SS-HIST-0199', 'SP 1679', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 14336, 'capturada', 'pendiente', 'generado', true, '468151'),
  ('HGZ2-SS-HIST-0200', 'SP 1680', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 11648, 'capturada', 'pendiente', 'generado', true, '468151'),
  ('HGZ2-SS-HIST-0201', 'SP 1681', 'S7M0163', '2025-04-01', '2025-04-30', 6, 2026, 7168, 'capturada', 'pendiente', 'generado', true, '468124')
) as v(folio_ingreso, folio_proveedor, contrato, periodo_inicio, periodo_fin, mes_asig, anio_asig, importe, gen, fir, ped, es_pasivo, cr)
join contratos c on c.numero_interno = v.contrato join partidas pa on pa.id = c.partida_id
where not exists (select 1 from facturas f where f.folio_proveedor = v.folio_proveedor and f.contrato_id = c.id);

alter table facturas enable trigger trg_a_historial;
alter table facturas enable trigger trg_b_auto_en_revision;
commit;