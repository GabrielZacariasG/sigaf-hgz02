-- =====================================================================
-- SIGAF · Pasivos — esquema + backfill retroactivo del Lote 1
-- =====================================================================
-- Agrega a facturas:
--   es_pasivo          boolean  NOT NULL default false
--   mes_presupuestal   integer  NOT NULL (1..12)   -- periodo del SERVICIO
--   anio_presupuestal  integer  NOT NULL
-- mes_asignado/anio_asignado (existentes) = periodo de EJERCICIO (no se tocan).
-- Para facturas normales servicio = ejercicio (copia directa); en pasivo el
-- servicio es anterior. Check flexible: solo exige presupuestal < asignado
-- CUANDO es_pasivo = true.
--
-- No dispara trg_a_historial (no cambia estatus_*). Patrón expand: columnas
-- nullable -> backfill de TODAS las filas -> SET NOT NULL + checks.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PRE-CHECK (correr ANTES, standalone)
-- ---------------------------------------------------------------------
-- (a) Las columnas nuevas NO deben existir todavía  -> esperado: 0 filas
select column_name
from information_schema.columns
where table_name = 'facturas'
  and column_name in ('es_pasivo', 'mes_presupuestal', 'anio_presupuestal');

-- (b) Estado actual de las 6 facturas pasivo (ejercicio ya migrado)
--     esperado: 036 -> 12/2025 ; 037,038,051,052,059 -> 1/2026
select folio_ingreso, folio_proveedor, mes_asignado, anio_asignado
from facturas
where folio_ingreso in (
  'HGZ2-INT-HIST-036','HGZ2-INT-HIST-037','HGZ2-INT-HIST-038',
  'HGZ2-INT-HIST-051','HGZ2-INT-HIST-052','HGZ2-INT-HIST-059')
order by folio_ingreso;

-- =====================================================================
begin;

-- 1) Columnas nuevas (presupuestal en nullable para el backfill)
alter table facturas
  add column es_pasivo         boolean not null default false,
  add column mes_presupuestal  integer,
  add column anio_presupuestal integer;

-- 2a) Backfill base: TODAS las filas -> servicio = ejercicio
update facturas
set mes_presupuestal  = mes_asignado,
    anio_presupuestal = anio_asignado;

-- 2b) Las 6 pasivo: marca + periodo de servicio (regla de mayoría de días)
update facturas f
set es_pasivo         = true,
    mes_presupuestal  = v.mes,
    anio_presupuestal = v.anio
from (values
  ('HGZ2-INT-HIST-036', 11, 2025),   -- FVR202465  26 oct - 25 nov 2025
  ('HGZ2-INT-HIST-037', 12, 2025),   -- FVR202901  26 nov - 25 dic 2025
  ('HGZ2-INT-HIST-038', 12, 2025),   -- FVR202903  26 - 31 dic 2025
  ('HGZ2-INT-HIST-051', 12, 2025),   -- MINS8367   26 nov - 25 dic 2025
  ('HGZ2-INT-HIST-052', 12, 2025),   -- MINS8568   26 - 31 dic 2025
  ('HGZ2-INT-HIST-059', 12, 2025)    -- O21605     29 nov - 24 dic 2025
) as v(folio_ingreso, mes, anio)
where f.folio_ingreso = v.folio_ingreso;

-- 3) Cerrar el expand: NOT NULL + checks (ya con datos backfilled)
alter table facturas
  alter column mes_presupuestal  set not null,
  alter column anio_presupuestal set not null,
  add constraint chk_facturas_mes_presupuestal
    check (mes_presupuestal between 1 and 12),
  add constraint chk_facturas_pasivo_anterior
    check (
      not es_pasivo
      or (anio_presupuestal * 12 + mes_presupuestal)
          < (anio_asignado   * 12 + mes_asignado)
    );

-- ---------------------------------------------------------------------
-- POST-CHECK (antes de commit)
-- ---------------------------------------------------------------------
--   -- Esperado: total con valor = todas; pasivo = 6; nulos = 0
--   select
--     count(*)                                    as total,
--     count(*) filter (where es_pasivo)           as pasivos,          -- 6
--     count(*) filter (where mes_presupuestal is null) as sin_periodo   -- 0
--   from facturas;
--
--   -- Las 6 pasivo: presupuestal (servicio) < asignado (ejercicio)
--   select folio_ingreso, es_pasivo,
--          mes_presupuestal || '/' || anio_presupuestal as presupuestal,
--          mes_asignado     || '/' || anio_asignado     as ejercicio
--   from facturas where es_pasivo order by folio_ingreso;
--
-- Si todo cuadra:  commit;   si algo no:  rollback;
commit;
