-- =====================================================================
-- SIGAF · Alta del contrato 050GYR032N09226-163-00 (Integrales)
-- REACTIVOS Y QUIMICOS, S.A. DE C.V. — Servicio Médico Integral de
-- HEMODIÁLISIS INTERNA (09/oct–31/dic 2026).
--   Invitación IA-50-GYR-050GYR032-N-92-2026 · se formaliza 29/oct/2026.
--   Mín $3,300,658.00 · Máx $8,248,866.00 · IVA 16%.
--   Precio unitario: $397.00 por SESIÓN (mín 8,314 / máx 20,778 sesiones).
-- Usa la MISMA partida/cuenta que el contrato de hemodiálisis que ya tiene
-- REACTIVOS (050GYR032N13825-182-00). Idempotente. Correr en SQL Editor.
-- =====================================================================
begin;

-- 1) Proveedor REACTIVOS Y QUIMICOS (solo si no existe ninguno)
insert into proveedores (razon_social)
select 'REACTIVOS Y QUIMICOS S.A. DE C.V.'
where not exists (select 1 from proveedores where razon_social ilike '%REACTIVOS Y QUIMICOS%');

-- 2) Contrato (si no existe) — toma la partida del contrato de hemodiálisis existente
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato,
                       adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo)
select '050GYR032N09226-163-00',
       (select id from proveedores where razon_social ilike '%REACTIVOS Y QUIMICOS%'
          order by (select count(*) from facturas f where f.proveedor_id = proveedores.id) desc limit 1),
       (select partida_id from contratos where numero_interno = '050GYR032N13825-182-00' limit 1),
       'Dra. María Josefina Rodal Díaz',
       'Servicio Médico Integral de Hemodiálisis Interna (09/oct–31/dic 2026)',
       date '2026-10-09', date '2026-12-31', 3300658.00, 8248866.00
where not exists (select 1 from contratos where numero_interno = '050GYR032N09226-163-00');

-- 3) Concepto único — $397.00 por sesión
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id, 'Sesión de hemodiálisis interna', 397.00, 1
from contratos c
where c.numero_interno = '050GYR032N09226-163-00'
  and not exists (select 1 from contrato_servicios cs where cs.contrato_id = c.id);

-- 4) Verificación
select c.numero_interno, p.razon_social, pa.cuenta_finat, ca.nombre as capitulo,
       c.vigencia_inicio, c.vigencia_fin,
       to_char(c.monto_minimo,'FM999,999,999.00') as min, to_char(c.monto_maximo,'FM999,999,999.00') as max,
       (select count(*) from contrato_servicios cs where cs.contrato_id = c.id) as conceptos,
       (select precio_unitario from contrato_servicios cs where cs.contrato_id = c.id limit 1) as precio
from contratos c
join proveedores p on p.id = c.proveedor_id
join partidas pa on pa.id = c.partida_id
join capitulos ca on ca.id = pa.capitulo_id
where c.numero_interno = '050GYR032N09226-163-00';

commit;
