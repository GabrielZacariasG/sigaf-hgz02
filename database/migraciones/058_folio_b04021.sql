-- =====================================================================
-- SIGAF · 058 · Folio mal capturado: B0421 es B04021 (Representaciones Médicas, $87.00)
-- Fecha: 03/11/2026
-- La cédula (hoja cb, fila 1010) la trae como B04021: 14/10/2026, $87.00, OC 2884908. Sus vecinas en SIGAF son B04020 y B04022.
-- Comprobado antes de escribir esto: ninguna factura de SIGAF tiene el folio B04021.
-- Solo cambia el folio. No toca importe, estatus, firmas ni oficios. Va en el oficio SIGAF-ES-0108/2026 por su id, así que sigue ligada.
-- SEGURO: solo cambia esa factura con ese folio e importe, no anulada. Si ya no coincide o B04021 ya existe, marca error y no aplica nada.
-- Se puede correr solo una vez: la segunda marca error sin cambiar nada.
-- Cómo: SQL Editor de Supabase → Run. Al final muestra la factura.
-- =====================================================================
do $$
declare
  n integer;
begin
  if exists (select 1 from facturas where folio_proveedor = 'B04021') then
    raise exception 'Ya existe una factura con folio B04021. No se aplicó nada.';
  end if;

  update facturas set folio_proveedor = 'B04021'
   where folio_ingreso = 'HGZ2-CE-2026-001008'
     and folio_proveedor = 'B0421'
     and importe_factura = 87.00
     and anulada = false;
  get diagnostics n = row_count;

  if n <> 1 then
    raise exception 'Se esperaba 1 factura; salieron %. No se aplicó nada.', n;
  end if;
end $$;

select folio_ingreso, folio_proveedor, importe_factura, estatus_general, estatus_firmas
  from facturas
 where folio_ingreso = 'HGZ2-CE-2026-001008';
