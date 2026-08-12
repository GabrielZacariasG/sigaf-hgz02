-- =====================================================================
-- SIGAF · Fase 2 — Cuenta 51251013 al 100% (Diálisis Peritoneal CA)
-- Corre DESPUÉS de la Fase 1 (fn_calcular_mes_y_vigencia actualizada).
-- Idempotente en facturas (where not exists por folio+contrato).
-- =====================================================================
begin;

-- 0) Silenciar SOLO los triggers de historial/auto (el de cálculo de mes SÍ debe correr)
alter table facturas disable trigger trg_a_historial;
alter table facturas disable trigger trg_b_auto_en_revision;

-- 1) Columnas nuevas (idempotentes)
alter table facturas add column if not exists cr_contrarecibo text;
alter table facturas add column if not exists tipo_entrega    text check (tipo_entrega in ('DOMICILIO','FARMACIA'));
alter table facturas add column if not exists num_pacientes   integer;

-- 2) Tabla de disponibilidad presupuestal (volcado FINAT/dispo, recargable)
--    Recrear si existe vacía (una sesión previa pudo dejarla con otra forma).
do $$ begin
  if to_regclass('public.disponibilidad_presupuestal') is not null then
    if (select count(*) from disponibilidad_presupuestal) > 0 then
      raise exception 'disponibilidad_presupuestal ya tiene datos; no la recreo. Avisame para conciliar.';
    end if;
    drop table disponibilidad_presupuestal cascade;
  end if;
end $$;
create table disponibilidad_presupuestal (
  id              uuid primary key default gen_random_uuid(),
  cuenta_prei     text not null,
  periodo         text not null,             -- ej. '2026' (ejercicio) o '2026M08'
  presupuesto     numeric(16,2) not null default 0,
  gasto           numeric(16,2) not null default 0,
  comprometido    numeric(16,2) not null default 0,
  precomprometido numeric(16,2) not null default 0,
  disponible      numeric(16,2) not null default 0,
  actualizado_at  timestamptz not null default now(),
  unique (cuenta_prei, periodo)
);
alter table disponibilidad_presupuestal enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='disponibilidad_presupuestal' and policyname='disp_select') then
    create policy disp_select on disponibilidad_presupuestal for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename='disponibilidad_presupuestal' and policyname='disp_write') then
    create policy disp_write on disponibilidad_presupuestal for all using (fn_es_admin()) with check (fn_es_admin());
  end if;
end $$;

-- 3) Tabla de ajustes de devengo (nunca es factura)
--    Recrear si existe vacía (una sesión previa la creó con otra forma).
do $$ begin
  if to_regclass('public.ajustes_devengo') is not null then
    if (select count(*) from ajustes_devengo) > 0 then
      raise exception 'ajustes_devengo ya tiene datos; no la recreo. Avisame para conciliar.';
    end if;
    drop table ajustes_devengo cascade;
  end if;
end $$;
create table ajustes_devengo (
  id                uuid primary key default gen_random_uuid(),
  partida_id        uuid not null references partidas(id),
  contrato_id       uuid references contratos(id),
  descripcion       text,
  importe           numeric(14,2) not null,
  mes_presupuestal  integer not null check (mes_presupuestal between 1 and 12),
  anio_presupuestal integer not null,
  origen            text,
  created_at        timestamptz not null default now()
);
alter table ajustes_devengo enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='ajustes_devengo' and policyname='deveng_select') then
    create policy deveng_select on ajustes_devengo for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename='ajustes_devengo' and policyname='deveng_write') then
    create policy deveng_write on ajustes_devengo for all using (fn_es_admin()) with check (fn_es_admin());
  end if;
end $$;

-- 4) Alta de los 2 contratos faltantes (proveedor y partida heredados de un
--    contrato hermano PISA ya existente en la cuenta 51251013)
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin, comentarios)
select v.num,
  (select proveedor_id from contratos where numero_interno='050GYR988T001025-022-00' limit 1),
  (select partida_id   from contratos where numero_interno='050GYR988T001025-022-00' limit 1),
  'Diálisis peritoneal continua ambulatoria (soluciones)', v.ini::date, v.fin::date,
  'Alta provisional (Fase 2). Vigencia derivada de facturas; pendiente documento fuente.'
