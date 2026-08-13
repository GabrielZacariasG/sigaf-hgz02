-- =====================================================================
-- SIGAF · Lote 2 (parte 2) — cierre del Grupo C: bloques 8 y 10
-- 3 proveedores nuevos, 2 partidas nuevas (cuenta_prei NULL), 3 contratos,
-- 4 facturas. Idempotente.
-- =====================================================================
begin;
alter table facturas disable trigger trg_a_historial;
alter table facturas disable trigger trg_b_auto_en_revision;

-- 1) Proveedores nuevos
insert into proveedores (razon_social)
select 'UNIDAD DE CUIDADOS NEFROLOGICOS'
where not exists (select 1 from proveedores where razon_social='UNIDAD DE CUIDADOS NEFROLOGICOS');
insert into proveedores (razon_social)
select 'GRUPO EMEQUR'
where not exists (select 1 from proveedores where razon_social='GRUPO EMEQUR');
insert into proveedores (razon_social)
select 'PRO OMNIMEDIC'
where not exists (select 1 from proveedores where razon_social='PRO OMNIMEDIC');

-- 2) Partidas nuevas (cuenta_prei NULL para no chocar con el check de formato)
insert into partidas (capitulo_id, cuenta_finat, nombre)
select (select capitulo_id from partidas where cuenta_finat='51251013' limit 1),
       '51331002', 'Servicio integral de hemodiálisis extramuros (subrogado)'
where not exists (select 1 from partidas where cuenta_finat='51331002');
insert into partidas (capitulo_id, cuenta_finat, nombre)
select (select capitulo_id from partidas where cuenta_finat='51251013' limit 1),
       '51321003', 'Servicios integrales - equipo médico (bloque 10)'
where not exists (select 1 from partidas where cuenta_finat='51321003');

-- 3) Contratos nuevos
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '050GYR032N09825-108-00', (select id from proveedores where razon_social='UNIDAD DE CUIDADOS NEFROLOGICOS' limit 1),
  (select id from partidas where cuenta_finat='51331002' limit 1),
  'Hemodiálisis extramuros (subrogado)', '2025-10-01'::date, '2025-11-30'::date, 'Alta provisional (Lote 2 B8).'
where not exists (select 1 from contratos where numero_interno='050GYR032N09825-108-00');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '050GYR032N2826-085-00', (select id from proveedores where razon_social='GRUPO EMEQUR' limit 1),
  (select id from partidas where cuenta_finat='51321003' limit 1),
  'Renta de equipo (esterilizador)', '2026-07-01'::date, '2026-07-31'::date, 'Alta provisional (Lote 2 B10).'
where not exists (select 1 from contratos where numero_interno='050GYR032N2826-085-00');
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select '050GYR032N02826-080-00', (select id from proveedores where razon_social='PRO OMNIMEDIC' limit 1),
  (select id from partidas where cuenta_finat='51321003' limit 1),
  'Renta de equipo (electrocardiógrafo)', '2026-07-01'::date, '2026-07-31'::date, 'Alta provisional (Lote 2 B10).'
where not exists (select 1 from contratos where numero_interno='050GYR032N02826-080-00');

-- 4) Facturas (4). UCN reflejadas en FINAT (gasto = dispo); EMEQUR/OMNIMEDIC en revisión.
insert into facturas
  (folio_ingreso, folio_proveedor, capitulo_id, partida_id, contrato_id, proveedor_id,
   periodo_inicio, periodo_fin, mes_asignado, anio_asignado, tasa_iva, importe_factura,
   estatus_general, estatus_firmas, estatus_pedido_recepcion, es_pasivo)
select v.folio_ingreso, v.folio_proveedor, pa.capitulo_id, c.partida_id, c.id, c.proveedor_id,
  v.periodo_inicio::date, v.periodo_fin::date, v.mes_asig, v.anio_asig, 0.16, v.importe,
  v.gen::estatus_general, v.fir::estatus_firmas, v.ped::estatus_pedido_recepcion, false
