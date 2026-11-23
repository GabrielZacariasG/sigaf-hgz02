-- =====================================================================
-- SIGAF · 071 · Pacientes y acompañantes por renglón de la factura
-- ---------------------------------------------------------------------
-- En las facturas de TRASLADO DE PACIENTES por contrato (autobuses,
-- cuenta 52411011) el renglón del desglose es por ciudad y su "cantidad"
-- junta pacientes y acompañantes en un solo número. Estas dos columnas
-- dejan capturar, por renglón, cuántos son pacientes y cuántos
-- acompañantes. Son informativas y opcionales; no cambian el importe.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

alter table factura_detalle add column if not exists num_pacientes integer;
alter table factura_detalle add column if not exists num_acompanantes integer;

-- Verificación: deben aparecer las dos columnas nuevas.
select column_name, data_type
from information_schema.columns
where table_name = 'factura_detalle'
  and column_name in ('num_pacientes', 'num_acompanantes')
order by column_name;
