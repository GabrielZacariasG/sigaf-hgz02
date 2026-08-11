-- =====================================================================
-- SIGAF · Rediseño de estatus a 3 ejes — MIGRACIÓN 2 (CONTRAER)
-- =====================================================================
-- Segunda fase del patrón expand/contract. Correr SOLO después de que:
--   - sigaf_m1_expand_circuitos.sql (M1) ya se aplicó, y
--   - el código nuevo (modelo de 3 ejes) ya está desplegado y verificado.
--
-- Elimina lo viejo que quedó por compatibilidad durante la transición:
--   - facturas.estatus_actual (ya nadie lo usa)
--   - el enum estatus_factura (ya sin referencias: historial y
--     alertas_config pasaron a text en M1)
--
-- Si el paso de verificación falla, NO correr esto: estatus_actual sigue
-- presente, así que se puede revertir el deploy y volver a la app vieja.
-- =====================================================================
begin;

alter table facturas drop column estatus_actual;
drop type estatus_factura;

commit;
