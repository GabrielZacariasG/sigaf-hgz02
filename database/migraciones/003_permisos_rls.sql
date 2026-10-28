-- =====================================================================
-- SIGAF · Fase 0 · 003 · Permisos (RLS): quién puede ESCRIBIR qué
-- Fecha: 28/10/2026
--
-- Problema: las tablas nuevas (oficios, jefes_servicio, jefe_proveedor,
-- administradores, validaciones_servicio, disponibilidad_diaria) dejaban
-- escribir a CUALQUIER usuario con sesión: un jefe de servicio podía editar
-- oficios, catálogos o la disponibilidad.
--
-- Quién es quién (misma regla que ya usa la app):
--   · Personal de Finanzas  = está en la tabla usuarios (auo, jefe_presupuesto, jefa_finanzas)
--   · Admin de catálogos    = jefe_presupuesto / jefa_finanzas (fn_es_admin, ya existe)
--   · Validador             = jefe de servicio o administrador (Subdirector) ACTIVO cuyo
--                             correo, o la matrícula antes de la @, coincide con el de su sesión
--
-- Lectura: NO cambia (cualquier usuario con sesión sigue leyendo).
-- Cómo correrlo: SQL Editor de Supabase. Al final hay consultas de verificación.
-- =====================================================================

create or replace function public.fn_es_personal()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mi_rol() is not null
$$;

create or replace function public.fn_es_validador()
returns boolean language sql stable security definer set search_path = public as $$
  with yo as (
    select lower(coalesce(auth.jwt() ->> 'email', '')) as email,
           split_part(lower(coalesce(auth.jwt() ->> 'email', '')), '@', 1) as matricula
  )
  select exists (
      select 1 from jefes_servicio j, yo
      where j.activo and yo.email <> ''
        and (lower(coalesce(j.email, '')) = yo.email or lower(coalesce(j.matricula, '')) = yo.matricula))
  or exists (
      select 1 from administradores a, yo
      where a.activo and yo.email <> ''
        and (lower(coalesce(a.email, '')) = yo.email or lower(coalesce(a.matricula, '')) = yo.matricula))
$$;

revoke all on function public.fn_es_personal() from public;
revoke all on function public.fn_es_validador() from public;
grant execute on function public.fn_es_personal() to authenticated;
grant execute on function public.fn_es_validador() to authenticated;

-- Oficios (EP, DP, ES): solo Finanzas los emite.
drop policy if exists of_write on oficios;
create policy of_write on oficios for all using (public.fn_es_personal()) with check (public.fn_es_personal());

-- Catálogos de jefes, relación jefe-proveedor y administradores: solo admin de catálogos.
drop policy if exists js_write on jefes_servicio;
create policy js_write on jefes_servicio for all using (public.fn_es_admin()) with check (public.fn_es_admin());
drop policy if exists jp_write on jefe_proveedor;
create policy jp_write on jefe_proveedor for all using (public.fn_es_admin()) with check (public.fn_es_admin());
drop policy if exists adm_write on administradores;
create policy adm_write on administradores for all using (public.fn_es_admin()) with check (public.fn_es_admin());

-- Validaciones del servicio: el jefe de servicio / Subdirector que valida, o Finanzas.
drop policy if exists vs_write on validaciones_servicio;
create policy vs_write on validaciones_servicio for all
  using (public.fn_es_personal() or public.fn_es_validador())
  with check (public.fn_es_personal() or public.fn_es_validador());

-- Fotos diarias de la disponibilidad (cierre): solo Finanzas.
drop policy if exists dd_write on disponibilidad_diaria;
create policy dd_write on disponibilidad_diaria for all using (public.fn_es_personal()) with check (public.fn_es_personal());

-- ---------------------------------------------------------------------
-- Verificación (solo lectura). Revisar ANTES de usar el sistema:
-- 1) Personal de Finanzas y su rol (Gabriel, su jefa y su analista deben salir aquí).
select nombre, rol from usuarios order by rol, nombre;
-- 2) Jefes y administradores activos SIN correo ni matrícula: no podrían validar.
select 'jefe' as tipo, nombre, email, matricula from jefes_servicio
 where activo and coalesce(btrim(email), '') = '' and coalesce(btrim(matricula), '') = ''
union all
select 'administrador', nombre, email, matricula from administradores
 where activo and coalesce(btrim(email), '') = '' and coalesce(btrim(matricula), '') = '';
