-- =====================================================================
-- SIGAF · Lote 2 (parte 1) — 8 contratos Grupo C en cuentas existentes
-- 21 facturas (bloques 1,4,6,7,9). Idempotente.
-- =====================================================================
begin;
alter table facturas disable trigger trg_a_historial;
alter table facturas disable trigger trg_b_auto_en_revision;

-- 1) Alta de contratos (proveedor y partida heredados de contratos existentes)
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '988T00323-010', (select proveedor_id from contratos where numero_interno='050GYR032N13825-182-00' limit 1),
  (select partida_id from contratos where numero_interno='050GYR032N13825-182-00' limit 1),
  'Hemodiálisis intramuros', '2025-10-01'::date, '2025-12-31'::date, 'Alta provisional (Lote 2); vigencia derivada de facturas.'
where not exists (select 1 from contratos where numero_interno='988T00323-010');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '050GYR032N05725-092-00', (select proveedor_id from contratos where numero_interno='050GYR032N12326-005-00' limit 1),
  (select partida_id from contratos where numero_interno='050GYR032N12326-005-00' limit 1),
  'Digitalización e imagen', '2025-10-01'::date, '2026-01-31'::date, 'Alta provisional (Lote 2); vigencia derivada de facturas.'
where not exists (select 1 from contratos where numero_interno='050GYR032N05725-092-00');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '050GYR988T02124-001-00', (select proveedor_id from contratos where numero_interno='050GYR988T00925-001-00' limit 1),
  (select partida_id from contratos where numero_interno='050GYR988T00925-001-00' limit 1),
  'Soluciones', '2025-08-01'::date, '2025-11-30'::date, 'Alta provisional (Lote 2); vigencia derivada de facturas.'
where not exists (select 1 from contratos where numero_interno='050GYR988T02124-001-00');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '050GYR988T00425-001-00', (select proveedor_id from contratos where numero_interno='050GYR988T00925-001-00' limit 1),
  (select partida_id from contratos where numero_interno='050GYR988T00925-001-00' limit 1),
  'Soluciones', '2025-10-01'::date, '2025-12-31'::date, 'Alta provisional (Lote 2); vigencia derivada de facturas.'
where not exists (select 1 from contratos where numero_interno='050GYR988T00425-001-00');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '050GYR032N10125-109-00', (select proveedor_id from contratos where numero_interno='050GYR988T00925-001-00' limit 1),
  (select partida_id from contratos where numero_interno='050GYR988T00925-001-00' limit 1),
  'Soluciones', '2025-11-01'::date, '2025-12-31'::date, 'Alta provisional (Lote 2); vigencia derivada de facturas.'
where not exists (select 1 from contratos where numero_interno='050GYR032N10125-109-00');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '988T0823-036', (select proveedor_id from contratos where numero_interno='050GYR032N13625-179-00' limit 1),
  (select partida_id from contratos where numero_interno='050GYR032N13625-179-00' limit 1),
  'Banco de sangre', '2025-11-01'::date, '2025-12-31'::date, 'Alta provisional (Lote 2); vigencia derivada de facturas.'
where not exists (select 1 from contratos where numero_interno='988T0823-036');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '050GYR988N00125-001-00', (select proveedor_id from contratos where numero_interno='050GYR032N14425-188-00' limit 1),
  (select partida_id from contratos where numero_interno='050GYR032N14425-188-00' limit 1),
  'Mezclas', '2025-10-01'::date, '2025-12-31'::date, 'Alta provisional (Lote 2); vigencia derivada de facturas.'
where not exists (select 1 from contratos where numero_interno='050GYR988N00125-001-00');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '050GYR988T01924-001-00', (select proveedor_id from contratos where numero_interno='050GYR988T001025-022-00' limit 1),
  (select partida_id from contratos where numero_interno='050GYR988T00925-001-00' limit 1),
  'Soluciones', '2025-11-01'::date, '2025-12-31'::date, 'Alta provisional (Lote 2); vigencia derivada de facturas.'
where not exists (select 1 from contratos where numero_interno='050GYR988T01924-001-00');

