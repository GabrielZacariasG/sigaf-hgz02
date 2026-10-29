-- =====================================================================
-- SIGAF · Revisión · 029 · Facturas cuyo CR no es un número (SOLO LECTURA)
-- Fecha: 29/10/2026
-- Por qué: la migración del Excel dejó textos como "SI" en lugar del contra recibo (caso Biodist).
-- Trae todas las no anuladas cuyo CR tiene algo que no sea dígito. NO cambia nada.
-- Cómo: SQL Editor → Run → copiar el resultado y pegarlo aquí (o "Download CSV" si son muchas).
-- =====================================================================
select f.folio_ingreso, f.folio_proveedor, pr.razon_social as proveedor, cap.nombre as capitulo,
       pa.cuenta_finat, f.importe_factura, f.periodo_inicio, f.estatus_general, f.cr_contrarecibo, f.fecha_pago
from facturas f
join capitulos cap on cap.id = f.capitulo_id
join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
where f.anulada = false
  and nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is not null
  and btrim(f.cr_contrarecibo) !~ '^\d+$'
order by f.cr_contrarecibo, pr.razon_social, f.folio_proveedor;
