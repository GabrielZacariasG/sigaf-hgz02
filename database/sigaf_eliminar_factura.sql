-- =====================================================================
-- SIGAF · Eliminar factura (permiso para Presupuesto y Finanzas)
-- Función SECURITY DEFINER: borra una factura con permisos elevados,
-- limpiando antes las referencias que no tienen cascade (oficios, OOAD,
-- enlaces de devolución). Solo la pueden ejecutar jefe_presupuesto y
-- jefa_finanzas (se valida con public.mi_rol()).
-- El desglose, historial y validaciones caen por CASCADE.
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

create or replace function public.fn_eliminar_factura(p_factura_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  v_rol := public.mi_rol()::text;
  if v_rol is null or v_rol not in ('jefe_presupuesto', 'jefa_finanzas') then
    raise exception 'No autorizado: solo Presupuesto o Finanzas pueden eliminar facturas.';
  end if;

  -- Quitar la factura de cualquier oficio (columna array factura_ids)
  update oficios o
     set factura_ids = coalesce((select array_agg(x) from unnest(o.factura_ids) x where x <> p_factura_id), '{}')
   where p_factura_id = any(o.factura_ids);

  -- Soltar conciliación OOAD (sin cascade)
  update ooad_import_filas
     set matched_factura_id = null, matched_at = null, matched_by = null
   where matched_factura_id = p_factura_id;

  -- Romper enlaces de sustitución (devoluciones)
  update facturas set sustituida_por_id = null where sustituida_por_id = p_factura_id;
  update facturas set sustituye_a_id    = null where sustituye_a_id    = p_factura_id;

  -- Borrar (factura_detalle, historial y validaciones caen por CASCADE)
  delete from facturas where id = p_factura_id;
end;
$$;

revoke all on function public.fn_eliminar_factura(uuid) from public;
grant execute on function public.fn_eliminar_factura(uuid) to authenticated;
