-- SIGAF · Alta de 2 contratos de ARRENDAMIENTO DE EQUIPAMIENTO 2026
--   050GYR032N02826-084-00  ACE MEDICAL, S.A. de C.V.  (SAI S6M0080)
--   050GYR032N02826-078-00  MANPREC, S.A. de C.V.      (SAI S6M0085)
-- Partida: cuenta_finat 51321003 (arrendamiento de equipo médico) — ya existe.
-- Vigencia: 2026-05-23 a 2026-12-31. Admin del contrato: Ing. Aldo Gabriel Ponce Serna.
-- Precios = "precio ofertado" (renta unitaria mensual) del cuerpo del contrato / Anexo 1.
-- Idempotente: se puede correr varias veces sin duplicar.
begin;

-- 1) Proveedores
insert into proveedores (razon_social) select 'ACE MEDICAL, S.A. de C.V.'
  where not exists (select 1 from proveedores where razon_social='ACE MEDICAL, S.A. de C.V.');
insert into proveedores (razon_social) select 'MANPREC, S.A. de C.V.'
  where not exists (select 1 from proveedores where razon_social='MANPREC, S.A. de C.V.');

-- 2) Contratos
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo, comentarios)
select '050GYR032N02826-084-00',
  (select id from proveedores where razon_social='ACE MEDICAL, S.A. de C.V.' limit 1),
  (select id from partidas where cuenta_finat='51321003' limit 1),
  'Ing. Aldo Gabriel Ponce Serna',
  'Arrendamiento de equipamiento 2026 — cama camilla radiotransparente',
  '2026-05-23'::date, '2026-12-31'::date, 2430000.00, 4860000.00,
  'SAI S6M0080. Licitación LA-50-GYR-050GYR032-N-28-2026. Partida 15 (cama camilla radiotransparente).'
where not exists (select 1 from contratos where numero_interno='050GYR032N02826-084-00');

insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo, comentarios)
select '050GYR032N02826-078-00',
  (select id from proveedores where razon_social='MANPREC, S.A. de C.V.' limit 1),
  (select id from partidas where cuenta_finat='51321003' limit 1),
  'Ing. Aldo Gabriel Ponce Serna',
  'Arrendamiento de equipamiento 2026 — lámparas, refrigeradores, estufa, congelador y microscopio',
  '2026-05-23'::date, '2026-12-31'::date, 4419848.00, 8839696.00,
  'SAI S6M0085. Licitación LA-50-GYR-050GYR032-N-28-2026. Partidas 2,3,4,6,9,11,16.'
where not exists (select 1 from contratos where numero_interno='050GYR032N02826-078-00');

-- 3) contrato_servicios (renta unitaria mensual por equipo)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('CAMA CAMILLA RADIOTRANSPARENTE', 607500.00)
) as v(servicio, precio)
join contratos ct on ct.numero_interno = '050GYR032N02826-084-00'
on conflict (contrato_id, nombre_servicio) do update set precio_unitario = excluded.precio_unitario;

insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('LÁMPARA DE HENDIDURA', 360000.00),
  ('LÁMPARA QUIRÚRGICA DOBLE DE LED', 160000.00),
  ('REFRIGERADOR VERTICAL PARA LABORATORIO 20 PIES CÚBICOS', 100477.50),
  ('ESTUFA BACTERIOLÓGICA DE 75 CM CON DOBLE PUERTA', 10541.67),
  ('CONGELADOR HORIZONTAL DE REFRIGERANTES PARA VACUNAS', 2497.83),
  ('REFRIGERADOR PARA VACUNAS', 31445.00),
  ('MICROSCOPIO QUIRÚRGICO OFTALMOLÓGICO BÁSICO', 440000.00)
) as v(servicio, precio)
join contratos ct on ct.numero_interno = '050GYR032N02826-078-00'
on conflict (contrato_id, nombre_servicio) do update set precio_unitario = excluded.precio_unitario;

commit;

-- Verificación:
-- select ct.numero_interno, p.razon_social, ct.vigencia_inicio, ct.vigencia_fin, ct.monto_maximo,
--        (select count(*) from contrato_servicios cs where cs.contrato_id=ct.id) as servicios
-- from contratos ct join proveedores p on p.id=ct.proveedor_id
-- where ct.numero_interno in ('050GYR032N02826-084-00','050GYR032N02826-078-00');
