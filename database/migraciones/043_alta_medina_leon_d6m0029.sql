-- =====================================================================
-- SIGAF · Alta · 043 · Proveedor y contrato D6M0029 (Medina León, víveres) + su factura 3583
-- Fecha: 30/10/2026 · Pedido por Gabriel
-- Datos del N_AP_IMSS_1043 (CR 00475063): proveedor 134089 MEDINA LEON JORGE EDUARDO, contrato "D6M0029-26",
-- cuenta 51221001 Víveres, UI 010102. Pagado el 29/10/2026 (N_AP_IMSS_4002).
-- El contrato toma la misma partida, vigencia y administrador que el otro de víveres (D6M0032, Romo Alba).
-- Los montos mínimo/máximo quedan vacíos: complétalos en Catálogos cuando tengas el contrato.
-- SEGURO: no duplica proveedor, contrato ni factura. Cómo: SQL Editor → Run. Debe mostrar 1 fila (la factura).
-- =====================================================================
insert into proveedores (no_proveedor, razon_social)
select '134089', 'MEDINA LEON JORGE EDUARDO'
where not exists (select 1 from proveedores where no_proveedor = '134089' or razon_social ilike '%MEDINA LEON%JORGE%' or razon_social ilike '%JORGE%EDUARDO%MEDINA%');

insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato, adquisicion_servicio, vigencia_inicio, vigencia_fin)
select 'D6M0029',
       (select id from proveedores where no_proveedor = '134089' or razon_social ilike '%MEDINA LEON%JORGE%' or razon_social ilike '%JORGE%EDUARDO%MEDINA%' limit 1),
       r.partida_id, r.administrador_contrato, coalesce(r.adquisicion_servicio, 'Víveres'),
       coalesce(r.vigencia_inicio, date '2026-01-01'), coalesce(r.vigencia_fin, date '2026-12-31')
from (select * from contratos where numero_interno ilike 'D6M0032%' limit 1) r
where not exists (select 1 from contratos where numero_interno ilike 'D6M0029%');

with c as (
  select c.id as contrato_id, c.partida_id, c.proveedor_id, pa.capitulo_id
  from contratos c join partidas pa on pa.id = c.partida_id
  where c.numero_interno ilike 'D6M0029%' limit 1
),
ins as (
  insert into facturas (
    folio_ingreso, folio_proveedor, fecha_factura, capitulo_id, partida_id, contrato_id, proveedor_id,
    periodo_inicio, periodo_fin, importe_factura, tasa_iva,
    estatus_general, estatus_firmas, estatus_pedido_recepcion, cr_contrarecibo, fecha_pago, origen_migracion, created_by
  )
  select 'HGZ2-AMC-2026-' || lpad(((select coalesce(max(substring(folio_ingreso from '(\d+)$')::int), 0) from facturas where folio_ingreso like 'HGZ2-AMC-2026-%') + 1)::text, 6, '0'),
         '3583', date '2026-10-06', c.capitulo_id, c.partida_id, c.contrato_id, c.proveedor_id,
         date '2026-09-01', date '2026-09-30', 18502.00, 0,
         'gasto_reflejado', 'autorizada_admin_contrato', 'generado', '00475063', date '2026-10-29',
         'Alta 30/10/2026 desde Comprobantes (faltan en SIGAF): N_AP_IMSS_1043 cbte 00475063',
         (select id from usuarios where nombre = 'Gabriel Zacarias' limit 1)
  from c
  where not exists (select 1 from facturas f where f.proveedor_id = c.proveedor_id and f.anulada = false
                    and regexp_replace(f.folio_proveedor, '\D', '', 'g') = '3583')
  returning folio_ingreso, folio_proveedor, importe_factura, estatus_general, cr_contrarecibo, fecha_pago
)
select * from ins;
