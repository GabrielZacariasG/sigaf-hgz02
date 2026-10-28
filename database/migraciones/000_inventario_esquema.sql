-- =====================================================================
-- SIGAF · Fase 0 · 000 · Inventario del esquema REAL (solo lectura)
-- Fecha: 28/10/2026
--
-- Para qué: hay tablas y columnas que existen en Supabase pero cuyo CREATE no
-- está en el repositorio (ajustes_devengo, partidas.cuenta_finat, el tipo de
-- tipo_entrega). Esta consulta NO cambia nada: solo lista columnas, tipos,
-- valores por omisión, llaves y políticas, para versionarlas en el repo.
-- Cómo: SQL Editor de Supabase → Run → exportar el resultado a CSV y guardarlo
-- como database/migraciones/000_inventario_esquema_resultado.csv
-- =====================================================================
select 'columna' as tipo, c.table_name as tabla, c.column_name as nombre,
       c.data_type || coalesce('(' || c.udt_name || ')', '') as detalle,
       coalesce(c.column_default, '') as por_omision, c.is_nullable as nulo
from information_schema.columns c
where c.table_schema = 'public'
union all
select 'restriccion', tc.table_name, tc.constraint_name, tc.constraint_type, '', ''
from information_schema.table_constraints tc
where tc.table_schema = 'public'
union all
select 'politica', p.tablename, p.policyname, p.cmd, coalesce(p.qual, ''), coalesce(p.with_check, '')
from pg_policies p
where p.schemaname = 'public'
union all
select 'enum', t.typname, e.enumlabel, '', '', ''
from pg_type t join pg_enum e on e.enumtypid = t.oid
union all
select 'trigger', event_object_table, trigger_name, action_timing || ' ' || event_manipulation, action_statement, ''
from information_schema.triggers
where trigger_schema = 'public'
order by 1, 2, 3;
