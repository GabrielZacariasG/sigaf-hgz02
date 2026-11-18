-- =====================================================================
-- SIGAF · Contratos de Subrogados que NO generan folios SMS
-- ---------------------------------------------------------------------
-- Algunos contratos del capítulo Subrogados son CONVENIOS DE INTERCAMBIO /
-- COLABORACIÓN (p. ej. el AGISSS con ISSEA, cuenta 51331010) u honorarios,
-- y por su naturaleza NO generan folios CD_SMS / Avance SMS. El candado de
-- captura ("una factura de Subrogados debe amparar al menos un folio") los
-- bloqueaba. Con esta bandera, esos contratos se capturan sin exigir folios.
--
-- Se prende SOLO para el contrato S7M0163 (ISSEA). Para exentar otro, corre
-- el update con su numero_interno.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

alter table contratos add column if not exists sin_folios_subrogacion boolean not null default false;

update contratos set sin_folios_subrogacion = true
where numero_interno = 'S7M0163';

-- Verificación: debe listar S7M0163 en true.
select numero_interno, sin_folios_subrogacion
from contratos
where sin_folios_subrogacion = true
order by numero_interno;
