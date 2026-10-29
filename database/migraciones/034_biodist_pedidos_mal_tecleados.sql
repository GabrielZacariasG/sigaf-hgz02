-- =====================================================================
-- SIGAF · Corrección · 034 · 3 pedido-recepción de Biodist mal tecleados (revisión 033)
-- Fecha: 29/10/2026 · fuente: N_AP_IMSS_4007 (pedido y recepción del comprobante pagado)
--   8740  CR 00473976  pedido 44808 → 45808 (recepción 44588 ya bien)
--   8815  CR 00474697  pedido 44923 → 45923 (recepción 44702 ya bien)
--   9202  CR 00473973  recepción 45805 → 44585 (pedido 45805 ya bien; se había repetido el pedido)
-- SEGURO: solo si conservan el valor equivocado. Cómo: SQL Editor → Run. Debe mostrar 3 filas.
-- =====================================================================
with c (folio_ingreso, ped_ant, ped_nvo, rec_ant, rec_nvo) as (values
  ('HGZ2-AM-HIST-000356', '44808', '45808', '44588', '44588'),
  ('HGZ2-AM-HIST-000375', '44923', '45923', '44702', '44702'),
  ('HGZ2-AM-HIST-000524', '45805', '45805', '45805', '44585')),
upd as (
  update facturas f set numero_pedido = c.ped_nvo, numero_recepcion = c.rec_nvo
  from c
  where f.folio_ingreso = c.folio_ingreso and f.numero_pedido = c.ped_ant and f.numero_recepcion = c.rec_ant
  returning f.folio_ingreso, f.folio_proveedor, f.numero_pedido, f.numero_recepcion
)
select * from upd order by folio_ingreso;
