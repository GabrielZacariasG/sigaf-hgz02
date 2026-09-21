-- =====================================================================
-- SIGAF · Pedido-Recepción (P&R) — Fase 1
-- Flujo real: tras validar el servicio se SOLICITA el P&R (antes del admin
-- de contrato); al regresar queda "en espera de P&R"; cuando llega el P&R
-- se captura el número de PEDIDO y de RECEPCIÓN y queda listo para pago.
-- Aplica a Integrales + cuentas de Área Médica 51251019 / 51251006 / 51251018.
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

-- 1) Números de pedido y recepción en la factura
alter table facturas add column if not exists numero_pedido    text;
alter table facturas add column if not exists numero_recepcion text;

-- 2) Candado de envío a OOAD: pedido-recepción 'generado' se exige a Integrales
--    Y a esas cuentas de Área Médica (además de la firma del admin de contrato).
--    Compra Emergente sigue sin admin de contrato (solo validación del servicio).
create or replace function fn_bloqueo_envio_ooad()
returns trigger language plpgsql as $$
declare
  v_cap text;
  v_genera_pr boolean;
  v_cuenta_pr boolean;
begin
  if new.estatus_general = 'enviada_ooad'
     and old.estatus_general is distinct from 'enviada_ooad' then
    select cap.nombre into v_cap from capitulos cap where cap.id = new.capitulo_id;

    if v_cap = 'Compra Emergente' then
      if new.estatus_firmas not in ('autorizada_servicio', 'autorizada_admin_contrato') then
        raise exception 'No se puede enviar a OOAD: Compra Emergente requiere la validación del servicio.';
      end if;
    else
      select (pa.cuenta_finat in ('51251019','51251006','51251018')
              or pa.cuenta_prei in ('51251019','51251006','51251018'))
        into v_cuenta_pr
      from partidas pa where pa.id = new.partida_id;

      v_genera_pr := v_cap in ('Integrales', 'Servicios Integrales') or coalesce(v_cuenta_pr, false);

      if new.estatus_firmas <> 'autorizada_admin_contrato'
         or (v_genera_pr and new.estatus_pedido_recepcion <> 'generado') then
        raise exception 'No se puede enviar a OOAD: requiere firmas autorizadas (admin de contrato)%',
          case when v_genera_pr then ' Y pedido-recepción generado (con su número de pedido y recepción).' else '.' end;
      end if;
    end if;
  end if;
  return new;
end $$;
-- El trigger trg_bloqueo_envio_ooad ya existe y usa esta función; no se recrea.
