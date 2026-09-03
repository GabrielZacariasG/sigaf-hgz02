-- SIGAF · Diagnóstico: ¿qué contratos NO tienen servicios cargados?
-- Corre cada bloque por separado en el SQL Editor de Supabase.
-- Relación capítulo: contratos.partida_id -> partidas.capitulo_id -> capitulos.nombre

-- 1) RESUMEN por capítulo: contratos con servicios vs sin servicios.
select
  cap.nombre                                        as capitulo,
  count(*)                                          as contratos_total,
  count(*) filter (where cs.n > 0)                  as con_servicios,
  count(*) filter (where cs.n is null)              as sin_servicios
from contratos c
join partidas  p   on p.id   = c.partida_id
join capitulos cap on cap.id = p.capitulo_id
left join (
  select contrato_id, count(*) n
  from contrato_servicios
  group by contrato_id
) cs on cs.contrato_id = c.id
group by cap.nombre
order by sin_servicios desc, capitulo;


-- 2) DETALLE: contratos SIN servicios (los que faltan por cargar).
select
  cap.nombre            as capitulo,
  c.numero_interno,
  c.adquisicion_servicio,
  pr.razon_social       as proveedor
from contratos c
join partidas  p   on p.id   = c.partida_id
join capitulos cap on cap.id = p.capitulo_id
left join proveedores pr on pr.id = c.proveedor_id
left join contrato_servicios cs on cs.contrato_id = c.id
where cs.id is null
order by cap.nombre, c.numero_interno;