from (values
  ('050GYR988T02024-001-00', '2025-10-01', '2025-12-31'),
  ('050GYR988T00525-020-00', '2025-11-01', '2025-12-31')
) as v(num, ini, fin)
where not exists (select 1 from contratos c where c.numero_interno = v.num);

-- 5) Insert de las 7 facturas nuevas (idempotente). es_pasivo=true, tasa_iva=0.
--    El trigger fn_calcular_mes_y_vigencia fija mes_presupuestal desde el
--    periodo; como es_pasivo=true, respeta el mes_asignado (ejercicio) enviado.
insert into facturas
  (folio_ingreso, folio_proveedor, capitulo_id, partida_id, contrato_id, proveedor_id,
   periodo_inicio, periodo_fin, mes_asignado, anio_asignado, tasa_iva, importe_factura,
   estatus_general, estatus_firmas, estatus_pedido_recepcion,
   es_pasivo, cr_contrarecibo, tipo_entrega, num_pacientes)
select v.folio_ingreso, v.folio_proveedor,
  pa.capitulo_id, c.partida_id, c.id, c.proveedor_id,
  v.periodo_inicio::date, v.periodo_fin::date, v.mes_asig, v.anio_asig, 0, v.importe,
  'gasto_reflejado','autorizada_admin_contrato','generado',
  true, v.cr, v.tipo::tipo_entrega_enum, v.num_pac
from (values
  ('HGZ2-INT-HIST-092', '63562143', '050GYR988T02024-001-00', '2025-11-14', '2025-11-14', 12, 2025, 8784, '452457', 'FARMACIA', null),
  ('HGZ2-INT-HIST-093', '63567488', '050GYR988T02024-001-00', '2025-10-26', '2025-11-13', 12, 2025, 190557.9, '459614', 'DOMICILIO', 29),
  ('HGZ2-INT-HIST-094', '63612351', '050GYR988T02024-001-00', '2025-11-26', '2025-12-13', 1, 2026, 173154.6, '453827', 'DOMICILIO', 27),
  ('HGZ2-INT-HIST-095', '63617780', '050GYR988T02024-001-00', '2025-12-14', '2025-12-14', 1, 2026, 8784, '457240', 'FARMACIA', null),
  ('HGZ2-INT-HIST-096', '63623194', '050GYR988T02024-001-00', '2025-12-26', '2025-12-31', 1, 2026, 39747.6, '453246', 'DOMICILIO', 6),
  ('HGZ2-INT-HIST-097', '63562144', '050GYR988T00525-020-00', '2025-11-03', '2025-11-18', 12, 2025, 17726.4, '452481', 'DOMICILIO', 3),
  ('HGZ2-INT-HIST-098', '63612352', '050GYR988T00525-020-00', '2025-12-07', '2025-12-18', 1, 2026, 17726.4, '453247', 'DOMICILIO', 3)
) as v(folio_ingreso, folio_proveedor, contrato, periodo_inicio, periodo_fin, mes_asig, anio_asig, importe, cr, tipo, num_pac)
join lateral (
  select c.* from contratos c where c.numero_interno = v.contrato
  order by (case when v.periodo_fin::date between c.vigencia_inicio and c.vigencia_fin then 0 else 1 end), c.vigencia_inicio
  limit 1
) c on true
join partidas pa on pa.id = c.partida_id
where not exists (
  select 1 from facturas f where f.folio_proveedor = v.folio_proveedor and f.contrato_id = c.id
);

