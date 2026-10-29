-- =====================================================================
-- SIGAF · Revisión · 027 · Biodist: las facturas que siguen con CR = "SI" después del 026 (SOLO LECTURA)
-- Fecha: 29/10/2026 · NO cambia nada. Cómo: SQL Editor → Run → pegar el resultado.
-- =====================================================================
select f.folio_ingreso, f.folio_proveedor, pa.cuenta_finat, f.importe_factura,
       f.estatus_general, f.estatus_firmas, f.cr_contrarecibo, f.fecha_pago, f.periodo_inicio
from facturas f
join proveedores p on p.id = f.proveedor_id
join partidas pa on pa.id = f.partida_id
where p.razon_social ilike 'BIODIST%' and f.anulada = false
  and upper(btrim(coalesce(f.cr_contrarecibo, ''))) = 'SI'
order by f.folio_proveedor;
