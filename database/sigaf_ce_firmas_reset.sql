-- =====================================================================
-- SIGAF · Compra Emergente NO lleva firma de Admin de Contrato.
-- Baja el circuito de firmas de las CE que quedaron en admin de contrato
-- (migradas de la cédula en "AC", o avanzadas por error) a la última etapa
-- que sí aplica: 'autorizada_servicio'. No afecta pagos: las pagadas siguen
-- pagadas (el eje de firmas es solo de seguimiento).
-- Correr en el SQL Editor de Supabase.
-- =====================================================================

update facturas f
set estatus_firmas = 'autorizada_servicio'
from capitulos c
where c.id = f.capitulo_id
  and c.nombre = 'Compra Emergente'
  and f.estatus_firmas in ('envio_firmas_admin_contrato', 'autorizada_admin_contrato');

-- Verificación: distribución de firmas en Compra Emergente (ya no debe haber
-- admin de contrato)
select f.estatus_firmas, count(*) as cuantas
from facturas f
join capitulos c on c.id = f.capitulo_id
where c.nombre = 'Compra Emergente' and f.anulada = false
group by f.estatus_firmas
order by cuantas desc;
