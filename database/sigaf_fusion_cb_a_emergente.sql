-- =====================================================================
-- SIGAF · FUSIÓN "Cuadro Básico" -> "Compra Emergente"
-- ---------------------------------------------------------------------
-- Decisión del usuario (2026-09-09): Cuadro Básico y Compra Emergente son
-- lo mismo; se conserva "Compra Emergente" como el capítulo bueno.
--
-- Este script mueve las facturas que hoy están en Cuadro Básico hacia
-- Compra Emergente (mismo número de cuenta), reapuntando capítulo, partida
-- y contrato al marco CE- correspondiente, y luego retira los marcos CB-.
--
-- ⚠️ Correr DESPUÉS de sigaf_compra_emergente.sql (que crea los marcos CE-).
-- Es idempotente y no borra facturas. Correr en el SQL Editor de Supabase.
-- =====================================================================

-- 1) Reapuntar las facturas de Cuadro Básico -> Compra Emergente (por cuenta)
update facturas f
set capitulo_id = cef.capitulo_id,
    partida_id  = cef.partida_id,
    contrato_id = cef.contrato_id
from (
  select f2.id as factura_id,
         cepa.capitulo_id,
         cepa.id  as partida_id,
         cec.id   as contrato_id
  from facturas f2
  join partidas  cbpa  on cbpa.id = f2.partida_id
  join capitulos cbcap on cbcap.id = cbpa.capitulo_id and cbcap.nombre = 'Cuadro Básico'
  join partidas  cepa  on cepa.cuenta_finat = cbpa.cuenta_finat
  join capitulos cecap on cecap.id = cepa.capitulo_id and cecap.nombre = 'Compra Emergente'
  join contratos cec   on cec.numero_interno = 'CE-' || cepa.cuenta_finat
) cef
where f.id = cef.factura_id;

-- 2) (Opcional) Retirar los contratos marco CB- que ya quedaron sin facturas
delete from contratos c
where c.numero_interno like 'CB-%'
  and not exists (select 1 from facturas f where f.contrato_id = c.id);

-- 3) Verificación: no deben quedar facturas en Cuadro Básico
select cap.nombre as capitulo, count(*) as facturas
from facturas f
join capitulos cap on cap.id = f.capitulo_id
where cap.nombre in ('Cuadro Básico', 'Compra Emergente')
group by cap.nombre
order by cap.nombre;

-- Nota: el capítulo "Cuadro Básico" y sus partidas quedan vacíos (sin
-- facturas ni contratos). Se pueden dejar así (inofensivos) o limpiarlos
-- más adelante; no se borran aquí para no chocar con llaves foráneas.
