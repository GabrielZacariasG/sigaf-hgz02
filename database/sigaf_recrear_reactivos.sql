-- =====================================================================
-- SIGAF · Recrear 2 facturas REALES de REACTIVOS Y QUIMICOS que se
-- borraron por error (se habían capturado con "PRUEBA" en el folio y sin
-- desglose, y entraron en la limpieza de pruebas del 2026-09-11).
--   MTY26685  $1,241,561.92  JULIO  (26/jun–25/jul)
--   MTY26686  $  573,807.92  AGOSTO (26/jul–07/ago)
-- Contrato 050GYR032N13825-182-00 (Integrales). Estatus SE/AC del 09-09:
--   firmas = autorizada_admin_contrato ; general = en_revision.
-- Anti-duplicado: no inserta si el folio ya existe.
-- Correr en el SQL Editor de Supabase. Transaccional.
-- =====================================================================

begin;

with base as (
  select coalesce(max((substring(folio_ingreso from 'HGZ2-INT-2026-(\d+)$'))::int), 0) as maxn
  from facturas where folio_ingreso ~ '^HGZ2-INT-2026-\d+$'
),
datos(rn, folio_prov, importe, contrato_num, mes, anio, peri_ini, peri_fin) as (
  values
    (1, 'MTY26685', 1241561.92::numeric, '050GYR032N13825-182-00', 7, 2026, date '2026-06-26', date '2026-07-25'),
    (2, 'MTY26686',  573807.92::numeric, '050GYR032N13825-182-00', 8, 2026, date '2026-07-26', date '2026-08-07')
)
insert into facturas (
  folio_ingreso, folio_proveedor, capitulo_id, partida_id, contrato_id, proveedor_id,
  periodo_inicio, periodo_fin, mes_asignado, anio_asignado,
  tasa_iva, importe_factura, estatus_general, estatus_firmas, estatus_pedido_recepcion, anulada
)
select
  'HGZ2-INT-2026-' || lpad((b.maxn + row_number() over (order by d.rn))::text, 6, '0'),
  d.folio_prov, pa.capitulo_id, ct.partida_id, ct.id, ct.proveedor_id,
  d.peri_ini, d.peri_fin, d.mes, d.anio,
  0.16, d.importe, 'en_revision', 'autorizada_admin_contrato', 'generado', false
from datos d
cross join base b
join lateral (
  select id, partida_id, proveedor_id from contratos
  where numero_interno = d.contrato_num order by vigencia_inicio desc limit 1
) ct on true
join partidas pa on pa.id = ct.partida_id
where not exists (
  select 1 from facturas f where f.folio_proveedor = d.folio_prov and f.anulada = false
);

-- Verificación
select folio_ingreso, folio_proveedor, importe_factura, estatus_general, estatus_firmas,
       periodo_inicio, periodo_fin
from facturas
where folio_proveedor in ('MTY26685', 'MTY26686')
order by folio_proveedor;

commit;
