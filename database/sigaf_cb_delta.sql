-- SIGAF · Cuadro Básico DELTA (facturas nuevas al 2026-09-01). Idempotente. Solo agrega OCs nuevas.
begin;
alter table facturas disable trigger trg_a_historial;
alter table facturas disable trigger trg_b_auto_en_revision;

insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Cuadro Básico'), '51211010', 'Medicamentos 51211010' where not exists (select 1 from partidas where cuenta_finat='51211010');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Cuadro Básico'), '51251002', 'Medicamentos 51251002' where not exists (select 1 from partidas where cuenta_finat='51251002');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Cuadro Básico'), '51251005', 'Medicamentos 51251005' where not exists (select 1 from partidas where cuenta_finat='51251005');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Cuadro Básico'), '51251007', 'Medicamentos 51251007' where not exists (select 1 from partidas where cuenta_finat='51251007');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Cuadro Básico'), '51251017', 'Medicamentos 51251017' where not exists (select 1 from partidas where cuenta_finat='51251017');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Cuadro Básico'), '51251022', 'Medicamentos 51251022' where not exists (select 1 from partidas where cuenta_finat='51251022');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Cuadro Básico'), '51251024', 'Medicamentos 51251024' where not exists (select 1 from partidas where cuenta_finat='51251024');
insert into partidas (capitulo_id, cuenta_finat, nombre) select (select id from capitulos where nombre='Cuadro Básico'), '51291007', 'Medicamentos 51291007' where not exists (select 1 from partidas where cuenta_finat='51291007');
insert into proveedores (razon_social) select 'BEATRIZ IBARRA RODRIGUEZ' where not exists (select 1 from proveedores where razon_social='BEATRIZ IBARRA RODRIGUEZ');
insert into proveedores (razon_social) select 'COVAMEDIC DE OCCIDENTE' where not exists (select 1 from proveedores where razon_social='COVAMEDIC DE OCCIDENTE');
insert into proveedores (razon_social) select 'DIEGO OSVALDO CABRERA ROMERO' where not exists (select 1 from proveedores where razon_social='DIEGO OSVALDO CABRERA ROMERO');
insert into proveedores (razon_social) select 'FR MEDICAL SA DE CV' where not exists (select 1 from proveedores where razon_social='FR MEDICAL SA DE CV');
insert into proveedores (razon_social) select 'GALBENI PHARMA' where not exists (select 1 from proveedores where razon_social='GALBENI PHARMA');
insert into proveedores (razon_social) select 'GRUPO FARMACEUTICO JOCA' where not exists (select 1 from proveedores where razon_social='GRUPO FARMACEUTICO JOCA');
insert into proveedores (razon_social) select 'JOSE RAMIRO SANCHEZ TORRES' where not exists (select 1 from proveedores where razon_social='JOSE RAMIRO SANCHEZ TORRES');
insert into proveedores (razon_social) select 'MARTHA DELIA REYES RUIZ' where not exists (select 1 from proveedores where razon_social='MARTHA DELIA REYES RUIZ');
insert into proveedores (razon_social) select 'MHC CONSULTORA Y DISTRIBUCION MC MEDICAL' where not exists (select 1 from proveedores where razon_social='MHC CONSULTORA Y DISTRIBUCION MC MEDICAL');
insert into proveedores (razon_social) select 'OPERADORA MARTA S.A. DE C.V.' where not exists (select 1 from proveedores where razon_social='OPERADORA MARTA S.A. DE C.V.');
insert into proveedores (razon_social) select 'PROVEEDORA HOSPITALARIA DEL BAJIO' where not exists (select 1 from proveedores where razon_social='PROVEEDORA HOSPITALARIA DEL BAJIO');
insert into proveedores (razon_social) select 'SIRAMEDIC SA DE CV' where not exists (select 1 from proveedores where razon_social='SIRAMEDIC SA DE CV');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin) select 'CB-51211010', (select id from proveedores where razon_social='PROVEEDORES VARIOS (Cuadro Básico)' limit 1), (select id from partidas where cuenta_finat='51211010' limit 1), 'Cuadro Básico (compra por OC)', '2026-01-01'::date, '2026-12-31'::date where not exists (select 1 from contratos where numero_interno='CB-51211010');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin) select 'CB-51251002', (select id from proveedores where razon_social='PROVEEDORES VARIOS (Cuadro Básico)' limit 1), (select id from partidas where cuenta_finat='51251002' limit 1), 'Cuadro Básico (compra por OC)', '2026-01-01'::date, '2026-12-31'::date where not exists (select 1 from contratos where numero_interno='CB-51251002');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin) select 'CB-51251005', (select id from proveedores where razon_social='PROVEEDORES VARIOS (Cuadro Básico)' limit 1), (select id from partidas where cuenta_finat='51251005' limit 1), 'Cuadro Básico (compra por OC)', '2026-01-01'::date, '2026-12-31'::date where not exists (select 1 from contratos where numero_interno='CB-51251005');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin) select 'CB-51251007', (select id from proveedores where razon_social='PROVEEDORES VARIOS (Cuadro Básico)' limit 1), (select id from partidas where cuenta_finat='51251007' limit 1), 'Cuadro Básico (compra por OC)', '2026-01-01'::date, '2026-12-31'::date where not exists (select 1 from contratos where numero_interno='CB-51251007');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin) select 'CB-51251017', (select id from proveedores where razon_social='PROVEEDORES VARIOS (Cuadro Básico)' limit 1), (select id from partidas where cuenta_finat='51251017' limit 1), 'Cuadro Básico (compra por OC)', '2026-01-01'::date, '2026-12-31'::date where not exists (select 1 from contratos where numero_interno='CB-51251017');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin) select 'CB-51251022', (select id from proveedores where razon_social='PROVEEDORES VARIOS (Cuadro Básico)' limit 1), (select id from partidas where cuenta_finat='51251022' limit 1), 'Cuadro Básico (compra por OC)', '2026-01-01'::date, '2026-12-31'::date where not exists (select 1 from contratos where numero_interno='CB-51251022');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin) select 'CB-51251024', (select id from proveedores where razon_social='PROVEEDORES VARIOS (Cuadro Básico)' limit 1), (select id from partidas where cuenta_finat='51251024' limit 1), 'Cuadro Básico (compra por OC)', '2026-01-01'::date, '2026-12-31'::date where not exists (select 1 from contratos where numero_interno='CB-51251024');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin) select 'CB-51291007', (select id from proveedores where razon_social='PROVEEDORES VARIOS (Cuadro Básico)' limit 1), (select id from partidas where cuenta_finat='51291007' limit 1), 'Cuadro Básico (compra por OC)', '2026-01-01'::date, '2026-12-31'::date where not exists (select 1 from contratos where numero_interno='CB-51291007');

