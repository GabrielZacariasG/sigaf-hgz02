-- =====================================================================
-- SIGAF · 075 · Cuadre de S6M0047 (Promotora, dictamen 0000155456-2026) contra FINAT
-- Fecha: 23/11/2026
-- 1) Factura 86223 ($163,502.00, CR 00474410) es del HGZ 2 (capturada en SIGAF), pero FINAT la repartió:
--    HGZ 2 $30,593.50 · HGZ 1 $123,529.95 · HGZ 3 $9,378.55 → apoyos RECIBIDOS por $132,908.50 (pagado 22/10/2026).
-- 2) El apoyo DADO de $49,648.00 al HGZ 1 del Excel de la jefa es la factura 085913, CR 00469570, que FINAT cargó
--    completa a la UI 010101 (el HGZ 1 la pagó con su propio recurso): no salió del HGZ 2 → se borra.
-- Resultado esperado: pagos del HGZ 2 en SIGAF $7,529,355.50 + $66,294.00 ya validado en FINAT = $7,595,649.50 (FINAT).
-- Marca [CUADRE-075 ...]: correrlo dos veces no duplica.
-- =====================================================================
insert into contrato_apoyos (contrato_id, dictamen, ui_destino, factura_txt, importe, fecha, estado, fecha_gasto, nota, tipo)
select c.id, '0000155456-2026', v.ui, '(AGO) 86223', v.importe, date '2026-10-22', 'gasto', date '2026-10-22',
       'Apoyo recibido: la UI ' || v.ui || ' pagó esta parte del CR (1043) [CUADRE-075 CR 00474410 ' || v.ui || ']', 'recibido'
  from (values ('010101', 123529.95::numeric), ('010103', 9378.55::numeric)) as v(ui, importe)
  join contratos c on c.numero_interno = 'S6M0047'
 where not exists (select 1 from contrato_apoyos x where x.nota like '%[CUADRE-075 CR 00474410 ' || v.ui || ']%');

delete from contrato_apoyos a
 using contratos c
 where a.contrato_id = c.id and c.numero_interno = 'S6M0047'
   and a.tipo = 'dado' and a.ui_destino = '010101' and a.importe in (5568, 22040) and a.nota like '%APOYOS-EXCEL-13NOV #%';
-- (Los $49,648 del Excel estaban en 3 renglones: ecocardiograma $5,568 #6 y dos CPRE de $22,040 #7 y #8.)

select c.numero_interno, a.tipo, a.estado, a.ui_destino, a.importe, coalesce(a.fecha_gasto, a.fecha) as fecha, a.factura_txt, a.nota
  from contrato_apoyos a join contratos c on c.id = a.contrato_id
 where c.numero_interno = 'S6M0047' order by a.tipo, 6;
