-- =====================================================================
-- SIGAF · Fix candado de envío a OOAD: el pedido-recepción SOLO aplica a
-- Integrales. Antes el trigger exigía pedido_recepcion='generado' a TODOS
-- los capítulos, bloqueando Servicios Generales / Área Médica / Subrogados /
-- Compra Emergente aunque tuvieran firmas completas (como la app ya lo hacía).
-- Correr en el SQL Editor de Supabase. Solo reemplaza la función (sin datos).
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
    v_genera_pr := v_cap in ('Integrales', 'Servicios Integrales');
    if new.estatus_firmas <> 'autorizada_admin_contrato'
       or (v_genera_pr and new.estatus_pedido_recepcion <> 'generado') then
      raise exception 'No se puede enviar a OOAD: requiere firmas autorizadas (admin de contrato)%',
        case when v_genera_pr then ' Y pedido-recepción generado.' else '.' end;
    end if;
  end if;
  return new;
end $$;
-- El trigger trg_bloqueo_envio_ooad ya existe y usa esta función; no se recrea.