insert into facturas (folio_ingreso, folio_proveedor, capitulo_id, partida_id, contrato_id, proveedor_id, periodo_inicio, periodo_fin, mes_asignado, anio_asignado, tasa_iva, importe_factura, estatus_general, estatus_firmas, estatus_pedido_recepcion, es_pasivo, cr_contrarecibo)
select v.folio_ingreso, v.folio_proveedor, pa.capitulo_id, c.partida_id, c.id, prov.id, v.periodo_inicio::date, v.periodo_fin::date, v.mes_asig, v.anio_asig, 0.16, v.importe, v.gen::estatus_general, v.fir::estatus_firmas, v.ped::estatus_pedido_recepcion, v.es_pasivo, v.cr
from (values
  ('HGZ2-CB-R3-0001', 'B4508', 'CB-51251024', 'BEATRIZ IBARRA RODRIGUEZ', '2026-07-01', '2026-07-31', 7, 2026, 13933.92, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0002', 'B4535', 'CB-51251022', 'BEATRIZ IBARRA RODRIGUEZ', '2026-08-01', '2026-08-31', 8, 2026, 26830.8, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0003', 'B4536', 'CB-51251017', 'BEATRIZ IBARRA RODRIGUEZ', '2026-08-01', '2026-08-31', 8, 2026, 4517.04, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0004', 'B4537', 'CB-51251017', 'BEATRIZ IBARRA RODRIGUEZ', '2026-08-01', '2026-08-31', 8, 2026, 6890.4, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0005', 'B4538', 'CB-51251017', 'BEATRIZ IBARRA RODRIGUEZ', '2026-08-01', '2026-08-31', 8, 2026, 10556, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0006', 'B4539', 'CB-51251017', 'BEATRIZ IBARRA RODRIGUEZ', '2026-08-01', '2026-08-31', 8, 2026, 1542.8, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0007', '1324', 'CB-51251002', 'MHC CONSULTORA Y DISTRIBUCION MC MEDICAL', '2026-07-01', '2026-07-31', 7, 2026, 11865, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0008', '1410', 'CB-51251002', 'MHC CONSULTORA Y DISTRIBUCION MC MEDICAL', '2026-07-01', '2026-07-31', 7, 2026, 3450, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0009', '227', 'CB-51251002', 'COVAMEDIC DE OCCIDENTE', '2026-08-01', '2026-08-31', 8, 2026, 9490, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0010', 'FGP 31', 'CB-51251002', 'GALBENI PHARMA', '2026-08-01', '2026-08-31', 8, 2026, 19530, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0011', '3253', 'CB-51251002', 'DIEGO OSVALDO CABRERA ROMERO', '2026-08-01', '2026-08-31', 8, 2026, 1796, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0012', 'PH24261', 'CB-51251017', 'PROVEEDORA HOSPITALARIA DEL BAJIO', '2026-07-01', '2026-07-31', 7, 2026, 36192, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0013', 'PH24263', 'CB-51251017', 'PROVEEDORA HOSPITALARIA DEL BAJIO', '2026-07-01', '2026-07-31', 7, 2026, 5187.52, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0014', 'F2A 5014', 'CB-51251002', 'MARTHA DELIA REYES RUIZ', '2026-07-01', '2026-07-31', 7, 2026, 3040, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0015', 'A 1155', 'CB-51211010', 'SIRAMEDIC SA DE CV', '2026-07-01', '2026-07-31', 7, 2026, 24882, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0016', '204', 'CB-51251007', 'GRUPO FARMACEUTICO JOCA', '2026-07-01', '2026-07-31', 7, 2026, 615, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0017', 'B4439', 'CB-51291007', 'BEATRIZ IBARRA RODRIGUEZ', '2026-07-01', '2026-07-31', 7, 2026, 4872, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0018', 'FV F 79', 'CB-51251002', 'JOSE RAMIRO SANCHEZ TORRES', '2026-07-01', '2026-07-31', 7, 2026, 34800, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0019', '27272', 'CB-51251005', 'OPERADORA MARTA S.A. DE C.V.', '2026-07-01', '2026-07-31', 7, 2026, 7750, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0020', '27273', 'CB-51251005', 'OPERADORA MARTA S.A. DE C.V.', '2026-07-01', '2026-07-31', 7, 2026, 4750, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0021', 'F92149', 'CB-51251024', 'FR MEDICAL SA DE CV', '2026-06-01', '2026-06-30', 6, 2026, 29348, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0022', 'F92151', 'CB-51251022', 'FR MEDICAL SA DE CV', '2026-06-01', '2026-06-30', 6, 2026, 4872, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0023', 'F92554', 'CB-51251017', 'FR MEDICAL SA DE CV', '2026-06-01', '2026-06-30', 6, 2026, 15590.4, 'en_revision', 'pendiente', 'pendiente', false, null),
  ('HGZ2-CB-R3-0024', 'F92555', 'CB-51251017', 'FR MEDICAL SA DE CV', '2026-05-01', '2026-05-31', 5, 2026, 18165.6, 'en_revision', 'pendiente', 'pendiente', false, null)
) as v(folio_ingreso, folio_proveedor, contrato, proveedor, periodo_inicio, periodo_fin, mes_asig, anio_asig, importe, gen, fir, ped, es_pasivo, cr)
join contratos c on c.numero_interno = v.contrato
join partidas pa on pa.id = c.partida_id
join proveedores prov on prov.razon_social = v.proveedor
where not exists (select 1 from facturas f where f.folio_proveedor = v.folio_proveedor and f.contrato_id = c.id);

alter table facturas enable trigger trg_a_historial;
alter table facturas enable trigger trg_b_auto_en_revision;
commit;