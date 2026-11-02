-- =====================================================================
-- SIGAF · 055 · Estatus real de 8 facturas de Integrales: en espera de pedido-recepción
-- Fecha: 02/11/2026
-- Quedaron "En trámite OOAD" por los oficios EP-0141 a EP-0151 (23 al 28/10), antes del candado, sin CR ni pedido-recepción.
-- Comprobado el 02/11/2026: en el Informe FSI 7 traen pedido 0 y recepción 0 (SIN PRESUPUESTO) y HD9672 no está registrada;
-- ninguna aparece en el 1043.
-- Decisión de Gabriel: poner el estatus real.
--   · Las 8 regresan a "En revisión" y salen de OOAD. Firmas no se tocan. El historial lo registra el trigger.
--   · Las 7 que están en FSI quedan "Solicitado · en espera de P&R".
--   · HD9672 sigue "Pendiente de solicitar" hasta que se registre en FSI.
-- Los oficios EP emitidos no se borran. Solo cambia facturas sin CR con estos folio e importe.
-- Se puede correr dos veces. Cómo: SQL Editor de Supabase → Run. Al final muestra las 8 facturas.
-- =====================================================================
begin;

with objetivo (folio_ingreso, folio_proveedor, importe, pedido) as (values
  ('HGZ2-INT-HIST-104',    'EF582051',   351046.92, 'solicitado_fsi'),
  ('HGZ2-INT-HIST-105',    'EF582054',   346562.00, 'solicitado_fsi'),
  ('HGZ2-INT-2026-000028', 'EF594201',   577171.98, 'solicitado_fsi'),
  ('HGZ2-INT-2026-000029', 'EF594200',   180829.44, 'solicitado_fsi'),
  ('HGZ2-INT-2026-000025', '4601587649',  75929.18, 'solicitado_fsi'),
  ('HGZ2-INT-2026-000019', '64157916',     6492.24, 'solicitado_fsi'),
  ('HGZ2-INT-2026-000023', '64226126',    11361.42, 'solicitado_fsi'),
  ('HGZ2-INT-2026-000031', 'HD9672',     150351.17, 'pendiente')
)
update facturas f
   set estatus_general = 'en_revision',
       estatus_pedido_recepcion = o.pedido::estatus_pedido_recepcion
  from objetivo o
 where f.folio_ingreso = o.folio_ingreso
   and f.folio_proveedor = o.folio_proveedor
   and f.importe_factura = o.importe
   and f.anulada = false
   and nullif(btrim(coalesce(f.cr_contrarecibo::text, '')), '') is null
   and f.estatus_general in ('en_tramite_ooad', 'enviada_ooad', 'en_revision');

commit;

select folio_ingreso, folio_proveedor, importe_factura, estatus_general, estatus_firmas, estatus_pedido_recepcion, cr_contrarecibo
  from facturas
 where folio_ingreso in ('HGZ2-INT-HIST-104','HGZ2-INT-HIST-105','HGZ2-INT-2026-000028','HGZ2-INT-2026-000029','HGZ2-INT-2026-000025','HGZ2-INT-2026-000019','HGZ2-INT-2026-000023','HGZ2-INT-2026-000031')
 order by folio_ingreso;
