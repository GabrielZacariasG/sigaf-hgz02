-- SIGAF · Fix: asignar ISSEA (Instituto de Servicios de Salud del Estado) a sus jefes.
-- En el Excel viene como "ISSEA" pero en la BD es "INSTITUTO DE SERVICIOS DE SALUD...".
begin;
insert into jefe_proveedor (jefe_id, proveedor_id)
select j.id, p.id
from jefes_servicio j
join proveedores p on p.razon_social ilike '%INSTITUTO DE SERVICIOS DE SALUD%'
where j.nombre in (
  'NOHEMI LILIANA MARQUEZ QUEZADA',
  'DRA. EURIDICE GARCIA RONQUILLO',
  'MARIAJOSE RUIZ RUVALCABA'
)
on conflict do nothing;
commit;

-- Detectar OTROS proveedores con facturas por validar pero SIN jefe asignado:
-- select distinct pr.razon_social
-- from facturas f
-- join proveedores pr on pr.id = f.proveedor_id
-- where f.estatus_firmas = 'envio_firmas_servicio'
--   and not exists (select 1 from jefe_proveedor jp where jp.proveedor_id = f.proveedor_id);
