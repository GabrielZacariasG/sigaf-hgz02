-- =====================================================================
-- SIGAF · Corrección · 011 · Alta de las facturas de Unidad de Cuidados Nefrológicos (pasivo 2025)
-- Fecha: 29/10/2026 · Aprobado por Gabriel
--
-- Cuenta 51331002 (Subrogación de hemodiálisis extramuros): el sistema trae $11,715,976.80 de gasto
-- y SIGAF no tenía ninguna factura (tras la corrección 009). Son las dos facturas del HGZ 2:
--   UCN 311  26/10–25/11/2025  $10,149,559.20  CR 00452689 (pagado)  pedido 41476 / recepción 40287
--   UCN 313  26–30/11/2025     $1,566,417.60   CR 00452692 (pagado)  pedido 41477 / recepción 40288
-- Fuente: N_AP_IMSS_1043 (emitidos 23/01/2026, pago programado 12/02/2026) y cédula (hoja integrales, filas 6–7).
-- Contrato 050GYR032N09825-108-00 (ya existe en SIGAF). Son PASIVO 2025, ejercidos en enero 2026.
-- SEGURO: no da de alta una factura si ya existe otra de UCN con el mismo número (no anulada).
-- Cómo: SQL Editor de Supabase → Run. Al final debe mostrar 51331002 = 2 facturas $11,715,976.80 (= sistema).
-- =====================================================================
with nuevas (folio, f_factura, p_ini, p_fin, importe, cr, pedido, recepcion, n) as (
  values
    ('UCN311', date '2025-12-11', date '2025-10-26', date '2025-11-25', 10149559.20, '00452689', '41476', '40287', 1),
    ('UCN313', date '2025-12-16', date '2025-11-26', date '2025-11-30', 1566417.60,  '00452692', '41477', '40288', 2)
),
base as (
  select coalesce((select max(substring(folio_ingreso from 'HGZ2-INT-2026-(\d+)$')::int)
                   from facturas where folio_ingreso ~ '^HGZ2-INT-2026-\d+$'), 0) as ultimo
)
insert into facturas (
  folio_ingreso, folio_proveedor, fecha_factura, capitulo_id, partida_id, contrato_id, proveedor_id,
  periodo_inicio, periodo_fin, importe_factura, tasa_iva, es_pasivo, mes_asignado, anio_asignado,
  estatus_general, estatus_firmas, estatus_pedido_recepcion,
  cr_contrarecibo, fecha_pago, numero_pedido, numero_recepcion, origen_migracion, created_by
)
select
  'HGZ2-INT-2026-' || lpad((base.ultimo + nv.n)::text, 6, '0'),
  nv.folio, nv.f_factura, pa.capitulo_id, c.partida_id, c.id, c.proveedor_id,
  nv.p_ini, nv.p_fin, nv.importe, 0, true, 1, 2026,
  'gasto_reflejado', 'autorizada_admin_contrato', 'generado',
  nv.cr, date '2026-02-12', nv.pedido, nv.recepcion,
  'Puesta al día 29/10/2026: N_AP_IMSS_1043 cbte ' || nv.cr || ' (fecha de pago = programada)',
  (select id from usuarios where nombre = 'Gabriel Zacarias' limit 1)
from nuevas nv
cross join base
join contratos c on c.numero_interno = '050GYR032N09825-108-00'
join partidas pa on pa.id = c.partida_id
where not exists (
  select 1 from facturas f
  where f.proveedor_id = c.proveedor_id and f.anulada = false
    and regexp_replace(f.folio_proveedor, '\D', '', 'g') = regexp_replace(nv.folio, '\D', '', 'g')
);

-- Verificación: debe dar 51331002 = 2 facturas y 11,715,976.80
select p.cuenta_finat, count(f.id) as facturas, sum(f.importe_factura) as importe
from facturas f join partidas p on p.id = f.partida_id
where p.cuenta_finat = '51331002' and f.anulada = false and f.estatus_general <> 'devuelta_proveedor'
group by p.cuenta_finat;
