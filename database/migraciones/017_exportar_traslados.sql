-- =====================================================================
-- SIGAF · Revisión · 017 · Exportar facturas de traslados 52411011 / 52411024 (SOLO LECTURA)
-- Fecha: 29/10/2026
-- Para qué: cruzarlas contra los comprobantes del sistema (Autobuses de La Piedad, Cruz Roja y
-- fondo fijo de traslados). Incluye anuladas y devueltas para ver duplicados. NO cambia nada.
-- Cómo: SQL Editor → Run → copiar el resultado y pegarlo aquí.
-- =====================================================================
select
  f.folio_ingreso, f.folio_proveedor, cap.nombre as capitulo, pa.cuenta_finat,
  pr.razon_social as proveedor, co.numero_interno as contrato,
  f.importe_factura, f.fecha_factura, f.periodo_inicio, f.periodo_fin, f.es_pasivo,
  f.estatus_general, f.estatus_firmas, f.cr_contrarecibo, f.fecha_pago, f.anulada,
  f.created_at::date as capturada_el
from facturas f
join capitulos cap on cap.id = f.capitulo_id
join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
left join contratos co on co.id = f.contrato_id
where pa.cuenta_finat in ('52411011','52411024')
   or pr.razon_social ilike any (array['%AUTOBUSES%','%CRUZ ROJA%'])
order by pa.cuenta_finat, pr.razon_social, f.folio_proveedor;
