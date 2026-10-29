-- =====================================================================
-- SIGAF · Revisión · 012 · Exportar las facturas "Devuelta al proveedor" (SOLO LECTURA)
-- Fecha: 29/10/2026
-- Para qué: cruzarlas contra los comprobantes del sistema (N_AP_IMSS_1043 ene–oct) y detectar las que
-- en realidad SÍ se pagaron (como UCN 311/313). NO cambia nada.
-- Cómo: SQL Editor → Run → "Download CSV" → mandarlo.
-- =====================================================================
select
  f.id,
  f.folio_ingreso,
  f.folio_proveedor,
  cap.nombre                         as capitulo,
  pa.cuenta_finat,
  pr.no_proveedor,
  pr.razon_social                    as proveedor,
  co.numero_interno                  as contrato,
  f.importe_factura,
  f.fecha_factura,
  f.periodo_inicio,
  f.periodo_fin,
  f.estatus_firmas,
  f.estatus_pedido_recepcion,
  f.cr_contrarecibo,
  f.es_pasivo,
  f.fecha_devolucion::date            as fecha_devolucion,
  f.motivo_devolucion,
  f.reingresos,
  f.sustituida_por_id,
  (select r.folio_ingreso || ' ' || r.folio_proveedor || ' (' || r.estatus_general || ')'
     from facturas r where r.id = f.sustituida_por_id)                               as refacturada_como,
  (select string_agg(o.folio || ' (' || to_char(o.created_at, 'DD/MM/YYYY') || ')', ' | ' order by o.created_at)
     from oficios o where o.tipo = 'devolucion' and f.id = any (o.factura_ids))       as oficios_dp,
  (select string_agg(o.folio, ' | ' order by o.created_at)
     from oficios o where o.tipo = 'envio_pago' and f.id = any (o.factura_ids))       as oficios_ep,
  f.created_at::date                 as capturada_el
from facturas f
join capitulos cap on cap.id = f.capitulo_id
left join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
left join contratos co on co.id = f.contrato_id
where f.anulada = false
  and f.estatus_general = 'devuelta_proveedor'
order by cap.nombre, f.folio_ingreso;
