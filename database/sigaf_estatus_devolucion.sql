-- SIGAF · Nuevo estatus "devuelta al proveedor" + motivo de la devolución.
-- IMPORTANTE: 'alter type ... add value' NO puede ir dentro de una transacción,
-- por eso NO se usa begin/commit. Corre el archivo completo tal cual.

-- 1) Nuevo valor del enum general
alter type estatus_general add value if not exists 'devuelta_proveedor';

-- 2) Columnas para guardar la causa y la fecha de devolución
alter table facturas add column if not exists motivo_devolucion text;
alter table facturas add column if not exists fecha_devolucion  timestamptz;

-- Verifica:
-- select unnest(enum_range(null::estatus_general));
