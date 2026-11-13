-- SIGAF · Nombres más claros del "Objeto / adquisición-servicio" de los contratos de subrogación.
-- Se reflejan en /subrogados, Catálogos y captura. Editable después en Catálogos → Editar contrato.
-- Actualiza por numero_interno (S6M00xx). Correr en el SQL Editor de Supabase.

update contratos set adquisicion_servicio = v.nombre
from (values
  ('S6M0003', 'Pruebas psicológicas y electroencefalogramas'),
  ('S6M0005', 'Estudios de imagen y especialidad (TAC, RMN, cardiología, oftalmología, endoscopía, CPRE)'),
  ('S6M0010', 'Valoración oftalmológica y angiológica de urgencia'),
  ('S6M0012', 'Cateterismos y cirugías de angiología/oftalmología de urgencia'),
  ('S6M0015', 'Fluoroscopia (arco en C)'),
  ('S6M0016', 'Medicina nuclear'),
  ('S6M0017', 'Estudios especiales de laboratorio'),
  ('S6M0040', 'Dosimetría'),
  ('S6M0041', 'Patología'),
  ('S6M0042', 'Laboratorio clínico'),
  ('S6M0043', 'Pruebas psicológicas y electroencefalogramas'),
  ('S6M0046', 'Valoración oftalmológica y angiológica de urgencia'),
  ('S6M0047', 'Estudios de imagen y especialidad (TAC, RMN, oftalmología, endoscopía, cardiología, medicina nuclear)'),
  ('S6M0048', 'Cateterismos y cirugías de angiología/oftalmología de urgencia'),
  ('S6M0049', 'Apoyo mecánico ventilatorio'),
  ('S6M0050', 'Fluoroscopia (arco en C)')
) as v(num, nombre)
where contratos.numero_interno = v.num;

-- Verifica:
select numero_interno, adquisicion_servicio
from contratos
where numero_interno in ('S6M0003','S6M0005','S6M0010','S6M0012','S6M0015','S6M0016','S6M0017','S6M0040','S6M0041','S6M0042','S6M0043','S6M0046','S6M0047','S6M0048','S6M0049','S6M0050')
order by numero_interno;
