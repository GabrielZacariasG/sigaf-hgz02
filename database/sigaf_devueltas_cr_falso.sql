-- =====================================================================
-- SIGAF · 3 devoluciones de Compra Emergente ($0) cuyo "CR" era una nota
-- (DEV / CANCELAR...), no un contra-recibo real.
-- Se conservan como devuelta_proveedor; la nota pasa a motivo_devolucion
-- y se limpia cr_contrarecibo (una devolución no lleva contra-recibo).
-- Correr en el SQL Editor de Supabase.
-- =====================================================================

begin;

update facturas
set motivo_devolucion = coalesce(nullif(trim(motivo_devolucion), ''), cr_contrarecibo),
    cr_contrarecibo   = null
where estatus_general = 'devuelta_proveedor'
  and coalesce(trim(cr_contrarecibo), '') <> ''
  and folio_ingreso in ('HGZ2-CE-2026-000002', 'HGZ2-CE-2026-000022', 'HGZ2-CE-2026-000650');

select folio_ingreso, estatus_general, cr_contrarecibo, motivo_devolucion
from facturas
where folio_ingreso in ('HGZ2-CE-2026-000002', 'HGZ2-CE-2026-000022', 'HGZ2-CE-2026-000650');

commit;
