-- =====================================================================
-- SIGAF · Alta del contrato marco PERNOCTA (Subrogados)
--   Proveedor: NAYELI ALONSO OROZCO · cuenta 52411011
--   Los renglones "PERNOCTA" de la cedula (pagos a persona, sin contrato
--   formal) se cargan contra este marco. Hereda la partida de S5M0081
--   (misma cuenta/capitulo Subrogados). Idempotente.
-- Correr ANTES de sigaf_recarga_subrogados.sql
-- =====================================================================
insert into proveedores (razon_social)
select 'NAYELI ALONSO OROZCO'
where not exists (select 1 from proveedores where razon_social ilike 'nayeli alonso orozco');

insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin)
select 'PERNOCTA',
       (select id from proveedores where razon_social ilike 'nayeli alonso orozco' limit 1),
       (select partida_id from contratos where numero_interno='S5M0081' limit 1),
       'Pernocta / hospedaje (subrogado)',
       '2026-01-01'::date, '2026-12-31'::date
where not exists (select 1 from contratos where numero_interno='PERNOCTA');

-- Verificacion
select c.numero_interno,
       (select razon_social from proveedores p where p.id=c.proveedor_id) as proveedor,
       (select cuenta_finat from partidas pa where pa.id=c.partida_id) as cuenta,
       (select cap.nombre from partidas pa join capitulos cap on cap.id=pa.capitulo_id where pa.id=c.partida_id) as capitulo
from contratos c where c.numero_interno='PERNOCTA';
