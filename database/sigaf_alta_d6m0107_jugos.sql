-- =====================================================================
-- SIGAF · Alta del contrato D6M0107 (Víveres 2026, Partida 7 - JUGOS)
--   Núm. contrato: 050GYR032N08426-149-00 · Reg. SAI: D6M0107
--   Proveedor: Jesús Manuel Romo Alba (RFC ROAJ600629RQ5)
--   Capítulo: Área Médica · cuenta 51221001 (víveres) — ya existe
--   Administrador del contrato: Dra. Hilda Mónica López (Coord. Prevención y
--     Atención a la Salud)
--   Vigencia: 05/sep/2026 – 31/dic/2026
--   Montos (antes de IVA): mín $62,137.28 · máx $155,343.19 · IVA 16%
--   2 renglones (partida 7), precio unitario $16.00 c/u.
-- Datos tomados del contrato PDF. Idempotente. Correr en el SQL Editor.
-- =====================================================================
begin;

-- 1) Proveedor (si no existe) — se reutiliza el ya registrado en víveres
insert into proveedores (razon_social)
select 'Jesús Manuel Romo Alba'
where not exists (select 1 from proveedores where razon_social = 'Jesús Manuel Romo Alba');

-- 2) Partida cuenta 51221001 (Área Médica · víveres) — normalmente ya existe
insert into partidas (capitulo_id, cuenta_finat, nombre)
select (select id from capitulos where nombre = 'Área Médica'),
       '51221001', 'Víveres (Abarrotes, Leches, Frutas y Verduras)'
where not exists (select 1 from partidas where cuenta_finat = '51221001');

-- 3) Contrato (si no existe)
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato,
                       adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo)
select 'D6M0107',
       (select id from proveedores where razon_social = 'Jesús Manuel Romo Alba' limit 1),
       (select id from partidas where cuenta_finat = '51221001' limit 1),
       'DRA. HILDA MÓNICA LOPEZ',
       'Adquisición de víveres 2026 (Partida 7 - Jugos) · contrato 050GYR032N08426-149-00',
       date '2026-09-05', date '2026-12-31', 62137.28, 155343.19
where not exists (select 1 from contratos where numero_interno = 'D6M0107');

-- 4) Conceptos (renglones de la partida 7) — precio unitario $16.00 c/u
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id, v.nombre, v.precio, v.orden
from   contratos c
cross  join (values
  ('Bebida pasteurizada de manzana (500 ml) — renglón 242', 16.00, 1),
  ('Jugo de frutas ultrapasteurizado (250 ml) — renglón 244', 16.00, 2)
) as v(nombre, precio, orden)
where  c.numero_interno = 'D6M0107'
  and  not exists (
    select 1 from contrato_servicios cs
    where cs.contrato_id = c.id and cs.nombre_servicio = v.nombre
  );

-- 5) Verificación
select c.numero_interno, p.razon_social, pa.cuenta_finat, ca.nombre as capitulo,
       c.vigencia_inicio, c.vigencia_fin,
       to_char(c.monto_minimo,'FM999,999,999.00') as min,
       to_char(c.monto_maximo,'FM999,999,999.00') as max,
       (select count(*) from contrato_servicios cs where cs.contrato_id = c.id) as conceptos
from   contratos c
join   proveedores p on p.id = c.proveedor_id
join   partidas pa   on pa.id = c.partida_id
join   capitulos ca  on ca.id = pa.capitulo_id
where  c.numero_interno = 'D6M0107';

select nombre_servicio, precio_unitario, orden
from   contrato_servicios
where  contrato_id = (select id from contratos where numero_interno = 'D6M0107')
order  by orden;

commit;
