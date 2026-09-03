-- SIGAF · Coherencia de estatus (arregla incoherencias de la migración)
-- Problema: hay facturas con estatus_general='gasto_reflejado' (ya pagadas/reflejadas)
-- pero con firmas 'pendiente' o pedido-recepción sin 'generado'. Si el gasto ya se
-- reflejó, esos circuitos previos deberían estar completos.

-- ========== 1) DIAGNÓSTICO (corre esto primero, no cambia nada) ==========
-- Distribución de los 3 ejes: ver dónde no cuadran.
select
  f.estatus_general,
  f.estatus_firmas,
  f.estatus_pedido_recepcion,
  count(*) as n
from facturas f
group by 1,2,3
order by n desc;

-- Facturas INCOHERENTES: reflejadas pero con firmas/pedido incompletos
-- select cap.nombre capitulo, count(*)
-- from facturas f
-- join partidas p on p.id=f.partida_id
-- join capitulos cap on cap.id=p.capitulo_id
-- where f.estatus_general='gasto_reflejado'
--   and (f.estatus_firmas <> 'autorizada_admin_contrato'
--        or (cap.nombre in ('Integrales','Servicios Integrales') and f.estatus_pedido_recepcion <> 'generado'))
-- group by 1;


-- ========== 2) NORMALIZACIÓN (corre esto para arreglar) ==========
-- Silencia el trigger de historial para no ensuciar las fechas de etapa.
begin;
alter table facturas disable trigger trg_a_historial;
alter table facturas disable trigger trg_b_auto_en_revision;

-- (a) Reflejada => firmas completas.
update facturas
set estatus_firmas = 'autorizada_admin_contrato'
where estatus_general = 'gasto_reflejado'
  and estatus_firmas <> 'autorizada_admin_contrato';

-- (b) Reflejada + Integrales => pedido-recepción generado.
update facturas f
set estatus_pedido_recepcion = 'generado'
from partidas p
join capitulos cap on cap.id = p.capitulo_id
where f.partida_id = p.id
  and cap.nombre in ('Integrales','Servicios Integrales')
  and f.estatus_general = 'gasto_reflejado'
  and f.estatus_pedido_recepcion <> 'generado';

-- (c) NO-Integrales (PREI I): pedido-recepción no aplica => dejarlo en 'pendiente'
--     (la UI ya lo oculta, pero deja la base limpia).
update facturas f
set estatus_pedido_recepcion = 'pendiente'
from partidas p
join capitulos cap on cap.id = p.capitulo_id
where f.partida_id = p.id
  and cap.nombre not in ('Integrales','Servicios Integrales')
  and f.estatus_pedido_recepcion <> 'pendiente';

alter table facturas enable trigger trg_a_historial;
alter table facturas enable trigger trg_b_auto_en_revision;
commit;

-- Verificación: repetir el diagnóstico del bloque 1; ya no deben aparecer
-- combinaciones 'gasto_reflejado' con firmas/pedido incompletos.
