-- =====================================================================
-- SIGAF · Corrección del contrato 050GYR032N07426-133-00
-- Era provisional (se creó con la cuenta del 182-00 y sin conceptos, para
-- recuperar MTY26760). El PDF real revela que es SERVICIO MÉDICO INTEGRAL DE
-- HEMODIÁLISIS INTERNA (REACTIVOS Y QUIMICOS), cuenta 51331014, 08/ago–30/sep.
--   Mín $2,277,192.00 · Máx $5,499,244.00 · $397.00 por sesión.
-- Se corrige cuenta/objeto/vigencia/montos, se carga el concepto y se
-- realinea la cuenta de las facturas del contrato (MTY26760).
-- Correr en el SQL Editor de Supabase. Transaccional.
-- =====================================================================

begin;

-- 1) Partida cuenta 51331014 en Integrales (si no existe)
insert into partidas (capitulo_id, cuenta_prei, cuenta_finat, nombre)
select ca.id, '51331014', '51331014', 'Servicios integrales · hemodiálisis interna'
from capitulos ca
where ca.nombre = 'Integrales'
  and not exists (select 1 from partidas p where p.capitulo_id = ca.id
                  and (p.cuenta_prei = '51331014' or p.cuenta_finat = '51331014'));

-- 2) Corregir el contrato (cuenta real, objeto, vigencia y montos)
update contratos c
set partida_id = (select p.id from partidas p join capitulos ca on ca.id = p.capitulo_id
                  where ca.nombre = 'Integrales' and (p.cuenta_finat = '51331014' or p.cuenta_prei = '51331014') limit 1),
    adquisicion_servicio = 'Servicio médico integral de hemodiálisis interna (08/ago–30/sep 2026)',
    vigencia_inicio = date '2026-08-08',
    vigencia_fin    = date '2026-09-30',
    monto_minimo = 2277192.00,
    monto_maximo = 5499244.00
where c.numero_interno = '050GYR032N07426-133-00';

-- 3) Realinear cuenta/capítulo de las facturas del contrato (MTY26760)
update facturas f
set partida_id = c.partida_id, capitulo_id = pa.capitulo_id
from contratos c join partidas pa on pa.id = c.partida_id
where c.numero_interno = '050GYR032N07426-133-00' and f.contrato_id = c.id;

-- 4) Concepto único: sesión de hemodiálisis ($397.00), si no existe
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id, 'SERVICIO MÉDICO INTEGRAL DE HEMODIÁLISIS INTERNA (sesión)', 397.00, 1
from contratos c
where c.numero_interno = '050GYR032N07426-133-00'
  and not exists (select 1 from contrato_servicios cs where cs.contrato_id = c.id);

-- 5) Verificación
select c.numero_interno, p.razon_social, pa.cuenta_finat, ca.nombre as capitulo,
       c.vigencia_inicio, c.vigencia_fin,
       to_char(c.monto_minimo,'FM999,999,999.00') as min, to_char(c.monto_maximo,'FM999,999,999.00') as max,
       (select count(*) from contrato_servicios cs where cs.contrato_id = c.id) as conceptos,
       (select precio_unitario from contrato_servicios cs where cs.contrato_id = c.id limit 1) as precio
from contratos c
join proveedores p on p.id = c.proveedor_id
join partidas pa on pa.id = c.partida_id
join capitulos ca on ca.id = pa.capitulo_id
where c.numero_interno = '050GYR032N07426-133-00';

commit;
