-- =====================================================================
-- SIGAF · Revisión · 020 · Romo Alba: oficio SIGAF-EP-0109 y facturas sin CR (SOLO LECTURA)
-- Fecha: 29/10/2026
-- Para qué: cruzarlas contra los comprobantes del sistema (N_AP_IMSS_1043, cuenta 51221001). NO cambia nada.
-- Cómo: SQL Editor → Run → copiar el resultado y pegarlo aquí.
-- =====================================================================
select
  f.folio_ingreso, f.folio_proveedor, pa.cuenta_finat, co.numero_interno as contrato,
  f.importe_factura, f.fecha_factura, f.periodo_inicio, f.periodo_fin,
  f.estatus_general, f.estatus_firmas, f.cr_contrarecibo, f.fecha_pago, f.anulada,
  (select string_agg(o.folio || ' (' || to_char(o.created_at, 'DD/MM/YYYY') || ')', ' | ' order by o.created_at)
     from oficios o where f.id = any (o.factura_ids)) as oficios,
  f.created_at::date as capturada_el
from facturas f
join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
left join contratos co on co.id = f.contrato_id
where pr.razon_social ilike '%ROMO ALBA%'
  and (nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is null
       or exists (select 1 from oficios o where o.folio ilike '%EP-0109%' and f.id = any (o.factura_ids)))
order by f.folio_proveedor;