-- 6) Historial de las 7 nuevas (fechas reales; solo las recién insertadas)
insert into factura_estatus_historial (factura_id, circuito, estatus, fecha, comentario)
select f.id, h.circuito::tipo_circuito, h.estatus, h.fecha::timestamptz, h.comentario
from (values
  ('HGZ2-INT-HIST-092', 'general', 'gasto_reflejado', '2026-02-12', 'Periodo (Excel): 14 DE NOVIEMBRE · CR 452457'),
  ('HGZ2-INT-HIST-092', 'firmas', 'autorizada_admin_contrato', '2025-12-11', null),
  ('HGZ2-INT-HIST-092', 'pedido_recepcion', 'generado', '2025-12-11', 'Contra recibo 452457 (sin folio de pedido/recepción)'),
  ('HGZ2-INT-HIST-093', 'general', 'gasto_reflejado', '2026-04-27', 'Periodo (Excel): 26 DE OCTUBRE AL 13 DE NOVIEMBRE · CR 459614'),
  ('HGZ2-INT-HIST-093', 'firmas', 'autorizada_admin_contrato', '2025-12-15', null),
  ('HGZ2-INT-HIST-093', 'pedido_recepcion', 'generado', '2025-12-15', 'Pedido 42290 · Recepción 41095 (histórico)'),
  ('HGZ2-INT-HIST-094', 'general', 'gasto_reflejado', '2026-03-02', 'Periodo (Excel): 26 DE NOVIEMBRE AL 13 DE DICIEMBRE · CR 453827'),
  ('HGZ2-INT-HIST-094', 'firmas', 'autorizada_admin_contrato', '2026-01-12', null),
  ('HGZ2-INT-HIST-094', 'pedido_recepcion', 'generado', '2026-01-12', 'Pedido 41561 · Recepción 40375 (histórico)'),
  ('HGZ2-INT-HIST-095', 'general', 'gasto_reflejado', '2026-04-14', 'Periodo (Excel): 14 DE DICIEMBRE · CR 457240'),
  ('HGZ2-INT-HIST-095', 'firmas', 'autorizada_admin_contrato', '2026-01-13', null),
  ('HGZ2-INT-HIST-095', 'pedido_recepcion', 'generado', '2026-01-13', 'Pedido 42289 · Recepción 41094 (histórico)'),
  ('HGZ2-INT-HIST-096', 'general', 'gasto_reflejado', '2026-03-02', 'Periodo (Excel): 26 DE DICIEMBRE AL 31 DE DICIEMBRE · CR 453246'),
  ('HGZ2-INT-HIST-096', 'firmas', 'autorizada_admin_contrato', '2026-01-15', null),
  ('HGZ2-INT-HIST-096', 'pedido_recepcion', 'generado', '2026-01-15', 'Pedido 41420 · Recepción 40231 (histórico)'),
  ('HGZ2-INT-HIST-097', 'general', 'gasto_reflejado', '2026-02-12', 'Periodo (Excel): 03 DE NOVIEMBRE AL 18 DE NOVIEMBRE · CR 452481'),
  ('HGZ2-INT-HIST-097', 'firmas', 'autorizada_admin_contrato', '2025-12-11', null),
  ('HGZ2-INT-HIST-097', 'pedido_recepcion', 'generado', '2025-12-11', 'Contra recibo 452481 (sin folio de pedido/recepción)'),
  ('HGZ2-INT-HIST-098', 'general', 'gasto_reflejado', '2026-03-02', 'Periodo (Excel): 07 DE DICIEMBRE AL 18 DE DICIEMBRE · CR 453247'),
  ('HGZ2-INT-HIST-098', 'firmas', 'autorizada_admin_contrato', '2026-01-12', null),
  ('HGZ2-INT-HIST-098', 'pedido_recepcion', 'generado', '2026-01-12', 'Pedido 41448 · Recepción 40229 (histórico)')
) as h(folio_ingreso, circuito, estatus, fecha, comentario)
join facturas f on f.folio_ingreso = h.folio_ingreso;

-- 7) Backfill de las 14 facturas de 51251013 ya migradas (Lote 1):
--    tipo_entrega, num_pacientes, contra recibo, IVA 0 y periodo real.
update facturas f
set tipo_entrega    = v.tipo::tipo_entrega_enum,
    num_pacientes   = v.num_pac,
    cr_contrarecibo = v.cr,
    tasa_iva        = 0,
    periodo_inicio  = v.periodo_inicio::date,
    periodo_fin     = v.periodo_fin::date
