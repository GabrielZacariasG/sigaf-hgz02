-- SIGAF · Limpieza: borrar los 2 conceptos "placeholder" del contrato IGSA 154-00
-- (quedaron de la primera versión del alta, antes de cargar el Acta de Fallo).
-- Deja solo los 444 estudios reales.
begin;

delete from contrato_servicios cs
using contratos c
where cs.contrato_id = c.id
  and c.numero_interno = '050GYR032N08226-154-00'
  and (cs.nombre_servicio like 'Partida 1 ·%' or cs.nombre_servicio like 'Partida 2 ·%');

-- Verificación (debe decir 444):
select (select count(*) from contrato_servicios cs
        join contratos c on c.id = cs.contrato_id
        where c.numero_interno = '050GYR032N08226-154-00') as estudios;

commit;
