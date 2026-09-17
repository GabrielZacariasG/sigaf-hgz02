-- =====================================================================
-- SIGAF · FIX: la validación del jefe de servicio no movía la factura.
-- Causa: RLS (facturas_update_auo) solo deja UPDATE facturas a
-- auo/jefe_presupuesto/jefa_finanzas. El jefe de servicio no está en
-- 'usuarios' -> su UPDATE se bloquea SIN error, y la factura se queda en
-- la bandeja aunque el registro de validación sí se creó.
--
-- Solución: un trigger SECURITY DEFINER sobre validaciones_servicio que
-- aplica el efecto a la factura con permisos elevados (bypass RLS):
--   cumplimiento   -> estatus_firmas = autorizada_servicio
--   incumplimiento -> estatus_firmas = pendiente
--   devolucion     -> marca dev_solicitada (regresa a Presupuesto)
-- Además destraba (backfill) las que ya quedaron atoradas.
-- Correr en el SQL Editor de Supabase.
-- =====================================================================

begin;

-- 1) Permitir el dictamen 'devolucion' (la solicitud del jefe también se
--    guarda en validaciones_servicio, que el jefe SÍ puede escribir).
alter table validaciones_servicio drop constraint if exists validaciones_servicio_dictamen_check;
alter table validaciones_servicio add constraint validaciones_servicio_dictamen_check
  check (dictamen in ('cumplimiento','incumplimiento','devolucion'));

-- 2) Trigger que aplica el efecto a la factura (con permisos elevados).
create or replace function fn_aplicar_validacion_servicio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.dictamen = 'cumplimiento' then
    update facturas set estatus_firmas = 'autorizada_servicio', dev_solicitada = false
    where id = new.factura_id and estatus_firmas = 'envio_firmas_servicio';
  elsif new.dictamen = 'incumplimiento' then
    update facturas set estatus_firmas = 'pendiente'
    where id = new.factura_id and estatus_firmas = 'envio_firmas_servicio';
  elsif new.dictamen = 'devolucion' then
    update facturas set dev_solicitada = true, dev_solicitada_motivo = new.motivo,
                        dev_solicitada_jefe_id = new.jefe_id, dev_solicitada_at = now(),
                        estatus_firmas = 'pendiente'
    where id = new.factura_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_aplicar_validacion on validaciones_servicio;
create trigger trg_aplicar_validacion
  after insert or update on validaciones_servicio
  for each row execute function fn_aplicar_validacion_servicio();

-- 3) Backfill: destrabar las que ya tenían validación pero se quedaron en
--    la bandeja (estatus_firmas = envio_firmas_servicio).
update facturas f set estatus_firmas = 'autorizada_servicio'
from validaciones_servicio v
where v.factura_id = f.id and v.dictamen = 'cumplimiento'
  and f.estatus_firmas = 'envio_firmas_servicio' and f.anulada = false;

update facturas f set estatus_firmas = 'pendiente'
from validaciones_servicio v
where v.factura_id = f.id and v.dictamen = 'incumplimiento'
  and f.estatus_firmas = 'envio_firmas_servicio' and f.anulada = false;

-- 4) Verificación: deben quedar 0 atoradas (validadas pero aún en bandeja).
select coalesce(v.dictamen,'(sin validación)') as dictamen, count(*) as atoradas
from facturas f
left join validaciones_servicio v on v.factura_id = f.id
where f.estatus_firmas = 'envio_firmas_servicio' and v.id is not null
group by v.dictamen;

commit;
