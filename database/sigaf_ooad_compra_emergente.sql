-- =====================================================================
-- SIGAF · Candado de envío a OOAD: Compra Emergente NO requiere firma del
-- Administrador de Contrato — le basta la VALIDACIÓN DEL SERVICIO.
-- Los demás capítulos siguen requiriendo firmas de admin de contrato
-- (e Integrales además el pedido-recepción generado).
-- Reemplaza la función del trigger. Correr en el SQL Editor de Supabase.
-- =====================================================================

create or replace function fn_bloqueo_envio_ooad()
returns trigger language plpgsql as $$
declare
  v_cap text;
  v_genera_pr boolean;
begin
  if new.estatus_general = 'enviada_ooad'
     and old.estatus_general is distinct from 'enviada_ooad' then
    select cap.nombre into v_cap from capitulos cap where cap.id = new.capitulo_id;

    if v_cap = 'Compra Emergente' then
      -- Solo requiere validación del servicio (o más).
      if new.estatus_firmas not in ('autorizada_servicio', 'autorizada_admin_contrato') then
        raise exception 'No se puede enviar a OOAD: Compra Emergente requiere la validación del servicio.';
      end if;
    else
      v_genera_pr := v_cap in ('Integrales', 'Servicios Integrales');
      if new.estatus_firmas <> 'autorizada_admin_contrato'
         or (v_genera_pr and new.estatus_pedido_recepcion <> 'generado') then
        raise exception 'No se puede enviar a OOAD: requiere firmas autorizadas (admin de contrato)%',
          case when v_genera_pr then ' Y pedido-recepción generado.' else '.' end;
      end if;
    end if;
  end if;
  return new;
end $$;
-- El trigger trg_bloqueo_envio_ooad ya existe y usa esta función; no se recrea.
