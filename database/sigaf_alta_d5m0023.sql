-- =====================================================================
-- SIGAF · Alta del contrato D5M0023 (faltante para recargar Area Medica)
--   Proveedor: Ana Karen Perez Alvarez · cuenta 51221001 (viveres/abarrotes)
--   Pasivo 2025. Hereda la partida de su hermano D5M0013 (mismo capitulo).
-- Idempotente. Correr ANTES de sigaf_recarga_area_medica.sql
-- =====================================================================

-- Proveedor (si no existe)
insert into proveedores (razon_social)
select 'Ana Karen Perez Alvarez'
where not exists (select 1 from proveedores where razon_social ilike 'ana karen perez alvarez');

-- Contrato
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin)
select 'D5M0023',
       (select id from proveedores where razon_social ilike 'ana karen perez alvarez' limit 1),
       (select partida_id from contratos where numero_interno='D5M0013' limit 1),
       'DRA. HILDA MÓNICA LOPEZ',
       'Víveres/abarrotes (pasivo 2025)',
       '2025-01-01'::date, '2025-12-31'::date
where not exists (select 1 from contratos where numero_interno='D5M0023');

-- Verificacion
select c.numero_interno,
       (select razon_social from proveedores p where p.id=c.proveedor_id) as proveedor,
       (select cuenta_finat from partidas pa where pa.id=c.partida_id) as cuenta,
       (select cap.nombre from partidas pa join capitulos cap on cap.id=pa.capitulo_id where pa.id=c.partida_id) as capitulo
from contratos c where c.numero_interno='D5M0023';
