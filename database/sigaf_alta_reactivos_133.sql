-- =====================================================================
-- SIGAF · Alta del contrato 050GYR032N07426-133-00 (REACTIVOS Y QUIMICOS)
-- + recrear la factura MTY26760 ($733,147.84, AGOSTO 08–25) que nunca se
-- había capturado (su contrato no existía).
-- El contrato se crea con la MISMA cuenta/partida que el 050GYR032N13825-182-00
-- (mismo proveedor, mismo tipo: reactivos/Integrales). Si la cuenta real es
-- otra, ajústala luego en Catálogos.
-- Vigencia placeholder 2026 (ajustable). Estatus SE/AC 09-09 -> firmas
-- autorizada_admin_contrato, general en_revision.
-- Correr en el SQL Editor de Supabase. Transaccional. Idempotente.
-- =====================================================================

begin;

-- 1) Alta del contrato (si no existe), copiando proveedor + partida del 182-00
insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin)
select '050GYR032N07426-133-00', ref.proveedor_id, ref.partida_id,
       'Reactivos y quimicos', date '2026-01-01', date '2026-12-31'
from (
  select proveedor_id, partida_id from contratos
  where numero_interno = '050GYR032N13825-182-00'
  order by vigencia_inicio desc limit 1
) ref
where not exists (select 1 from contratos where numero_interno = '050GYR032N07426-133-00');

-- 2) Recrear MTY26760 en ese contrato
with base as (
  select coalesce(max((substring(folio_ingreso from 'HGZ2-INT-2026-(\d+)$'))::int), 0) as maxn
  from facturas where folio_ingreso ~ '^HGZ2-INT-2026-\d+$'
)
insert into facturas (
  folio_ingreso, folio_proveedor, capitulo_id, partida_id, contrato_id, proveedor_id,
  periodo_inicio, periodo_fin, mes_asignado, anio_asignado,
  tasa_iva, importe_factura, estatus_general, estatus_firmas, estatus_pedido_recepcion, anulada
)
select
  'HGZ2-INT-2026-' || lpad((b.maxn + 1)::text, 6, '0'),
  'MTY26760', pa.capitulo_id, ct.partida_id, ct.id, ct.proveedor_id,
  date '2026-08-08', date '2026-08-25', 8, 2026,
  0.16, 733147.84, 'en_revision', 'autorizada_admin_contrato', 'generado', false
from base b
join lateral (
  select id, partida_id, proveedor_id from contratos
  where numero_interno = '050GYR032N07426-133-00' order by vigencia_inicio desc limit 1
) ct on true
join partidas pa on pa.id = ct.partida_id
where not exists (
  select 1 from facturas f where f.folio_proveedor = 'MTY26760' and f.anulada = false
);

-- Verificación
select f.folio_ingreso, f.folio_proveedor, c.numero_interno as contrato,
       (select nombre from partidas p where p.id = c.partida_id) as partida,
       f.importe_factura, f.estatus_general, f.estatus_firmas, f.periodo_inicio, f.periodo_fin
from facturas f join contratos c on c.id = f.contrato_id
where f.folio_proveedor = 'MTY26760';

commit;
