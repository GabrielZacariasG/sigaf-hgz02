-- =====================================================================
-- SIGAF · Cierre por disponibilidad
--   1) Foto DIARIA de la disponibilidad (una fila por fecha+cuenta) para
--      poder comparar dia contra dia.
--   2) fecha_pago en facturas (para el cierre manual).
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

create table if not exists disponibilidad_diaria (
  fecha            date not null,
  cuenta_finat     text not null,
  presupuesto      numeric(16,2) default 0,
  gasto            numeric(16,2) default 0,
  comprometido     numeric(16,2) default 0,
  precomprometido  numeric(16,2) default 0,
  disponible       numeric(16,2) default 0,
  cargado_at       timestamptz not null default now(),
  primary key (fecha, cuenta_finat)
);

alter table disponibilidad_diaria enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='disponibilidad_diaria' and policyname='dd_select') then
    create policy dd_select on disponibilidad_diaria for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename='disponibilidad_diaria' and policyname='dd_write') then
    create policy dd_write on disponibilidad_diaria for all using (auth.uid() is not null) with check (auth.uid() is not null);
  end if;
end $$;

-- Fecha de pago en la factura (para el trámite manual de pago)
alter table facturas add column if not exists fecha_pago date;
