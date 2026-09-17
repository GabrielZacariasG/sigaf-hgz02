-- =====================================================================
-- SIGAF · Alta del contrato 050GYR032N06426-130-00 (Integrales)
-- BIODIST, S.A. DE C.V. — SERVICIO MÉDICO INTEGRAL DE BANCO DE SANGRE.
--   Cuenta 51331020 · Vigencia 01/ago–31/dic 2026
--   Mín $5,841,300.00 · Máx $14,602,231.20 (+ IVA)
--   Administrador/seguimiento: Dr. Esly Gerardo García Nava
-- 9 procedimientos (precio unitario verificado: la suma de importes
-- reproduce exacto los totales mín/máx del contrato). Datos del PDF.
-- Idempotente. Correr en el SQL Editor de Supabase.
-- =====================================================================

begin;

-- 1) Proveedor BIODIST (si no existe alguno)
insert into proveedores (razon_social)
select 'BIODIST, S.A. DE C.V.'
where not exists (select 1 from proveedores where razon_social ilike '%BIODIST%');

-- 2) Partida cuenta 51331020 en Integrales (si no existe)
insert into partidas (capitulo_id, cuenta_prei, cuenta_finat, nombre)
select ca.id, '51331020', '51331020', 'Servicios integrales · banco de sangre'
from capitulos ca
where ca.nombre = 'Integrales'
  and not exists (
    select 1 from partidas p
    where p.capitulo_id = ca.id and (p.cuenta_prei = '51331020' or p.cuenta_finat = '51331020')
  );

-- 3) Contrato (si no existe)
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato,
                       adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo)
select '050GYR032N06426-130-00',
       (select id from proveedores where razon_social ilike '%BIODIST%' order by id limit 1),
       (select p.id from partidas p join capitulos ca on ca.id = p.capitulo_id
        where ca.nombre = 'Integrales' and (p.cuenta_finat = '51331020' or p.cuenta_prei = '51331020') limit 1),
       'Dr. Esly Gerardo García Nava',
       'Servicio médico integral de banco de sangre (01/ago–31/dic 2026)',
       date '2026-08-01', date '2026-12-31', 5841300.00, 14602231.20
where not exists (select 1 from contratos where numero_interno = '050GYR032N06426-130-00');

-- 4) 9 conceptos (procedimientos) con su precio unitario y orden
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id, v.nombre, v.precio, v.orden
from (values
  (1,'50.01.01 Sangre Total Segura', 1378.68),
  (2,'50.02.02 Aféresis plaquetaria', 4556.52),
  (3,'50.03.01 Hemoclasificación de los sistemas AB0 y Rh (antígeno D) en tarjeta, cassette, columna o placa', 90.12),
  (4,'50.03.02 Prueba de compatibilidad en tarjeta, cassette, columna o placa', 68.28),
  (5,'50.03.03 Investigación de anticuerpos irregulares (semipanel) en tarjeta, cassette, columna o placa', 90.96),
  (6,'50.03.04 Identificación de anticuerpos irregulares (panel completo)', 120.24),
  (7,'50.03.05 Determinación de fenotipo eritrocitario en tarjeta, cassette, columna o placa', 138.96),
  (8,'50.03.06 Prueba de detección de antiglobulina humana monoespecífica anti-C3d en tarjeta, cassette, columna o placa', 40.68),
  (9,'50.03.07 Prueba de detección de antiglobulina humana monoespecífica anti-IgG en tarjeta, cassette, columna o placa', 47.52)
) as v(orden,nombre,precio),
     contratos c
where c.numero_interno = '050GYR032N06426-130-00'
  and not exists (select 1 from contrato_servicios cs where cs.contrato_id = c.id and cs.nombre_servicio = v.nombre);

-- 5) Verificación
select c.numero_interno, p.razon_social, pa.cuenta_finat, ca.nombre as capitulo,
       c.vigencia_inicio, c.vigencia_fin,
       to_char(c.monto_minimo,'FM999,999,999.00') as min, to_char(c.monto_maximo,'FM999,999,999.00') as max,
       (select count(*) from contrato_servicios cs where cs.contrato_id = c.id) as conceptos
from contratos c
join proveedores p on p.id = c.proveedor_id
join partidas pa on pa.id = c.partida_id
join capitulos ca on ca.id = pa.capitulo_id
where c.numero_interno = '050GYR032N06426-130-00';

commit;
