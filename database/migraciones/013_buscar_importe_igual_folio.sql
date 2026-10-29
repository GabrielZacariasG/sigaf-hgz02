-- =====================================================================
-- SIGAF · Revisión · 013 · Facturas cuyo IMPORTE es igual a su número de FOLIO (SOLO LECTURA)
-- Fecha: 29/10/2026
-- Por qué: en Labopath 1216 y 1249 la migración del Excel guardó el folio como importe ($1,216 y $1,249
-- en lugar de $62,060 y $23,200). Esta consulta lista todas las que tienen ese mismo síntoma. NO cambia nada.
-- Cómo: SQL Editor → Run → pegar el resultado (o Download CSV si son muchas).
-- =====================================================================
select f.folio_ingreso, f.folio_proveedor, f.importe_factura, cap.nombre as capitulo, pa.cuenta_finat,
       pr.razon_social as proveedor, f.estatus_general, f.cr_contrarecibo, f.anulada
from facturas f
join capitulos cap on cap.id = f.capitulo_id
left join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
where regexp_replace(f.folio_proveedor, '\D', '', 'g') <> ''
  and length(regexp_replace(f.folio_proveedor, '\D', '', 'g')) <= 12
  and regexp_replace(f.folio_proveedor, '\D', '', 'g')::numeric = f.importe_factura
order by cap.nombre, f.folio_ingreso;
