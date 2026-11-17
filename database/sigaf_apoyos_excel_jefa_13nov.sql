-- =====================================================================
-- SIGAF · Apoyos a otras unidades (Excel de la jefa, hoja de apoyos, 13/11/2026)
-- Servicios de contratos del HGZ 2 que se dieron a pacientes de otra unidad: salen del dictamen del HGZ 2.
-- Se registran directo como GASTO (la jefa ya los considera gasto; decisión de Gabriel 13/11/2026).
--   S6M0042 Laboratorio  → HGZ 3: 6,380.00 + 2,842.00                       =  9,222.00
--   S6M0047 Promotora    → HGZ 1: 5,568.00 + 22,040.00 + 22,040.00          = 49,648.00
--   S6M0049 Ventilación  → HGZ 3: 1,218.00 + 30,000.00 + 30,000.00          = 61,218.00
--                        → HGZ 1: 1,218.00                                  =  1,218.00
-- Idempotente: cada renglón lleva una marca [APOYOS-EXCEL-13NOV #n] y no se repite.
-- =====================================================================

begin;

insert into contrato_apoyos (contrato_id, dictamen, ui_destino, importe, fecha, estado, fecha_gasto, nota)
select c.id, c.dictamen_numero, v.ui, v.importe, date '2026-11-13', 'gasto', date '2026-11-13',
       v.estudio || ' · cant ' || v.cant || ' · del Excel de apoyos de la jefa [APOYOS-EXCEL-13NOV #' || v.n || ']'
from (values
  (1, 'S6M0042', '010103',  6380.00, 'KAJ-2', '1'),
  (2, 'S6M0049', '010103',  1218.00, 'Ventilador de traslado', '1'),
  (3, 'S6M0049', '010103', 30000.00, 'Sin estudio en el Excel', '—'),
  (4, 'S6M0049', '010103', 30000.00, 'Sin estudio en el Excel', '—'),
  (5, 'S6M0042', '010103',  2842.00, 'Tamiz neonatal ampliado', '2'),
  (6, 'S6M0047', '010101',  5568.00, 'Ecocardiograma con dobutamina', '1'),
  (7, 'S6M0047', '010101', 22040.00, 'CPRE simple con asistencia de anestesia', '1'),
  (8, 'S6M0047', '010101', 22040.00, 'CPRE simple con asistencia de anestesia', '1'),
  (9, 'S6M0049', '010101',  1218.00, 'Apoyo mecánico ventilatorio portátil (traslado)', '1')
) as v(n, contrato, ui, importe, estudio, cant)
join contratos c on c.numero_interno = v.contrato
where not exists (
  select 1 from contrato_apoyos a where a.nota like '%[APOYOS-EXCEL-13NOV #' || v.n || ']%'
);

-- Si ya se habían capturado en devengo, se pasan a gasto
update contrato_apoyos set estado = 'gasto', fecha_gasto = date '2026-11-13'
where nota like '%[APOYOS-EXCEL-13NOV #%' and estado = 'devengo';

-- Verificación: debe dar S6M0042 HGZ3 9,222 · S6M0047 HGZ1 49,648 · S6M0049 HGZ1 1,218 y HGZ3 61,218
select c.numero_interno, a.ui_destino, a.dictamen, a.estado, count(*) as renglones,
       to_char(sum(a.importe), 'FM999,999,999.00') as importe
from contrato_apoyos a
join contratos c on c.id = a.contrato_id
where a.nota like '%[APOYOS-EXCEL-13NOV #%'
group by c.numero_interno, a.ui_destino, a.dictamen, a.estado
order by c.numero_interno, a.ui_destino;

commit;
