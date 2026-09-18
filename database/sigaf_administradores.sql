-- =====================================================================
-- SIGAF · Administradores (Subdirector Administrativo, etc.)
-- Igual que jefes_servicio: al iniciar sesión, si el correo/matrícula
-- coincide con un administrador activo, SIGAF lo manda DIRECTO a /admin
-- (su panel de solo lectura) y no ve el resto del sistema.
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

create table if not exists administradores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  cargo     text,
  email     text,
  matricula text,
  activo    boolean not null default true,
  unique (nombre)
);
alter table administradores enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='administradores' and policyname='adm_select') then
    create policy adm_select on administradores for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename='administradores' and policyname='adm_write') then
    create policy adm_write on administradores for all using (auth.uid() is not null) with check (auth.uid() is not null);
  end if;
end $$;

-- -------------------------------------------------------------------
-- ALTA DEL SUBDIRECTOR ADMINISTRATIVO  (reemplaza NOMBRE y MATRICULA)
-- El email debe ser el mismo con el que se crea su cuenta en
-- Authentication → Users:  MATRICULA@hgz02.sigaf.mx
-- -------------------------------------------------------------------
insert into administradores (nombre, cargo, email, matricula)
select 'NOMBRE DEL SUBDIRECTOR', 'Subdirector Administrativo',
       'MATRICULA@hgz02.sigaf.mx', 'MATRICULA'
where not exists (select 1 from administradores where matricula = 'MATRICULA');

-- Verificación
select nombre, cargo, email, matricula, activo from administradores order by nombre;
