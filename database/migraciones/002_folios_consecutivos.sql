-- =====================================================================
-- SIGAF · Fase 0 · 002 · Folios consecutivos para oficios de validación
-- Fecha: 28/10/2026
--
-- Problema: los oficios de cumplimiento/incumplimiento al Adm. de Contrato
-- (OF-CUM / OF-INC), los acuses de solicitud de devolución (ACU-DEV) y los
-- oficios de Compra Emergente del Subdirector (EF-CE) tomaban su número de la
-- hora de la computadora (Date.now): no son consecutivos y pueden repetirse.
--
-- Ahora: un contador por serie y año en la base de datos. fn_siguiente_folio
-- entrega el siguiente número en una sola operación (dos personas a la vez
-- nunca reciben el mismo). Formato nuevo: OF-CUM-0001/2026 (los ya emitidos
-- con el formato viejo OF-CUM-2026-31526 se quedan como están).
--
-- Cómo correrlo: SQL Editor de Supabase. No toca datos existentes.
-- =====================================================================
create table if not exists folios_serie (
  serie   text    not null,        -- 'OF-CUM', 'OF-INC', 'ACU-DEV', 'EF-CE'
  anio    integer not null,
  ultimo  integer not null default 0,
  primary key (serie, anio)
);

alter table folios_serie enable row level security;
-- Nadie lee ni escribe la tabla directo; solo a través de la función.

create or replace function fn_siguiente_folio(p_serie text, p_anio integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if auth.uid() is null then
    raise exception 'Sesión no iniciada.';
  end if;
  if p_serie not in ('OF-CUM', 'OF-INC', 'ACU-DEV', 'EF-CE') then
    raise exception 'Serie de folio no válida: %', p_serie;
  end if;
  insert into folios_serie as fs (serie, anio, ultimo)
  values (p_serie, p_anio, 1)
  on conflict (serie, anio) do update set ultimo = fs.ultimo + 1
  returning fs.ultimo into v_n;
  return v_n;
end $$;

revoke all on function fn_siguiente_folio(text, integer) from public;
grant execute on function fn_siguiente_folio(text, integer) to authenticated;
