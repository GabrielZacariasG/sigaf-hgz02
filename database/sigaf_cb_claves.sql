-- =====================================================================
-- SIGAF · Catálogo de CLAVES de cuadro básico (para Compra Emergente)
-- ---------------------------------------------------------------------
-- Reproduce el cruce que hacían en la cédula: al teclear la CLAVE del
-- producto, el sistema resuelve descripción + cuenta (PREI) + centro de
-- costos (CC). El mapa partida SAI -> cuenta PREI -> CC es 1:1 (derivado
-- de la hoja cb de la cédula) y ya viene denormalizado en el CSV.
--
-- PASO 1 (este archivo): crear la tabla y las columnas nuevas de factura.
-- PASO 2 (Table Editor): importar el CSV  Downloads/cb_claves.csv
--         a la tabla cb_claves (33,799 filas). Ver instrucciones abajo.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

-- 1) Catálogo de claves (llave = clave con formato 010.000.0265.0000)
create table if not exists cb_claves (
    clave           text primary key,
    descripcion     text,
    partida_sai     text,           -- partida presupuestal SAI (4 díg, ej. 0301)
    cuenta_prei     text,           -- cuenta PREI (ej. 51251002) = marco CE-51251002
    centro_costo    text,           -- CC (ej. 200223)
    precio          numeric(14,4)   -- precio de referencia del artículo
);

-- 2) Columnas nuevas en factura: clave capturada y su centro de costos.
--    (cr_contrarecibo y orden_compra ya existen.)
alter table facturas add column if not exists clave_cbi    text;
alter table facturas add column if not exists centro_costo text;

-- 3) Lectura pública del catálogo (para el autollenado en captura)
alter table cb_claves enable row level security;
drop policy if exists cb_claves_select on cb_claves;
create policy cb_claves_select on cb_claves for select using (auth.uid() is not null);

-- =====================================================================
-- IMPORTAR EL CSV (Downloads/cb_claves.csv):
--   1. Supabase → Table Editor → tabla  cb_claves
--   2. Botón  Insert ▸ Import data from CSV
--   3. Selecciona  cb_claves.csv  (los encabezados empatan con las columnas)
--   4. Import. Deben quedar 33,799 filas.
-- Verificación:
--   select count(*) as claves,
--          count(cuenta_prei) as con_cuenta_cc
--   from cb_claves;         -- esperado: 33799 y 24535
-- =====================================================================
