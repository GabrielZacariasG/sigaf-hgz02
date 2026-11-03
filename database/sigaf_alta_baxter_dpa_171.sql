-- =====================================================================
-- SIGAF · Alta del contrato 050GYR032N10326-171-00 (Integrales)
-- BAXTER S.A. DE C.V. — Diálisis Peritoneal Automatizada (DPA) para
-- PACIENTES NUEVOS (01/nov–31/dic 2026).
--   Evento AA-50-GYR-050GYR032-N-103-2026 · se formaliza 13/nov/2026.
--   Mín $331,407.60 · Máx $828,519.00 · IVA 0% · P.U. $171.24 (sin IVA).
--   Unidades: HGZ No.1, No.2, No.3 (Ags. / Jesús María).
-- Usa la MISMA partida/cuenta que el DPA Nuevos anual existente
-- (050GYR988T00925-001-00). Idempotente. Correr en el SQL Editor.
-- =====================================================================
begin;

-- 1) Proveedor BAXTER (solo si no existe ninguno)
insert into proveedores (razon_social)
select 'BAXTER S.A. DE C.V.'
where not exists (select 1 from proveedores where razon_social ilike '%BAXTER%');

-- 2) Contrato (si no existe) — toma la partida del DPA Nuevos anual
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato,
                       adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo)
select '050GYR032N10326-171-00',
       (select id from proveedores where razon_social ilike '%BAXTER%'
          order by (select count(*) from facturas f where f.proveedor_id = proveedores.id) desc limit 1),
       (select partida_id from contratos where numero_interno = '050GYR988T00925-001-00' limit 1),
       'Dra. María Josefina Rodal Díaz',
       'Servicio integral de Diálisis Peritoneal Automatizada (DPA) para pacientes nuevos (01/nov–31/dic 2026)',
       date '2026-11-01', date '2026-12-31', 331407.60, 828519.00
where not exists (select 1 from contratos where numero_interno = '050GYR032N10326-171-00');

-- 3) Concepto único — P.U. $171.24 (IVA 0%)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id, 'Diálisis Peritoneal Automatizada (DPA) para pacientes nuevos', 171.24, 1
from contratos c
where c.numero_interno = '050GYR032N10326-171-00'
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
where c.numero_interno = '050GYR032N10326-171-00';

commit;