from (values
  ('HGZ2-INT-HIST-120', 'UCN311', '050GYR032N09825-108-00', '2025-10-26', '2025-11-25', 11, 2025, 10149559.2, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado'),
  ('HGZ2-INT-HIST-121', 'UCN313', '050GYR032N09825-108-00', '2025-11-26', '2025-11-30', 11, 2025, 1566417.6, 'gasto_reflejado', 'autorizada_admin_contrato', 'generado'),
  ('HGZ2-INT-HIST-122', 'ALPF 110098342', '050GYR032N2826-085-00', '2026-07-06', '2026-07-06', 7, 2026, 237684, 'en_revision', 'pendiente', 'pendiente'),
  ('HGZ2-INT-HIST-123', '2272', '050GYR032N02826-080-00', '2026-07-07', '2026-07-07', 7, 2026, 15269.45, 'en_revision', 'pendiente', 'pendiente')
) as v(folio_ingreso, folio_proveedor, contrato, periodo_inicio, periodo_fin, mes_asig, anio_asig, importe, gen, fir, ped)
join contratos c on c.numero_interno = v.contrato
join partidas pa on pa.id = c.partida_id
where not exists (select 1 from facturas f where f.folio_proveedor=v.folio_proveedor and f.contrato_id=c.id);

-- 5) Historial
insert into factura_estatus_historial (factura_id, circuito, estatus, fecha, comentario)
select f.id, h.circuito::tipo_circuito, h.estatus, h.fecha::timestamptz, h.comentario
from (values
  ('HGZ2-INT-HIST-120', 'general', 'gasto_reflejado', '2025-12-11', 'Periodo (Excel): 26 DE OCTUBRE AL 25 DE NOVIEMBRE · reflejado en FINAT; sin folio CR (cédula: PASIVO)'),
  ('HGZ2-INT-HIST-120', 'firmas', 'autorizada_admin_contrato', '2025-12-11', null),
  ('HGZ2-INT-HIST-120', 'pedido_recepcion', 'generado', '2025-12-11', 'Reflejado en FINAT (dispo)'),
  ('HGZ2-INT-HIST-121', 'general', 'gasto_reflejado', '2025-12-16', 'Periodo (Excel): 26 AL 30 DE NOVIEMBRE · reflejado en FINAT; sin folio CR (cédula: PASIVO)'),
  ('HGZ2-INT-HIST-121', 'firmas', 'autorizada_admin_contrato', '2025-12-16', null),
  ('HGZ2-INT-HIST-121', 'pedido_recepcion', 'generado', '2025-12-16', 'Reflejado en FINAT (dispo)'),
  ('HGZ2-INT-HIST-122', 'general', 'en_revision', '2026-07-06', 'Periodo (Excel): RENTA DE ESTERILIZADOR'),
  ('HGZ2-INT-HIST-123', 'general', 'en_revision', '2026-07-07', 'Periodo (Excel): ELECTROCARDIOGRAFO')
) as h(folio_ingreso, circuito, estatus, fecha, comentario)
join facturas f on f.folio_ingreso = h.folio_ingreso;

-- 6) Disponibilidad FINAT de las 2 cuentas nuevas
insert into disponibilidad_presupuestal (cuenta_prei, periodo, presupuesto, gasto, comprometido, precomprometido, disponible)
values
  ('51331002','2026', 11715978.00, 11715976.80, 0,          0.00, 1.20),
  ('51321003','2026', 10216125.29,   361470.73, 9854654.56, 0.00, 0.00)
on conflict (cuenta_prei, periodo) do update set
  presupuesto=excluded.presupuesto, gasto=excluded.gasto, comprometido=excluded.comprometido,
  precomprometido=excluded.precomprometido, disponible=excluded.disponible, actualizado_at=now();

alter table facturas enable trigger trg_a_historial;
alter table facturas enable trigger trg_b_auto_en_revision;
commit;
