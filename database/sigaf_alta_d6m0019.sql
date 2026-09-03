-- SIGAF · Alta del contrato D6M0019 (Víveres 2026, Partida 5 - Leche)
--   Nº completo: 050GYR032N14725-191-00 · Proveedor: ANA KAREN PEREZ ALVAREZ (persona física)
--   Catálogo (5 leches) leído del PDF; precios PRECIO UNITARIO SIN IVA.
--   Partida heredada del contrato de leches ya existente D6M0034 (mismo grupo víveres, Área Médica).
-- Idempotente. Corre en el SQL Editor de Supabase.
begin;

-- 1) Proveedor (persona física) — alta si no existe
insert into proveedores (razon_social)
select 'ANA KAREN PEREZ ALVAREZ'
where not exists (
  select 1 from proveedores where upper(razon_social) = 'ANA KAREN PEREZ ALVAREZ'
);

-- 2) Contrato D6M0019 — alta si no existe (partida tomada de D6M0034)
insert into contratos
  (numero_interno, proveedor_id, partida_id, administrador_contrato,
   adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo, comentarios)
select
  'D6M0019',
  (select id from proveedores where upper(razon_social) = 'ANA KAREN PEREZ ALVAREZ' limit 1),
  (select partida_id from contratos where numero_interno = 'D6M0034' limit 1),
  null,
  'Adquisición de víveres 2026 (Partida 5 - Leche)',
  date '2026-01-01', date '2026-12-31',
  100000.00, 250000.00,
  'Alta 2026. Nº completo 050GYR032N14725-191-00. Reg SAI D6M0019.'
where not exists (select 1 from contratos where numero_interno = 'D6M0019')
  and exists     (select 1 from contratos where numero_interno = 'D6M0034');  -- garantiza partida válida

-- 3) Catálogo: 5 leches (precio unitario SIN IVA)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio
from (values
  ('LECHE ENTERA DESLACTOSADA ULTRAPASTEURIZADA (HOSPITAL)',        29.00),
  ('LECHE ENTERA ULTRAPASTEURIZADA (HOSPITAL)',                     29.00),
  ('LECHE ENTERA PASTEURIZADA (HOSPITAL)',                          13.00),
  ('LECHE DESCREMADA ULTRAPASTEURIZADA (HOSPITAL)',                 29.00),
  ('LECHE ULTRAPASTEURIZADA PARCIALMENTE DESCREMADA (HOSPITAL)',    29.00)
) as v(servicio, precio)
join contratos ct on ct.numero_interno = 'D6M0019'
where not exists (
  select 1 from contrato_servicios cs
  where cs.contrato_id = ct.id and cs.nombre_servicio = v.servicio
);

commit;

-- Verificación:
-- select c.numero_interno, pr.razon_social, cs.nombre_servicio, cs.precio_unitario
-- from contratos c join proveedores pr on pr.id=c.proveedor_id
-- left join contrato_servicios cs on cs.contrato_id=c.id
-- where c.numero_interno='D6M0019';
