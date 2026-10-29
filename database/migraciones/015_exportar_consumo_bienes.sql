-- =====================================================================
-- SIGAF · Revisión · 015 · Exportar facturas de consumo de bienes (SOLO LECTURA)
-- Fecha: 29/10/2026
-- Cuentas con diferencia contra el sistema: 51251002, 51251003, 51251005, 51251007, 51251017,
-- 51251020, 51251022, 51251023, 51251024. NO cambia nada.
-- Cómo: SQL Editor → Run → "Download CSV" → dejarlo en Descargas.
-- =====================================================================
select
  f.id, f.folio_ingreso, f.folio_proveedor, cap.nombre as capitulo, pa.cuenta_finat,
  pr.no_proveedor, pr.razon_social as proveedor, co.numero_interno as contrato,
  f.importe_factura, f.fecha_factura, f.periodo_inicio, f.periodo_fin, f.es_pasivo,
  f.estatus_general, f.estatus_firmas, f.cr_contrarecibo, f.fecha_pago, f.orden_compra, f.clave_cbi,
  f.origen_migracion, f.created_at::date as capturada_el
from facturas f
join capitulos cap on cap.id = f.capitulo_id
join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
left join contratos co on co.id = f.contrato_id
where f.anulada = false
  and f.estatus_general <> 'devuelta_proveedor'
  and pa.cuenta_finat in ('51251002','51251003','51251005','51251007','51251017','51251020','51251022','51251023','51251024')
order by pa.cuenta_finat, pr.razon_social, f.folio_proveedor;
