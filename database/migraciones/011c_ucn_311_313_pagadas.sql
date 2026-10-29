-- =====================================================================
-- SIGAF · Corrección · 011c · UCN 311 y 313: estaban como "Devuelta al proveedor" y el sistema las tiene PAGADAS
-- Fecha: 29/10/2026 · Aprobado por Gabriel
--
-- El diagnóstico 011b mostró que UCN311 (HGZ2-INT-HIST-120) y UCN313 (HGZ2-INT-HIST-121) sí existen en SIGAF,
-- cuenta 51331002, pero con estatus "devuelta_proveedor" (probable arrastre de la migración: en la cédula,
-- la factura de abajo, 1200 de RENIS, dice "DEV A PETICIÓN DEL SERV"). El sistema (N_AP_IMSS_1043) dice:
--   UCN 311  $10,149,559.20  CR 00452689  PAGADO  pedido 41476 / recepción 40287
--   UCN 313  $1,566,417.60   CR 00452692  PAGADO  pedido 41477 / recepción 40288
-- (emitidos 23/01/2026, pago programado 12/02/2026). Suman $11,715,976.80 = gasto del sistema en 51331002.
--
-- Corrección: pasan a "Gasto reflejado" (pagadas), pasivo 2025 ejercido en enero 2026, con CR, fecha de pago,
-- firmas y pedido-recepción. No cambia importes. El historial de estatus lo registra el trigger.
-- Cómo: SQL Editor de Supabase → Run. Al final debe mostrar 51331002 = 2 facturas $11,715,976.80.
-- =====================================================================
with datos (folio_ingreso, cr, pedido, recepcion) as (
  values ('HGZ2-INT-HIST-120', '00452689', '41476', '40287'),
         ('HGZ2-INT-HIST-121', '00452692', '41477', '40288')
)
update facturas f set
  estatus_general          = 'gasto_reflejado',
  estatus_firmas           = 'autorizada_admin_contrato',
  estatus_pedido_recepcion = 'generado',
  cr_contrarecibo          = d.cr,
  fecha_pago               = date '2026-02-12',
  numero_pedido            = d.pedido,
  numero_recepcion         = d.recepcion,
  es_pasivo                = true,
  mes_asignado             = 1,
  anio_asignado            = 2026
from datos d
where f.folio_ingreso = d.folio_ingreso
  and f.anulada = false
  and f.estatus_general = 'devuelta_proveedor';

-- Verificación: debe dar 51331002 = 2 facturas y 11,715,976.80
select p.cuenta_finat, count(f.id) as facturas, sum(f.importe_factura) as importe
from facturas f join partidas p on p.id = f.partida_id
where p.cuenta_finat = '51331002' and f.anulada = false and f.estatus_general <> 'devuelta_proveedor'
group by p.cuenta_finat;
