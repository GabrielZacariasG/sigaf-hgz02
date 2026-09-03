-- SIGAF · Unificar proveedores DUPLICADOS (mismo nombre normalizado).
-- Normaliza: mayúsculas, sin acentos, sin puntuación/espacios (así "S.A. DE C.V."
-- y "SA DE CV" quedan iguales). Solo une los que CONCUERDAN exactamente tras normalizar.
-- Repunta facturas, contratos y jefe_proveedor al canónico y borra los duplicados.

-- ================== 0) PREVIEW (corre esto primero, no cambia nada) ==================
select
  regexp_replace(translate(upper(razon_social),'ÁÉÍÓÚÜÑÀÈÌÒÙ','AEIOUUNAEIOU'),'[^A-Z0-9]','','g') as clave,
  count(*) as repetidos,
  array_agg(razon_social order by razon_social) as nombres
from proveedores
group by 1
having count(*) > 1
order by repetidos desc, clave;


-- ================== 1) UNIFICAR (corre esto para aplicar) ==================
begin;

-- normalización + conteo de facturas por proveedor (para elegir canónico)
create temp table _pnorm on commit drop as
select p.id,
  regexp_replace(translate(upper(p.razon_social),'ÁÉÍÓÚÜÑÀÈÌÒÙ','AEIOUUNAEIOU'),'[^A-Z0-9]','','g') as k,
  (select count(*) from facturas f where f.proveedor_id = p.id) as nfac
from proveedores p;

-- canónico por grupo = el que tiene más facturas (desempate por id)
create temp table _canon on commit drop as
select k, (array_agg(id order by nfac desc, id))[1] as canonical
from _pnorm
group by k
having count(*) > 1;

-- mapa duplicado -> canónico
create temp table _map on commit drop as
select n.id as dup, c.canonical
from _pnorm n
join _canon c on c.k = n.k
where n.id <> c.canonical;

-- repuntar referencias
update facturas  f set proveedor_id = m.canonical from _map m where f.proveedor_id = m.dup;
update contratos c set proveedor_id = m.canonical from _map m where c.proveedor_id = m.dup;

-- jefe_proveedor: PK (jefe_id, proveedor_id). Primero borrar las que chocarían con el canónico,
-- luego repuntar el resto.
delete from jefe_proveedor jp using _map m
where jp.proveedor_id = m.dup
  and exists (select 1 from jefe_proveedor jp2 where jp2.jefe_id = jp.jefe_id and jp2.proveedor_id = m.canonical);
update jefe_proveedor jp set proveedor_id = m.canonical from _map m where jp.proveedor_id = m.dup;

-- borrar los duplicados (ya sin referencias)
delete from proveedores where id in (select dup from _map);

commit;

-- ================== 2) VERIFICACIÓN ==================
-- Ya no deben quedar grupos con >1:
-- select regexp_replace(translate(upper(razon_social),'ÁÉÍÓÚÜÑÀÈÌÒÙ','AEIOUUNAEIOU'),'[^A-Z0-9]','','g') k, count(*)
-- from proveedores group by 1 having count(*)>1;