from (values
  ('63681830', '050GYR988T01525-001-00', 'DOMICILIO', 26, '458850', '2026-01-03', '2026-01-17'),
  ('63739389', '050GYR988T01525-001-00', 'DOMICILIO', 29, '458844', '2026-01-26', '2026-02-19'),
  ('63805541', '050GYR988T01525-001-00', 'DOMICILIO', 29, '459809', '2026-02-26', '2026-03-20'),
  ('63874117', '050GYR988T01525-001-00', 'DOMICILIO', 27, '466607', '2026-03-26', '2026-04-18'),
  ('63948088', '050GYR988T01525-001-00', 'DOMICILIO', 28, '465826', '2026-04-26', '2026-05-15'),
  ('64012706', '050GYR988T01525-001-00', 'DOMICILIO', 27, '468531', '2026-05-26', '2026-06-13'),
  ('63681834', '050GYR988T001025-022-00', 'FARMACIA', null, '458824', '2026-01-07', '2026-01-07'),
  ('63739391', '050GYR988T001025-022-00', 'DOMICILIO', 1, '458842', '2026-02-12', '2026-02-12'),
  ('63805542', '050GYR988T001025-022-00', 'DOMICILIO', 1, '459808', '2026-03-14', '2026-03-14'),
  ('63805543', '050GYR988T001025-022-00', 'FARMACIA', null, '459806', '2026-03-25', '2026-03-25'),
  ('63874119', '050GYR988T001025-022-00', 'DOMICILIO', 2, '463785', '2026-04-13', '2026-04-13'),
  ('63948090', '050GYR988T001025-022-00', 'DOMICILIO', 2, '468094', '2026-05-14', '2026-05-14'),
  ('64012714', '050GYR988T001025-022-00', 'DOMICILIO', 4, '468534', '2026-06-06', '2026-06-12'),
  ('64085703', '050GYR988T001025-022-00', 'DOMICILIO', 10, null, '2026-07-03', '2026-07-03')
) as v(folio_proveedor, contrato, tipo, num_pac, cr, periodo_inicio, periodo_fin)
join contratos c on c.numero_interno = v.contrato
where f.folio_proveedor = v.folio_proveedor and f.contrato_id = c.id;

-- 8) Devengo (no es factura)
insert into ajustes_devengo (partida_id, contrato_id, descripcion, importe, mes_presupuestal, anio_presupuestal, origen)
select (select partida_id from contratos where numero_interno='050GYR988T001025-022-00' limit 1),
       (select id from contratos where numero_interno='050GYR988T01525-001-00' limit 1),
       'Devengo cédula 2026 (4 unidades x 13,922.37)', 55689.48, 7, 2026,
       'Cédula 00 - bloque integrales, cuenta 51251013'
where not exists (select 1 from ajustes_devengo where descripcion = 'Devengo cédula 2026 (4 unidades x 13,922.37)');

-- 9) Disponibilidad FINAT de la cuenta (del reporte dispo)
insert into disponibilidad_presupuestal (cuenta_prei, periodo, presupuesto, gasto, comprometido, precomprometido, disponible)
values ('51251013', '2026', 6366196.00, 1824055.78, 0, 234347.00, 4307793.22)
on conflict (cuenta_prei, periodo) do update set
  presupuesto=excluded.presupuesto, gasto=excluded.gasto, comprometido=excluded.comprometido,
  precomprometido=excluded.precomprometido, disponible=excluded.disponible, actualizado_at=now();

-- 10) Reactivar triggers
alter table facturas enable trigger trg_a_historial;
alter table facturas enable trigger trg_b_auto_en_revision;

-- ---------------------------------------------------------------------
-- POST-CHECK (antes de commit) — criterios de aceptación
-- ---------------------------------------------------------------------
--   select
--     count(*)                                                as facturas,        -- 21
--     sum(importe_factura)                                    as gasto_facturas,  -- 1,891,445.48
--     sum(importe_factura) filter (where es_pasivo)           as pasivo,          -- 456,480.90
--     sum(importe_factura) filter (where cr_contrarecibo is not null) as reflejado -- 1,824,055.78
--   from facturas f join partidas p on p.id=f.partida_id where p.cuenta_prei='51251013';
--   select coalesce(sum(importe),0) from ajustes_devengo;   -- 55,689.48
-- Si cuadra:  commit;   si no:  rollback;
commit;