-- 2) Facturas (idempotente; tipo casteado no aplica aquí -> tipo_entrega null)
insert into facturas
  (folio_ingreso, folio_proveedor, capitulo_id, partida_id, contrato_id, proveedor_id,
   periodo_inicio, periodo_fin, mes_asignado, anio_asignado, tasa_iva, importe_factura,
   estatus_general, estatus_firmas, estatus_pedido_recepcion, es_pasivo, cr_contrarecibo)
select v.folio_ingreso, v.folio_proveedor, pa.capitulo_id, c.partida_id, c.id, c.proveedor_id,
  v.periodo_inicio::date, v.periodo_fin::date, v.mes_asig, v.anio_asig, 0.16, v.importe,
  v.gen, v.fir, v.ped, v.es_pasivo, v.cr
from (values
  ('HGZ2-INT-HIST-099', 'EF572881', '050GYR988T00425-001-00', '2025-10-26', '2025-11-25', 3, 2026, 263582.36, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '453972'),
  ('HGZ2-INT-HIST-100', 'EF575658', '050GYR988T00425-001-00', '2025-11-26', '2025-12-25', 3, 2026, 258689.88, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '453993'),
  ('HGZ2-INT-HIST-101', '63562147', '050GYR988T01924-001-00', '2025-11-11', '2025-11-11', 2, 2026, 9879.66, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '452480'),
  ('HGZ2-INT-HIST-102', '63612361', '050GYR988T01924-001-00', '2025-12-12', '2025-12-12', 3, 2026, 9879.66, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '453249'),
  ('HGZ2-INT-HIST-103', 'EF582049', '050GYR988T02124-001-00', '2025-08-26', '2025-09-25', 3, 2026, 263183.26, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', true, null),
  ('HGZ2-INT-HIST-104', 'EF582051', '050GYR988T02124-001-00', '2025-09-26', '2025-10-25', 3, 2026, 351046.92, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', true, null),
  ('HGZ2-INT-HIST-105', 'EF582054', '050GYR988T02124-001-00', '2025-10-26', '2025-11-25', 3, 2026, 346562, 'en_revision', 'envio_firmas_admin_contrato', 'solicitado_fsi', true, null),
  ('HGZ2-INT-HIST-106', 'EF576377', '050GYR032N10125-109-00', '2025-11-26', '2025-12-25', 6, 2026, 338611.46, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '461815'),
  ('HGZ2-INT-HIST-107', 'MTY25112', '988T00323-010', '2025-10-01', '2025-10-25', 3, 2026, 1105708.52, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '454158'),
  ('HGZ2-INT-HIST-108', 'MTY25239', '988T00323-010', '2025-10-26', '2025-11-25', 3, 2026, 1377875.84, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '454157'),
  ('HGZ2-INT-HIST-109', 'MTY25282', '988T00323-010', '2025-11-26', '2025-12-25', 6, 2026, 1200575.64, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '457241'),
  ('HGZ2-INT-HIST-110', 'MTY25298', '988T00323-010', '2025-12-26', '2025-12-31', 4, 2026, 246838.72, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '457925'),
  ('HGZ2-INT-HIST-111', 'FAC23238', '050GYR032N05725-092-00', '2025-10-26', '2025-11-25', 3, 2026, 408533.44, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '453749'),
  ('HGZ2-INT-HIST-112', 'FAC23281', '050GYR032N05725-092-00', '2025-11-26', '2025-12-26', 3, 2026, 365158.72, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '453748'),
  ('HGZ2-INT-HIST-113', 'FAC23329', '050GYR032N05725-092-00', '2025-12-26', '2025-12-31', 3, 2026, 66472.64, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '453748'),
  ('HGZ2-INT-HIST-114', 'FAC23390', '050GYR032N05725-092-00', '2026-01-01', '2026-01-25', 1, 2026, 422815.36, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', false, '462969'),
  ('HGZ2-INT-HIST-115', 'HD6918', '988T0823-036', '2025-11-26', '2025-12-26', 4, 2026, 128123.04, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '457242'),
  ('HGZ2-INT-HIST-116', 'HD6923', '988T0823-036', '2025-12-26', '2025-12-31', 4, 2026, 20776.99, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '459113'),
  ('HGZ2-INT-HIST-117', '4601508850', '050GYR988N00125-001-00', '2025-10-27', '2025-11-26', 3, 2026, 50224.03, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '454440'),
  ('HGZ2-INT-HIST-118', '4601516284', '050GYR988N00125-001-00', '2025-11-27', '2025-12-26', 3, 2026, 49400.69, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '454159'),
  ('HGZ2-INT-HIST-119', '4601517500', '050GYR988N00125-001-00', '2025-12-31', '2025-12-31', 3, 2026, 10703.48, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado', true, '454044')
) as v(folio_ingreso, folio_proveedor, contrato, periodo_inicio, periodo_fin, mes_asig, anio_asig, importe, gen, fir, ped, es_pasivo, cr)
join lateral (select c.* from contratos c where c.numero_interno=v.contrato
  order by (case when v.periodo_fin::date between c.vigencia_inicio and c.vigencia_fin then 0 else 1 end), c.vigencia_inicio limit 1) c on true
join partidas pa on pa.id=c.partida_id
where not exists (select 1 from facturas f where f.folio_proveedor=v.folio_proveedor and f.contrato_id=c.id);

-- 3) Historial
insert into factura_estatus_historial (factura_id, circuito, estatus, fecha, comentario)
select f.id, h.circuito::tipo_circuito, h.estatus, h.fecha::timestamptz, h.comentario
from (values
  ('HGZ2-INT-HIST-099', 'general', 'gasto_reflejado', '2026-03-03', 'Periodo (Excel): 26 DE OCTUBRE AL 25 DE NOVIEMBRE · CR 453972'),
  ('HGZ2-INT-HIST-099', 'firmas', 'autorizada_admin_contrato', '2025-12-02', null),
  ('HGZ2-INT-HIST-099', 'pedido_recepcion', 'generado', '2025-12-02', 'Pedido 41619 · Recepción 40428 (histórico)'),
  ('HGZ2-INT-HIST-100', 'general', 'gasto_reflejado', '2026-03-05', 'Periodo (Excel): 26 DE NOVIEMBRE AL 25 DE DICIEMBRE · CR 453993'),
  ('HGZ2-INT-HIST-100', 'firmas', 'autorizada_admin_contrato', '2025-12-27', null),
  ('HGZ2-INT-HIST-100', 'pedido_recepcion', 'generado', '2025-12-27', 'Pedido 41620 · Recepción 40429 (histórico)'),
  ('HGZ2-INT-HIST-101', 'general', 'gasto_reflejado', '2026-02-12', 'Periodo (Excel): 11 DE NOVIEMBRE · CR 452480'),
  ('HGZ2-INT-HIST-101', 'firmas', 'autorizada_admin_contrato', '2025-12-11', null),
  ('HGZ2-INT-HIST-101', 'pedido_recepcion', 'generado', '2025-12-11', 'Contra recibo 452480'),
  ('HGZ2-INT-HIST-102', 'general', 'gasto_reflejado', '2026-03-02', 'Periodo (Excel): 12 DE DICIEMBRE · CR 453249'),
  ('HGZ2-INT-HIST-102', 'firmas', 'autorizada_admin_contrato', '2026-01-12', null),
  ('HGZ2-INT-HIST-102', 'pedido_recepcion', 'generado', '2026-01-12', 'Pedido 41450 · Recepción 40262 (histórico)'),
  ('HGZ2-INT-HIST-103', 'general', 'en_revision', '2026-03-31', 'Periodo (Excel): 26 DE AGOSTO AL 25 DE SEPTIEMBRE'),
  ('HGZ2-INT-HIST-103', 'firmas', 'envio_firmas_admin_contrato', '2026-03-31', null),
  ('HGZ2-INT-HIST-103', 'pedido_recepcion', 'solicitado_fsi', '2026-03-31', null),
  ('HGZ2-INT-HIST-104', 'general', 'en_revision', '2026-03-31', 'Periodo (Excel): 26 DE SEPTIEMBRE AL 25 DE OCTUBRE'),
  ('HGZ2-INT-HIST-104', 'firmas', 'envio_firmas_admin_contrato', '2026-03-31', null),
  ('HGZ2-INT-HIST-104', 'pedido_recepcion', 'solicitado_fsi', '2026-03-31', null),
  ('HGZ2-INT-HIST-105', 'general', 'en_revision', '2026-03-31', 'Periodo (Excel): 26 DE OCTUBRE AL 25 DE NOVIEMBRE'),
  ('HGZ2-INT-HIST-105', 'firmas', 'envio_firmas_admin_contrato', '2026-03-31', null),
  ('HGZ2-INT-HIST-105', 'pedido_recepcion', 'solicitado_fsi', '2026-03-31', null),
  ('HGZ2-INT-HIST-106', 'general', 'gasto_reflejado', '2026-06-03', 'Periodo (Excel): 26 DE NOVIEMBRE AL 25 DE DICIEMBRE · CR 461815'),
  ('HGZ2-INT-HIST-106', 'firmas', 'autorizada_admin_contrato', '2026-01-15', null),
  ('HGZ2-INT-HIST-106', 'pedido_recepcion', 'generado', '2026-01-15', 'Pedido 42560 · Recepción 41364 (histórico)'),
  ('HGZ2-INT-HIST-107', 'general', 'gasto_reflejado', '2026-03-04', 'Periodo (Excel): 01 DE OCTUBRE AL 25 DE OCTUBRE · CR 454158'),
  ('HGZ2-INT-HIST-107', 'firmas', 'autorizada_admin_contrato', '2025-11-27', null),
  ('HGZ2-INT-HIST-107', 'pedido_recepcion', 'generado', '2025-11-27', 'Contra recibo 454158'),
  ('HGZ2-INT-HIST-108', 'general', 'gasto_reflejado', '2026-03-04', 'Periodo (Excel): 26 DE OCTUBRE AL 25 DE NOVIEMBRE · CR 454157'),
  ('HGZ2-INT-HIST-108', 'firmas', 'autorizada_admin_contrato', '2025-12-10', null),
  ('HGZ2-INT-HIST-108', 'pedido_recepcion', 'generado', '2025-12-10', 'Contra recibo 454157'),
  ('HGZ2-INT-HIST-109', 'general', 'gasto_reflejado', '2026-06-06', 'Periodo (Excel): 26 DE NOVIEMBRE AL 25 DE DICIEMBRE · CR 457241'),
  ('HGZ2-INT-HIST-109', 'firmas', 'autorizada_admin_contrato', '2025-12-30', null),
  ('HGZ2-INT-HIST-109', 'pedido_recepcion', 'generado', '2025-12-30', 'Pedido 42291 · Recepción 41096 (histórico)'),
  ('HGZ2-INT-HIST-110', 'general', 'gasto_reflejado', '2026-04-13', 'Periodo (Excel): 26 DE DICIEMBRE AL 31 DE DICIEMBRE · CR 457925'),
  ('HGZ2-INT-HIST-110', 'firmas', 'autorizada_admin_contrato', '2026-01-07', null),
  ('HGZ2-INT-HIST-110', 'pedido_recepcion', 'generado', '2026-01-07', 'Pedido 42292 · Recepción 41097 (histórico)'),
  ('HGZ2-INT-HIST-111', 'general', 'gasto_reflejado', '2026-03-12', 'Periodo (Excel): 26 DE OCTUBRE AL 25 DE NOVIEMBRE · CR 453749'),
  ('HGZ2-INT-HIST-111', 'firmas', 'autorizada_admin_contrato', '2025-12-02', null),
  ('HGZ2-INT-HIST-111', 'pedido_recepcion', 'generado', '2025-12-02', 'Pedido 41535 · Recepción 40344 (histórico)'),
  ('HGZ2-INT-HIST-112', 'general', 'gasto_reflejado', '2026-03-12', 'Periodo (Excel): 26 DE NOVIEMBRE AL 26 DE DICIEMBRE · CR 453748'),
  ('HGZ2-INT-HIST-112', 'firmas', 'autorizada_admin_contrato', '2025-12-30', null),
  ('HGZ2-INT-HIST-112', 'pedido_recepcion', 'generado', '2025-12-30', 'Pedido 41533 · Recepción 40342 (histórico)'),
  ('HGZ2-INT-HIST-113', 'general', 'gasto_reflejado', '2026-03-12', 'Periodo (Excel): 26 DE DICIEMBRE AL 31 DE DICIEMBRE · CR 453748'),
  ('HGZ2-INT-HIST-113', 'firmas', 'autorizada_admin_contrato', '2026-01-08', null),
  ('HGZ2-INT-HIST-113', 'pedido_recepcion', 'generado', '2026-01-08', 'Pedido 41534 · Recepción 40343 (histórico)'),
  ('HGZ2-INT-HIST-114', 'general', 'gasto_reflejado', '2026-06-17', 'Periodo (Excel): 01 DE ENERO AL 25 DE ENERO · CR 462969'),
  ('HGZ2-INT-HIST-114', 'firmas', 'autorizada_admin_contrato', '2026-02-12', null),
  ('HGZ2-INT-HIST-114', 'pedido_recepcion', 'generado', '2026-02-12', 'Pedido 43027 · Recepción 41832 (histórico)'),
  ('HGZ2-INT-HIST-115', 'general', 'gasto_reflejado', '2026-04-06', 'Periodo (Excel): 26 DE NOVIEMBRE AL 26 DE DICIEMBRE · CR 457242'),
  ('HGZ2-INT-HIST-115', 'firmas', 'autorizada_admin_contrato', '2025-12-31', null),
  ('HGZ2-INT-HIST-115', 'pedido_recepcion', 'generado', '2025-12-31', 'Pedido 42294 · Recepción 41099 (histórico)'),
  ('HGZ2-INT-HIST-116', 'general', 'gasto_reflejado', '2026-04-27', 'Periodo (Excel): 26 DE DICIEMBRE AL 31 DE DICIEMBRE · CR 459113'),
  ('HGZ2-INT-HIST-116', 'firmas', 'autorizada_admin_contrato', '2025-12-31', null),
  ('HGZ2-INT-HIST-116', 'pedido_recepcion', 'generado', '2025-12-31', 'Pedido 42339 · Recepción 41142 (histórico)'),
  ('HGZ2-INT-HIST-117', 'general', 'gasto_reflejado', '2026-03-10', 'Periodo (Excel): 27 DE OCTUBRE AL 26 DE NOVIEMBRE · CR 454440'),
  ('HGZ2-INT-HIST-117', 'firmas', 'autorizada_admin_contrato', '2025-11-27', null),
  ('HGZ2-INT-HIST-117', 'pedido_recepcion', 'generado', '2025-11-27', 'Pedido 41746 · Recepción 40555 (histórico)'),
  ('HGZ2-INT-HIST-118', 'general', 'gasto_reflejado', '2026-03-04', 'Periodo (Excel): 27 DE NOVIEMBRE AL 26 DE DICIEMBRE · CR 454159'),
  ('HGZ2-INT-HIST-118', 'firmas', 'autorizada_admin_contrato', '2025-12-29', null),
  ('HGZ2-INT-HIST-118', 'pedido_recepcion', 'generado', '2025-12-29', 'Pedido 41747 · Recepción 40556 (histórico)'),
  ('HGZ2-INT-HIST-119', 'general', 'gasto_reflejado', '2026-03-04', 'Periodo (Excel): 27 AL 31 DE DICIEMBRE 2025 · CR 454044'),
  ('HGZ2-INT-HIST-119', 'firmas', 'autorizada_admin_contrato', '2026-01-02', null),
  ('HGZ2-INT-HIST-119', 'pedido_recepcion', 'generado', '2026-01-02', 'Pedido 41616 · Recepción 40425 (histórico)')
) as h(folio_ingreso, circuito, estatus, fecha, comentario)
join facturas f on f.folio_ingreso=h.folio_ingreso;

alter table facturas enable trigger trg_a_historial;
alter table facturas enable trigger trg_b_auto_en_revision;
commit;
