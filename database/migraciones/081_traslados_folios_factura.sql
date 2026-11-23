-- =====================================================================
-- SIGAF · 081 · Ligar folios de traslado (SCACE) a la factura de autobuses
-- Fecha: 23/11/2026
-- Antes: un folio de traslado se daba por facturado SOLO por la fecha del viaje (periodo del contrato).
-- Ahora, igual que en subrogados, al capturar la factura de autobuses se SELECCIONAN los folios que cubre y
-- quedan LIGADOS a esa factura (candado: un folio ligado no se puede volver a usar en otra factura).
-- Al devolver/anular/eliminar/re-facturar, los folios se LIBERAN y vuelven a DEVENGO.
-- Se puede correr dos veces (add column if not exists). No borra ligas: volver a subir el SCACE no manda estas
-- columnas (lib/traslados.js solo upserta las columnas del archivo), así que una liga hecha a mano se conserva.
-- Cómo: SQL Editor de Supabase → Run.
-- =====================================================================
alter table traslados_folios
  add column if not exists factura_id uuid references facturas(id) on delete set null,
  add column if not exists ligado_por uuid,
  add column if not exists ligado_at  timestamptz;

create index if not exists idx_trasfol_factura on traslados_folios (factura_id);

select 'traslados_folios' as tabla,
       count(*)                                as folios,
       count(*) filter (where factura_id is not null) as ligados
from traslados_folios;
