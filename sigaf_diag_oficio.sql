-- =====================================================================
--  DIAGNÓSTICO DE OFICIOS DEL SERVICIO
--  Correr en el SQL Editor de Supabase (sesión con permisos, NO anónima).
-- =====================================================================

-- 1) ¿Cuántas facturas cubre el oficio CUM-2026-30219 y de qué contrato(s)?
--    (cambia el texto si buscas otro folio)
SELECT v.oficio_folio,
       v.dictamen,
       f.folio_ingreso,
       f.folio_proveedor,
       f.importe_factura,
       c.numero_interno            AS contrato,
       c.administrador_contrato    AS adm_contrato,
       p.razon_social              AS proveedor,
       v.created_at
FROM   validaciones_servicio v
JOIN   facturas   f ON f.id = v.factura_id
LEFT   JOIN contratos   c ON c.id = f.contrato_id
LEFT   JOIN proveedores p ON p.id = f.proveedor_id
WHERE  v.oficio_folio ILIKE '%CUM-2026-30219%'
ORDER  BY v.created_at;

-- 2) TODOS los oficios que mezclaron MÁS DE UN CONTRATO (histórico, antes del candado).
--    Estos son los que pueden salir inconsistentes entre la hoja de Finanzas y la del Adm de Contrato.
SELECT v.oficio_folio,
       COUNT(*)                              AS num_facturas,
       COUNT(DISTINCT f.contrato_id)         AS num_contratos,
       STRING_AGG(DISTINCT c.numero_interno, ', ') AS contratos
FROM   validaciones_servicio v
JOIN   facturas  f ON f.id = v.factura_id
LEFT   JOIN contratos c ON c.id = f.contrato_id
WHERE  v.oficio_folio IS NOT NULL
GROUP  BY v.oficio_folio
HAVING COUNT(DISTINCT f.contrato_id) > 1
ORDER  BY num_contratos DESC, v.oficio_folio;
