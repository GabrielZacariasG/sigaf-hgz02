-- SIGAF · Registro de oficios emitidos (envío a pago / devolución) con folio automático.
-- El sistema asigna el consecutivo por tipo y año: SIGAFENVTP0001/2026, SIGAFDEV0001/2026, etc.
begin;

create table if not exists oficios (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null,               -- 'envio_pago' | 'devolucion' | 'envio_servicio'
  folio        text not null unique,        -- SIGAF-EP-0001/2026
  anio         integer not null,
  consecutivo  integer not null,
  destinatario text,                         -- OOAD / proveedor / jefe de servicio
  total        numeric(14,2),
  factura_ids  uuid[] not null default '{}',
  motivo       text,                         -- causa (solo devolución)
  created_at   timestamptz not null default now(),
  unique (tipo, anio, consecutivo)
);
alter table oficios enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='oficios' and policyname='of_select') then
    create policy of_select on oficios for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename='oficios' and policyname='of_write') then
    create policy of_write on oficios for all using (auth.uid() is not null) with check (auth.uid() is not null);
  end if;
end $$;

commit;

-- Verifica: select tipo, folio, anio, consecutivo, created_at from oficios order by created_at desc;
