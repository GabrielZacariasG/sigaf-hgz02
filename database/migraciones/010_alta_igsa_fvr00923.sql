-- =====================================================================
-- SIGAF · Corrección · 010 · Alta de la factura IGSA FVR-00923 (julio) que faltaba en SIGAF
-- Fecha: 29/10/2026 · Aprobado por Gabriel
--
-- Cuenta 51331013 (Servicio integral de laboratorio): SIGAF tenía $2,207,720.93 menos que el sistema.
-- Es exactamente la factura FVR-00923 (servicio del 1 al 25 de julio 2026):
--   · está en la cédula (hoja integrales, fila 15)
--   · está en el sistema: comprobante (CR) 00471175, emitido 24/08/2026, PAGADO,
--     fecha de factura 11/08/2026, pago programado 31/08/2026, pedido 45242 / recepción 44030
--   · NO estaba capturada en SIGAF (entre FVR00588 de junio y FVR-01250 del 26/07)
--
-- Se da de alta con los datos del sistema, en el contrato 050GYR032N03825-055-01 (vigencia 30/04–30/09/2026),
-- como "Gasto reflejado" (pagada) con firmas y pedido-recepción completos.
-- SEGURO: no hace nada si ya existe una factura de IGSA con folio 923 (no anulada).
-- Cómo: SQL Editor de Supabase → Run. Al final debe mostrar 51331013 = 13 facturas $24,773,494.50 (= sistema).
-- =====================================================================
insert into facturas (
  folio_ingreso, folio_proveedor, fecha_factura, capitulo_id, partida_id, contrato_id, proveedor_id,
  periodo_inicio, periodo_fin, importe_factura, tasa_iva,
  estatus_general, estatus_firmas, estatus_pedido_recepcion,
  cr_contrarecibo, fecha_pago, numero_pedido, numero_recepcion, origen_migracion, created_by
)
select
  'HGZ2-INT-2026-' || lpad((coalesce((select max(substring(folio_ingreso from 'HGZ2-INT-2026-(\d+)$')::int)
                                       from facturas where folio_ingreso ~ '^HGZ2-INT-2026-\d+$'), 0) + 1)::text, 6, '0'),
  'FVR-00923', date '2026-08-11', pa.capitulo_id, c.partida_id, c.id, c.proveedor_id,
  date '2026-07-01', date '2026-07-25', 2207720.93,
  coalesce((select f.tasa_iva from facturas f where f.contrato_id = c.id and f.anulada = false limit 1), 0),
  'gasto_reflejado', 'autorizada_admin_contrato', 'generado',
  '00471175', date '2026-08-31', '45242', '44030',
  'Puesta al día 29/10/2026: N_AP_IMSS_1043 cbte 00471175 (fecha de pago = programada)',
  (select id from usuarios where nombre = 'Gabriel Zacarias' limit 1)
from contratos c
join partidas pa on pa.id = c.partida_id
where c.numero_interno = '050GYR032N03825-055-01'
  and not exists (
    select 1 from facturas f join proveedores p on p.id = f.proveedor_id
    where p.razon_social ilike '%IGSA%' and f.anulada = false
      and regexp_replace(f.folio_proveedor, '\D', '', 'g') ~ '0*923$'
  );

-- Verificación: gasto de la cuenta en SIGAF (sin anuladas ni devueltas). Debe dar 13 facturas y 24,773,494.50
select p.cuenta_finat, count(f.id) as facturas, sum(f.importe_factura) as importe
from facturas f join partidas p on p.id = f.partida_id
where p.cuenta_finat = '51331013' and f.anulada = false and f.estatus_general <> 'devuelta_proveedor'
group by p.cuenta_finat;
