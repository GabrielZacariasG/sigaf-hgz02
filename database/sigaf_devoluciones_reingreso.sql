-- =====================================================================
-- SIGAF · Resolución de DEVOLUCIONES: reingreso (misma factura) y
--         re-factura (CFDI nuevo que sustituye a la original).
-- ---------------------------------------------------------------------
-- Reingreso  -> el MISMO registro vuelve a "en_revision"; se cuenta cuántas
--               veces ha rebotado (reingresos / fecha_reingreso).
-- Re-factura -> se crea una factura NUEVA con folio de ingreso nuevo,
--               enlazada a la original; la original se ANULA (no cuenta) y
--               queda marcada como sustituida.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

-- Contador y fecha del último reingreso (misma factura)
alter table facturas add column if not exists reingresos       integer not null default 0;
alter table facturas add column if not exists fecha_reingreso  timestamptz;

-- Enlace de re-factura (CFDI nuevo que sustituye a la original)
alter table facturas add column if not exists sustituida_por_id uuid references facturas(id);
alter table facturas add column if not exists sustituye_a_id     uuid references facturas(id);

-- Marca de anulación: la original re-facturada NO debe contar en montos/reportes
alter table facturas add column if not exists anulada boolean not null default false;

-- Índices para navegar los enlaces
create index if not exists idx_facturas_sustituida_por on facturas (sustituida_por_id);
create index if not exists idx_facturas_sustituye_a    on facturas (sustituye_a_id);
create index if not exists idx_facturas_anulada        on facturas (anulada);
