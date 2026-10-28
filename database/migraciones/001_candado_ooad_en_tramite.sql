-- =====================================================================
-- SIGAF · Fase 0 · 001 · Candado de envío a pago también para "En trámite OOAD"
-- Fecha: 28/10/2026
--
-- Problema: el candado (fn_bloqueo_envio_ooad) solo revisaba el paso a
-- 'enviada_ooad', pero el oficio SIGAF-EP pasa las facturas directo a
-- 'en_tramite_ooad'. Así, una factura sin firmas o sin pedido-recepción podía
-- quedar como enviada a pago.
--
-- Ahora: cualquier paso a 'enviada_ooad' o 'en_tramite_ooad' desde una etapa
-- anterior (capturada, en revisión, devuelta) exige las mismas reglas de siempre.
-- Excepción: si la factura ya trae CR (contra recibo), es porque el SISTEMA
-- institucional ya la tiene registrada (conciliación con N_AP): ese es un hecho,
-- no un envío nuestro, y se permite.
--
-- Base: la versión vigente del 21/09/2026 (database/sigaf_pedido_recepcion.sql).
-- Cómo correrlo: SQL Editor de Supabase. Solo reemplaza la función; no toca datos.
-- =====================================================================
create or replace function fn_bloqueo_envio_ooad()
returns trigger language plpgsql as $$
declare
  v_cap text;
  v_genera_pr boolean;
  v_cuenta_pr boolean;
begin
  if new.estatus_general in ('enviada_ooad', 'en_tramite_ooad')
     and coalesce(old.estatus_general::text, '') not in ('enviada_ooad', 'en_tramite_ooad', 'gasto_reflejado')
     and nullif(btrim(coalesce(new.cr_contrarecibo::text, '')), '') is null then
    select cap.nombre into v_cap from capitulos cap where cap.id = new.capitulo_id;

    if v_cap = 'Compra Emergente' then
      if new.estatus_firmas not in ('autorizada_servicio', 'autorizada_admin_contrato') then
        raise exception 'No se puede enviar a pago: Compra Emergente requiere la validación del servicio.';
      end if;
    else
      select (pa.cuenta_finat in ('51251019','51251006','51251018')
              or pa.cuenta_prei in ('51251019','51251006','51251018'))
        into v_cuenta_pr
      from partidas pa where pa.id = new.partida_id;

      v_genera_pr := v_cap in ('Integrales', 'Servicios Integrales') or coalesce(v_cuenta_pr, false);

      if new.estatus_firmas <> 'autorizada_admin_contrato'
         or (v_genera_pr and new.estatus_pedido_recepcion <> 'generado') then
        raise exception 'No se puede enviar a pago: requiere firmas autorizadas (admin de contrato)%',
          case when v_genera_pr then ' Y pedido-recepción generado (con su número de pedido y recepción).' else '.' end;
      end if;
    end if;
  end if;
  return new;
end $$;
-- El trigger trg_bloqueo_envio_ooad ya existe y usa esta función; no se recrea.

-- Verificación (solo lectura): facturas que HOY están en OOAD sin cumplir el candado
-- (entraron antes de este cambio por el botón masivo). Revisarlas una por una.
select f.folio_ingreso, f.folio_proveedor, cap.nombre as capitulo, f.estatus_general, f.estatus_firmas,
       f.estatus_pedido_recepcion, f.cr_contrarecibo, f.importe_factura
from facturas f
join capitulos cap on cap.id = f.capitulo_id
left join partidas pa on pa.id = f.partida_id
where f.anulada = false
  and f.estatus_general in ('enviada_ooad', 'en_tramite_ooad')
  and nullif(btrim(coalesce(f.cr_contrarecibo::text, '')), '') is null
  and (
    (cap.nombre = 'Compra Emergente' and f.estatus_firmas not in ('autorizada_servicio', 'autorizada_admin_contrato'))
    or (cap.nombre <> 'Compra Emergente' and (
          f.estatus_firmas <> 'autorizada_admin_contrato'
          or ((cap.nombre in ('Integrales', 'Servicios Integrales') or pa.cuenta_finat in ('51251019','51251006','51251018') or pa.cuenta_prei in ('51251019','51251006','51251018'))
              and f.estatus_pedido_recepcion <> 'generado')))
  )
order by cap.nombre, f.folio_ingreso;
