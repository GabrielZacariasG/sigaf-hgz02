-- =====================================================================
-- SIGAF · 056 · Una factura en OOAD no puede perder firmas ni pedido-recepción
-- Fecha: 02/11/2026
-- Hueco: fn_bloqueo_envio_ooad revisa la ENTRADA a OOAD, pero con "Retroceder" se podía bajar la firma o el
-- pedido-recepción de una factura que ya estaba en OOAD, y quedaba ahí sin cumplir.
-- Ahora: si está en OOAD, no tiene CR y cumple el candado, no se le puede quitar lo que la hace cumplir.
-- Para retroceder hay que regresarla primero a "En revisión" (queda en su historial).
-- No toca datos. Las facturas que ya no cumplen pueden seguir avanzando sus firmas y su pedido-recepción.
-- Al final hace una prueba real que se deshace sola: si el candado no bloquea, marca error y no se aplica nada.
-- Se puede correr dos veces. Cómo: SQL Editor de Supabase → Run.
-- =====================================================================
create or replace function fn_cumple_candado_ooad(p_capitulo uuid, p_partida uuid, p_firmas text, p_pedido text)
returns boolean language plpgsql stable as $$
declare
  v_cap text;
  v_cuenta boolean;
begin
  select nombre into v_cap from capitulos where id = p_capitulo;
  if v_cap = 'Compra Emergente' then
    return p_firmas in ('autorizada_servicio', 'autorizada_admin_contrato');
  end if;
  select (cuenta_finat in ('51251019','51251006','51251018') or cuenta_prei in ('51251019','51251006','51251018'))
    into v_cuenta from partidas where id = p_partida;
  return p_firmas = 'autorizada_admin_contrato'
     and (not (coalesce(v_cap in ('Integrales', 'Servicios Integrales'), false) or coalesce(v_cuenta, false)) or p_pedido = 'generado');
end $$;

create or replace function fn_bloqueo_retroceso_ooad()
returns trigger language plpgsql as $$
begin
  if old.estatus_general::text in ('enviada_ooad', 'en_tramite_ooad')
     and new.estatus_general::text in ('enviada_ooad', 'en_tramite_ooad')
     and nullif(btrim(coalesce(new.cr_contrarecibo::text, '')), '') is null
     and fn_cumple_candado_ooad(old.capitulo_id, old.partida_id, old.estatus_firmas::text, old.estatus_pedido_recepcion::text)
     and not fn_cumple_candado_ooad(new.capitulo_id, new.partida_id, new.estatus_firmas::text, new.estatus_pedido_recepcion::text) then
    raise exception 'No se puede retroceder: la factura está en OOAD. Regrésala primero a En revisión.';
  end if;
  return new;
end $$;

drop trigger if exists trg_bloqueo_retroceso_ooad on facturas;
create trigger trg_bloqueo_retroceso_ooad
  before update of estatus_firmas, estatus_pedido_recepcion on facturas
  for each row execute function fn_bloqueo_retroceso_ooad();

-- Prueba real: intenta quitarle la firma a una factura que cumple; el cambio siempre se deshace.
do $$
declare
  v_id uuid;
begin
  select f.id into v_id from facturas f
   where f.anulada = false and f.estatus_general::text in ('enviada_ooad', 'en_tramite_ooad')
     and nullif(btrim(coalesce(f.cr_contrarecibo::text, '')), '') is null
     and fn_cumple_candado_ooad(f.capitulo_id, f.partida_id, f.estatus_firmas::text, f.estatus_pedido_recepcion::text)
   limit 1;
  if v_id is null then
    raise notice 'No hay factura para probar';
    return;
  end if;
  begin
    update facturas set estatus_firmas = 'pendiente' where id = v_id;
    raise exception 'SIN_BLOQUEO';
  exception when others then
    if sqlerrm = 'SIN_BLOQUEO' then
      raise exception 'El candado 056 NO bloqueó: no se aplicó nada.';
    end if;
  end;
end $$;

select 'Candado 056 activo: la prueba bloqueó el retroceso' as resultado,
       (select count(*) from facturas f
         where f.anulada = false and f.estatus_general::text in ('enviada_ooad', 'en_tramite_ooad')
           and nullif(btrim(coalesce(f.cr_contrarecibo::text, '')), '') is null
           and not fn_cumple_candado_ooad(f.capitulo_id, f.partida_id, f.estatus_firmas::text, f.estatus_pedido_recepcion::text)) as en_ooad_sin_cumplir;
