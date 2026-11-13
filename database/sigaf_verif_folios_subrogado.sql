-- SIGAF · Verificación de la carga del Avance SMS (folios de subrogados).
-- Correr DESPUÉS de subir el Excel en "Cargar reportes".

-- 1) Totales por estado (facturado = atrapado / devengo / cancelado):
select
  case when factura_id is not null or nullif(trim(factura_txt), '') is not null then 'facturado'
       when cancelado then 'cancelado'
       else 'devengo' end                      as estado,
  count(*)                                       as folios,
  sum(importe)                                   as importe
from subrogados_folios
group by 1
order by 1;

-- 2) Devengo por contrato (lo que falta facturar):
select coalesce(c.numero_interno, sf.contrato_txt) as contrato,
       count(*) as folios_devengo,
       sum(sf.importe) as importe_devengo
from subrogados_folios sf
left join contratos c on c.id = sf.contrato_id
where sf.factura_id is null
  and nullif(trim(sf.factura_txt), '') is null
  and sf.cancelado = false
group by 1
order by importe_devengo desc;

-- 3) ¿Quedaron folios sin contrato reconocido? (texto del Excel que no empató)
select contrato_txt, count(*) folios, sum(importe) importe
from subrogados_folios
where contrato_id is null
group by contrato_txt
order by folios desc;
