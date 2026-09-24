-- =====================================================================
-- SIGAF · Alta del contrato 050GYR032N02826-083-00 (Arrendamiento 2026)
--   COMERCIALIZADORA STÄDEL DEL NORTE, S.A. DE C.V. · SAI S6M0081
--   Objeto: Arrendamiento de equipamiento 2026 (Partida 14, Craneótomo eléctrico)
--   Partida: cuenta_finat 51321003 (arrendamiento de equipo médico) — ya existe.
--   Administrador del contrato: Ing. Aldo Gabriel Ponce Serna.
--   Vigencia: 23/mayo/2026 – 31/dic/2026.
--   Montos (antes de IVA): mín $2,280,000.00 · máx $4,560,000.00 · IVA 16%.
--   1 concepto: CRANEÓTOMO ELÉCTRICO (CUCoP 53101-1902) = renta unitaria
--     mensual $570,000.00 (3 equipos · 4–8 mensuales).
--   Validación: se enruta a Conservación (Ing. Enrique González Esquivel).
-- Datos tomados del contrato PDF. Idempotente. Correr en el SQL Editor.
-- =====================================================================
begin;

-- 1) Proveedor (si no existe)
insert into proveedores (razon_social)
select 'COMERCIALIZADORA STÄDEL DEL NORTE, S.A. DE C.V.'
where not exists (select 1 from proveedores where razon_social = 'COMERCIALIZADORA STÄDEL DEL NORTE, S.A. DE C.V.');

-- 2) Contrato (si no existe)
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato,
                       adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo, comentarios)
select '050GYR032N02826-083-00',
       (select id from proveedores where razon_social = 'COMERCIALIZADORA STÄDEL DEL NORTE, S.A. DE C.V.' limit 1),
       (select id from partidas where cuenta_finat = '51321003' limit 1),
       'Ing. Aldo Gabriel Ponce Serna',
       'Arrendamiento de equipamiento 2026 — craneótomo eléctrico (Partida 14)',
       '2026-05-23'::date, '2026-12-31'::date, 2280000.00, 4560000.00,
       'SAI S6M0081. Partida 14 (craneótomo eléctrico, CUCoP 53101-1902). 3 equipos, 4-8 mensuales.'
where not exists (select 1 from contratos where numero_interno = '050GYR032N02826-083-00');

-- 3) Concepto (renta unitaria mensual por equipo)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('CRANEÓTOMO ELÉCTRICO', 570000.00)
) as v(servicio, precio)
join contratos ct on ct.numero_interno = '050GYR032N02826-083-00'
on conflict (contrato_id, nombre_servicio) do update set precio_unitario = excluded.precio_unitario;

-- 4) Enrutar la validación de este proveedor a Conservación (Ing. Enrique González)
insert into jefe_proveedor (jefe_id, proveedor_id)
select j.id, p.id
from   jefes_servicio j
join   proveedores p on p.razon_social = 'COMERCIALIZADORA STÄDEL DEL NORTE, S.A. DE C.V.'
where  j.jefatura = 'Conservación'
on conflict do nothing;

-- 5) Verificación
select ct.numero_interno, p.razon_social, pa.cuenta_finat, ca.nombre as capitulo,
       ct.vigencia_inicio, ct.vigencia_fin,
       to_char(ct.monto_minimo,'FM999,999,999.00') as min,
       to_char(ct.monto_maximo,'FM999,999,999.00') as max,
       (select count(*) from contrato_servicios cs where cs.contrato_id = ct.id) as conceptos,
       (select precio_unitario from contrato_servicios cs where cs.contrato_id = ct.id limit 1) as precio
from   contratos ct
join   proveedores p on p.id = ct.proveedor_id
join   partidas pa   on pa.id = ct.partida_id
join   capitulos ca  on ca.id = pa.capitulo_id
where  ct.numero_interno = '050GYR032N02826-083-00';

commit;

-- (Opcional) Enrutar la validación de este proveedor a Conservación:
--   insert into jefe_proveedor (jefe_id, proveedor_id)
--   select j.id, p.id from jefes_servicio j
--     join proveedores p on p.razon_social = 'COMERCIALIZADORA STÄDEL DEL NORTE, S.A. DE C.V.'
--   where j.jefatura = 'Conservación'
--   on conflict do nothing;
