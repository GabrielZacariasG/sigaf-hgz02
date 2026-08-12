-- =====================================================================
-- SIGAF · Fase 3 — Poblar cuenta_finat en las partidas de Integrales
-- =====================================================================
-- Para que cada cuenta enlace con su presupuesto (dispo) en la Pantalla 6.
-- Resuelve la partida vía un contrato que YA existe (Grupo A), y solo
-- escribe si cuenta_finat está null (no pisa lo ya puesto).
-- Seguro de re-correr. No incluye B8/B10 (sus contratos aún no se migran).
-- =====================================================================
begin;

update partidas p
set cuenta_finat = v.cuenta
from (values
  ('050GYR988T00925-001-00', '51251012'),  -- B1 soluciones (BAXTER/PISA)
  ('050GYR032N03825-055-00', '51331013'),  -- B3 laboratorio + banco sangre (IGSA)
  ('050GYR032N13825-182-00', '51331014'),  -- B4 hemodiálisis intramuros (REACTIVOS)
  ('050GYR032N02926-051-00', '51331015'),  -- B5 cirugía mínima invasiva (INTERMET)
  ('050GYR032N12326-005-00', '51331017'),  -- B6 digitalización e imagen (RELIABLE)
  ('050GYR032N13625-179-00', '51331020'),  -- B7 banco de sangre (BIODIST)
  ('050GYR032N14425-188-00', '51331024')   -- B9 mezclas (PRODUCTOS HOSPITALARIOS)
) as v(numero_interno, cuenta)
join contratos c on c.numero_interno = v.numero_interno
where p.id = c.partida_id and p.cuenta_finat is null;

-- Verificación (antes de commit): las partidas con su cuenta ya poblada
--   select distinct p.cuenta_finat, p.nombre
--   from partidas p join contratos c on c.partida_id = p.id
--   where p.cuenta_finat is not null order by 1;
commit;
