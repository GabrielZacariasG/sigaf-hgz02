-- =====================================================================
--  Compra Emergente: destino de validación (a quién se envía)
--  Dos opciones: 'abastecimiento' (Lic. Juan Ramón, jefe de Abasto)
--                'administrador'  (Subdirector Administrativo)
--  Correr una vez en el SQL Editor de Supabase.
-- =====================================================================

ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS ce_destino text
  CHECK (ce_destino IS NULL OR ce_destino IN ('abastecimiento', 'administrador'));

COMMENT ON COLUMN facturas.ce_destino IS
  'Compra Emergente: bandeja de validación destino. abastecimiento=Lic. Juan Ramón (jefe Abasto); administrador=Subdirector. NULL se trata como administrador (compatibilidad).';

-- Las CE que YA están en validación sin destino se consideran del Administrador
-- (así siguen apareciendo en el panel del Subdirector como hasta ahora).
UPDATE facturas f
SET    ce_destino = 'administrador'
FROM   capitulos c
WHERE  f.capitulo_id = c.id
  AND  c.nombre = 'Compra Emergente'
  AND  f.estatus_firmas = 'envio_firmas_servicio'
  AND  f.ce_destino IS NULL;
