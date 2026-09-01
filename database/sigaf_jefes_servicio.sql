-- SIGAF · Jefes de servicio (validan cumplimiento) + asignación de proveedores
-- Adelanto de estructura. La asignación jefe↔proveedor se llenará con el Excel
-- que está preparando el usuario (qué proveedores valida cada jefe).
begin;

-- 1) Catálogo de jefes de servicio
create table if not exists jefes_servicio (
  id       uuid primary key default gen_random_uuid(),
  nombre   text not null,
  jefatura text,
  email    text,
  activo   boolean not null default true,
  unique (nombre)
);
alter table jefes_servicio enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='jefes_servicio' and policyname='js_select') then
    create policy js_select on jefes_servicio for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename='jefes_servicio' and policyname='js_write') then
    create policy js_write on jefes_servicio for all using (auth.uid() is not null) with check (auth.uid() is not null);
  end if;
end $$;

-- 2) Asignación jefe ↔ proveedor (qué proveedores valida cada jefe)
create table if not exists jefe_proveedor (
  jefe_id      uuid not null references jefes_servicio(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id)    on delete cascade,
  primary key (jefe_id, proveedor_id)
);
alter table jefe_proveedor enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='jefe_proveedor' and policyname='jp_select') then
    create policy jp_select on jefe_proveedor for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename='jefe_proveedor' and policyname='jp_write') then
    create policy jp_write on jefe_proveedor for all using (auth.uid() is not null) with check (auth.uid() is not null);
  end if;
end $$;

-- 3) Dictámenes de validación (cumplimiento / incumplimiento) por factura
create table if not exists validaciones_servicio (
  id          uuid primary key default gen_random_uuid(),
  factura_id  uuid not null references facturas(id) on delete cascade,
  jefe_id     uuid references jefes_servicio(id),
  dictamen    text not null check (dictamen in ('cumplimiento','incumplimiento')),
  motivo      text,
  oficio_folio text,
  created_at  timestamptz not null default now(),
  unique (factura_id)
);
alter table validaciones_servicio enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='validaciones_servicio' and policyname='vs_select') then
    create policy vs_select on validaciones_servicio for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename='validaciones_servicio' and policyname='vs_write') then
    create policy vs_write on validaciones_servicio for all using (auth.uid() is not null) with check (auth.uid() is not null);
  end if;
end $$;

-- 4) Seed de los 10 jefes de servicio (de la lista del usuario)
insert into jefes_servicio (nombre, jefatura, email) values
  ('DRA. EURIDICE GARCIA RONQUILLO',           'Medicina Interna (M.I)', null),
  ('DR. ADRIAN MAXIMILIANO MARTELL IBARRA',    'Traumatología y Ortopedia (TYO)', null),
  ('LIC. JUAN RAMON',                          'Abasto', null),
  ('MARIAJOSE RUIZ RUVALCABA',                 'Nutrición', null),
  ('JORGE NIEVES HERNANDEZ MORENO',            'Servicios Generales', 'jorge.hernandezm@imss.gob.mx'),
  ('ROBERTO MOISES DIAZ MARTINEZ',             'Cirugía', null),
  ('FERNANDO MORENO HERNANDEZ',                'Rayos X', null),
  ('ROXANA BARAJAS CALDERA',                   'Patología', null),
  ('NOHEMI LILIANA MARQUEZ QUEZADA',           'Pediatría', null),
  ('HUGO ALEJANDRO ALVAREZ DIAZ',              'Laboratorio', null)
on conflict (nombre) do update set jefatura = excluded.jefatura, email = coalesce(excluded.email, jefes_servicio.email);

commit;

-- Cuando llegue el Excel (proveedor → jefe), la asignación se llenará así (ejemplo):
--   insert into jefe_proveedor (jefe_id, proveedor_id)
--   select j.id, p.id from jefes_servicio j, proveedores p
--   where j.nombre='DRA. EURIDICE GARCIA RONQUILLO' and p.razon_social='BAXTER, S.A. DE C.V.'
--   on conflict do nothing;
