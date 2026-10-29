-- =====================================================================
-- SIGAF · Corrección · 028 · Biodist 51251019: las 28 "Gasto reflejado" con CR = "SI"
-- Fecha: 29/10/2026 · N_AP_IMSS_1043
-- Cada factura tiene su comprobante propio, de una sola factura, con el MISMO importe que SIGAF y
-- PAGADO (programado el 27/10/2026). Solo se pone el CR real y la fecha de pago (el estatus ya es correcto).
-- SEGURO: solo si su CR sigue siendo "SI". Cómo: SQL Editor → Run. Debe mostrar 28 filas.
-- =====================================================================
with b (folio, cr) as (values
('8810','00474680'),('8811','00474683'),('8814','00474686'),('8819','00474692'),('8821','00474695'),('8822','00474698'),
('8832','00474700'),('8833','00474702'),('8845','00474704'),('8846','00474708'),('8847','00474711'),('8848','00474713'),
('9022','00474715'),('9172','00474719'),('9175','00474729'),('9186','00474741'),('9187','00474743'),('9190','00474746'),
('9192','00474749'),('9193','00474751'),('9197','00474753'),('9198','00474756'),('9243','00474758'),('9247','00474765'),
('9248','00474767'),('9250','00474655'),('9253','00474658'),('9255','00474659')
),
upd as (
  update facturas f set cr_contrarecibo = b.cr, fecha_pago = coalesce(f.fecha_pago, date '2026-10-27')
  from b, proveedores p
  where p.id = f.proveedor_id and p.razon_social ilike 'BIODIST%'
    and f.folio_proveedor = b.folio and f.anulada = false
    and upper(btrim(f.cr_contrarecibo)) = 'SI'
  returning f.folio_ingreso, f.folio_proveedor, f.importe_factura, f.cr_contrarecibo, f.fecha_pago
)
select * from upd order by folio_proveedor;