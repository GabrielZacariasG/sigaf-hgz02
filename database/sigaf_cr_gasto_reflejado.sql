-- =====================================================================
-- SIGAF · Corrección: si una factura ya tiene CONTRA-RECIBO (CR), su
-- gasto YA está reflejado (regla del usuario, 2026-09-14).
-- ---------------------------------------------------------------------
-- Muchas facturas migradas de la cédula traían CR pero su estatus quedó
-- en una etapa previa (p. ej. Área Médica "AC" -> en_revision). Como el
-- CR implica que OOAD ya la pagó, se pasan a 'gasto_reflejado'.
--
-- Se EXCLUYEN las 'devuelta_proveedor' (estado terminal distinto; se
-- revisan aparte) y las anuladas.
-- No se toca fecha_pago (no se conoce la fecha real; el historial del
-- cambio lo registra el trigger automáticamente).
-- Correr en el SQL Editor de Supabase.
-- =====================================================================

begin;

update facturas
set estatus_general = 'gasto_reflejado'
where coalesce(trim(cr_contrarecibo), '') <> ''
  and estatus_general not in ('gasto_reflejado', 'devuelta_proveedor')
  and anulada = false;

-- Verificación: cómo quedan las que tienen CR (casi todas gasto_reflejado;
-- solo deberían quedar fuera las devueltas al proveedor).
select estatus_general, count(*) as cuantas
from facturas
where coalesce(trim(cr_contrarecibo), '') <> ''
group by estatus_general
order by cuantas desc;

commit;
