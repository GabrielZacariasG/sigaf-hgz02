-- =====================================================================
-- SIGAF · Cierre de vigencia del S6M0030 (Autobuses de la Piedad) al 23/10/2026
-- Decisión de Gabriel 9/11/2026: el contrato nuevo S6M0112 empieza el 24/10/2026.
-- Así los folios del SCACE se asignan por FECHA DEL VIAJE sin que se encimen:
--   hasta 23/10 → S6M0030 · desde 24/10 → S6M0112.
-- Solo cambia vigencia_fin; no toca facturas, apoyos ni montos.
-- =====================================================================

begin;

update contratos
   set vigencia_fin = date '2026-10-23'
 where numero_interno = 'S6M0030'
   and vigencia_inicio = date '2026-03-01';

select numero_interno, numero_alterno, vigencia_inicio, vigencia_fin, monto_maximo
from contratos
where numero_interno in ('S6M0022', 'S6M0030', 'S6M0112')
order by vigencia_inicio;

commit;
