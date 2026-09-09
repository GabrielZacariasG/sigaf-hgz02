-- =====================================================================
-- SIGAF · Soporte para CAPTURA DE COMPRA EMERGENTE (por Orden de Compra)
-- ---------------------------------------------------------------------
-- La compra emergente se adquiere por OC, a un proveedor que varía cada
-- vez y SIN contrato formal. Como facturas.contrato_id es NOT NULL, se
-- usa el mismo esquema que Cuadro Básico: un "contrato marco por cuenta"
-- colgado de un proveedor genérico; la factura usa ese marco pero apunta
-- al PROVEEDOR REAL y guarda el número de OC.
--
-- Correr en el SQL Editor de Supabase. Es idempotente (se puede repetir).
-- =====================================================================

-- 1) Columna para el número de Orden de Compra en la factura
alter table facturas add column if not exists orden_compra text;

-- 2) Proveedor genérico para los contratos marco de Compra Emergente
insert into proveedores (razon_social)
select 'PROVEEDORES VARIOS (Compra Emergente)'
where not exists (select 1 from proveedores where razon_social = 'PROVEEDORES VARIOS (Compra Emergente)');

-- 3) Un contrato marco por CADA cuenta del capítulo "Compra Emergente".
--    Se liga a la partida cuyo capítulo es Compra Emergente (importante:
--    algunas cuentas, p. ej. 51251002 Medicinas, también existen en Cuadro
--    Básico; el join por capítulo asegura la partida correcta).
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin)
select 'CE-' || pa.cuenta_finat,
       (select id from proveedores where razon_social = 'PROVEEDORES VARIOS (Compra Emergente)' limit 1),
       pa.id,
       'Compra Emergente (por OC) · ' || pa.nombre,
       '2026-01-01'::date, '2026-12-31'::date
from partidas pa
join capitulos cap on cap.id = pa.capitulo_id
where cap.nombre = 'Compra Emergente'
  and not exists (select 1 from contratos c where c.numero_interno = 'CE-' || pa.cuenta_finat);

-- 4) Verificación: cuántos marcos quedaron
select numero_interno,
       (select nombre from partidas p where p.id = c.partida_id) as partida
from contratos c
where numero_interno like 'CE-%'
order by numero_interno;
