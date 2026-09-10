-- =====================================================================
-- SIGAF · Agregar la FECHA DE LA FACTURA a la captura (todos los capitulos)
-- Nueva columna nullable; no afecta datos ni capturas existentes.
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================
alter table facturas add column if not exists fecha_factura date;
