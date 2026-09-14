-- =====================================================================
-- SIGAF · Alta del contrato 050GYR032N07026-147-00 (Integrales)
-- RELIABLE DE MÉXICO, S.A. DE C.V. — Servicio médico integral para la
-- digitalización, post procesamiento, almacenamiento y distribución de
-- estudios médicos (16/ago–31/dic 2026).
--   Cuenta: 51331017 · Mín $4,913,794.00 · Máx $12,284,482.76
--   Concepto único: SERVICIO ... ESTUDIOS MÉDICOS = $81.00 por estudio.
--   Administrador: Ing. Aldo Gabriel Ponce Serna.
-- Datos tomados del contrato PDF. Idempotente. Correr en SQL Editor.
-- =====================================================================

begin;

-- 1) Proveedor (si no existe)
insert into proveedores (razon_social)
select 'RELIABLE DE MÉXICO, S.A. DE C.V.'
where not exists (select 1 from proveedores where razon_social = 'RELIABLE DE MÉXICO, S.A. DE C.V.');

-- 2) Partida cuenta 51331017 en capítulo Integrales (si no existe)
insert into partidas (capitulo_id, cuenta_prei, cuenta_finat, nombre)
select ca.id, '51331017', '51331017', 'Servicios integrales · digitalización de estudios médicos'
from capitulos ca
where ca.nombre = 'Integrales'
  and not exists (
    select 1 from partidas p
    where p.capitulo_id = ca.id and (p.cuenta_prei = '51331017' or p.cuenta_finat = '51331017')
  );

-- 3) Contrato (si no existe)
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato,
                       adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo)
select '050GYR032N07026-147-00',
       (select id from proveedores where razon_social = 'RELIABLE DE MÉXICO, S.A. DE C.V.' limit 1),
       (select p.id from partidas p join capitulos ca on ca.id = p.capitulo_id
        where ca.nombre = 'Integrales' and (p.cuenta_finat = '51331017' or p.cuenta_prei = '51331017') limit 1),
       'Ing. Aldo Gabriel Ponce Serna',
       'Servicio médico integral para la digitalización, post procesamiento, almacenamiento y distribución de estudios médicos (16/ago–31/dic 2026)',
       date '2026-08-16', date '2026-12-31', 4913794.00, 12284482.76
where not exists (select 1 from contratos where numero_interno = '050GYR032N07026-147-00');

-- 4) Concepto único ($81.00 por estudio)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id,
       'SERVICIO MÉDICO INTEGRAL PARA LA DIGITALIZACIÓN, POST PROCESAMIENTO, ALMACENAMIENTO Y DISTRIBUCIÓN DE ESTUDIOS MÉDICOS',
       81.00, 1
from contratos c
where c.numero_interno = '050GYR032N07026-147-00'
  and not exists (
    select 1 from contrato_servicios cs
    where cs.contrato_id = c.id and cs.nombre_servicio like 'SERVICIO MÉDICO INTEGRAL%'
  );

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
where c.numero_interno = '050GYR032N07026-147-00';

commit;
