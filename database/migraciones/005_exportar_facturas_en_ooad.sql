-- =====================================================================
-- SIGAF · Puesta al día · 005 · Exportar las facturas "en OOAD" sin CR (SOLO LECTURA)
-- Fecha: 29/10/2026
--
-- Para qué: cruzar con los reportes del sistema (N_AP_IMSS_1043, 4006/4007) y con
-- los oficios EP de SIGAF las facturas que están en OOAD sin CR o sin firmas
-- registradas (las 183 que listó la 001). NO cambia nada.
-- Cómo: SQL Editor → Run → "Download CSV" → guardarlo como
--       005_facturas_en_ooad_resultado.csv (en esta misma carpeta) y mandarlo.
-- =====================================================================
select
  f.id,
  f.folio_ingreso,
  f.folio_proveedor,
  cap.nombre                         as capitulo,
  pa.cuenta_finat,
  pa.cuenta_prei,
  pr.no_proveedor,
  pr.razon_social                    as proveedor,
  co.numero_interno                  as contrato,
  f.importe_factura,
  f.fecha_factura,
  f.periodo_inicio,
  f.periodo_fin,
  f.estatus_general,
  f.estatus_firmas,
  f.estatus_pedido_recepcion,
  f.numero_pedido,
  f.numero_recepcion,
  f.cr_contrarecibo,
  f.comprobante_ooad,
  f.fecha_pago,
  f.es_pasivo,
  f.origen_migracion,
  f.created_at::date                 as capturada_el,
  (select string_agg(o.folio || ' (' || to_char(o.created_at, 'DD/MM/YYYY') || ')', ' | ' order by o.created_at)
     from oficios o where o.tipo = 'envio_pago' and f.id = any (o.factura_ids))       as oficios_ep,
  (select string_agg(v.dictamen || ' ' || coalesce(v.oficio_folio, '') || ' (' || to_char(v.created_at, 'DD/MM/YYYY') || ')', ' | ')
     from validaciones_servicio v where v.factura_id = f.id)                         as validacion_servicio,
  (select max(h.fecha)::date from factura_estatus_historial h
     where h.factura_id = f.id and h.circuito = 'general' and h.estatus = f.estatus_general::text) as en_estatus_desde
from facturas f
join capitulos cap on cap.id = f.capitulo_id
left join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
left join contratos co on co.id = f.contrato_id
where f.anulada = false
  and f.estatus_general in ('enviada_ooad', 'en_tramite_ooad')
  and nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is null
order by cap.nombre, f.folio_ingreso;
