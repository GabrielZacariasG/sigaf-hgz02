-- =====================================================================
-- SIGAF · Revisión · 025 · Facturas "En trámite OOAD" que YA tienen CR (SOLO LECTURA)
-- Fecha: 29/10/2026
-- Para qué: cruzar sus CR contra el N_AP_IMSS_1043 de hoy y pasar a "Gasto reflejado" las que OOAD ya pagó.
-- También trae cualquier factura con los 4 comprobantes que el sistema eliminó entre el 28 y el 29/10
-- (00476087, 00476173, 00476243, 00476577). NO cambia nada.
-- Cómo: SQL Editor → Run → copiar el resultado y pegarlo aquí.
-- =====================================================================
select f.folio_ingreso, f.folio_proveedor, pr.razon_social as proveedor, pa.cuenta_finat,
       f.importe_factura, f.estatus_general, f.cr_contrarecibo, f.fecha_pago
from facturas f
join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
where f.anulada = false
  and (   (f.estatus_general = 'en_tramite_ooad' and nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is not null)
       or ltrim(coalesce(f.cr_contrarecibo, ''), '0') in ('476087','476173','476243','476577'))
order by f.cr_contrarecibo, f.folio_ingreso;
