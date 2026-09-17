-- =====================================================================
-- SIGAF · Devolución al proveedor SOLICITADA POR EL SERVICIO
-- El jefe de servicio, en vez de cumplimiento/incumplimiento, puede pedir
-- la DEVOLUCIÓN al proveedor con un motivo. La factura regresa a Presupuesto
-- (sale de la bandeja del servicio) y aparece en el apartado
-- "Devoluciones solicitadas por el servicio" de Seguimiento, donde
-- Presupuesto genera rápido el oficio de devolución (con ese motivo).
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

alter table facturas add column if not exists dev_solicitada         boolean not null default false;
alter table facturas add column if not exists dev_solicitada_motivo   text;
alter table facturas add column if not exists dev_solicitada_jefe_id  uuid references jefes_servicio(id);
alter table facturas add column if not exists dev_solicitada_at        timestamptz;

create index if not exists idx_facturas_dev_solicitada on facturas (dev_solicitada) where dev_solicitada;
