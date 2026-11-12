-- SIGAF · Corrige/agrega estudios del contrato IGSA 050GYR032N08226-154-00.
-- UPDATE en su lugar (NO borra → respeta factura_detalle). 17 corregidos, 2 agregados.
begin;
-- 1) Corrige los nombres cortados (mismo renglón, no se borra)
update contrato_servicios cs set nombre_servicio = v.nombre, precio_unitario = v.precio
from (values
  ('40.10.006', '40.10.006 Antígeno CA 125', 69.33),
  ('40.12.013', '40.12.013 Anticuerpos (IgG) contra Herpes virus 1 y 2', 372.88),
  ('40.12.014', '40.12.014 Anticuerpos (IgM) contra Herpes virus 1 y 2', 285.15),
  ('40.12.026', '40.12.026 Anticuerpos contra VIH 1 y 2', 61.68),
  ('40.21.005', '40.21.005 Carga Viral de Herpes 1 y 2', 1159.57),
  ('40.21.008', '40.21.008 Carga Viral de Parvovirus B- 19', 1120.34),
  ('40.22.001', '40.22.001 Trisomía 13', 4526.4),
  ('40.22.002', '40.22.002 Trisomía 21', 4526.4),
  ('40.22.003', '40.22.003 Trisomía 18', 4526.4),
  ('40.23.032', '40.23.032 Anticuerpos (IgA) contra Beta 2 glicoproteína 1', 108.1),
  ('40.23.033', '40.23.033 Anticuerpos (IgG) contra Beta 2 glicoproteína 1', 98.27),
  ('40.23.034', '40.23.034 Anticuerpos (IgM) contra Beta 2 glicoproteína 1', 98.27),
  ('40.23.053', '40.23.053 Interleucina 1', 234.3),
  ('40.23.054', '40.23.054 Interleucina 6', 258.25),
  ('40.23.055', '40.23.055 Interleucina 8', 1349.92),
  ('40.23.056', '40.23.056 Interleucina 12', 1349.92),
  ('40.23.061', '40.23.061 Telopéptido C de Colágeno tipo 1', 1098.3)
) as v(clave, nombre, precio)
where cs.contrato_id = (select id from contratos where numero_interno = '050GYR032N08226-154-00')
  and cs.nombre_servicio like v.clave || ' %';

-- 2) Agrega los que faltaban (SARS-CoV-2 y Prueba de Embarazo)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id, v.nombre, v.precio, v.orden from contratos c join (values
  ('40.12.085 Prueba rápida de Antígeno de SARS-CoV-2 (nCoV-19)', 77.92, 1000),
  ('40.09.031 Prueba Rápida de Embarazo', 35.32, 1001)
) as v(nombre, precio, orden) on true
where c.numero_interno = '050GYR032N08226-154-00'
  and not exists (select 1 from contrato_servicios cs where cs.contrato_id = c.id and cs.nombre_servicio = v.nombre);

select count(*) as total_estudios from contrato_servicios cs join contratos c on c.id=cs.contrato_id where c.numero_interno='050GYR032N08226-154-00';
commit;