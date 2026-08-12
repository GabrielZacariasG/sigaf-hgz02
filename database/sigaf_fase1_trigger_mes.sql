-- =====================================================================
-- SIGAF · Fase 1 — Corregir el trigger que pisaba mes_asignado
-- =====================================================================
-- Problema: fn_calcular_mes_y_vigencia derivaba mes_asignado del periodo
-- (mayoría de días) e ignoraba lo enviado. Para un pasivo eso hacía
-- mes_asignado == mes_presupuestal -> violaba chk_facturas_pasivo_anterior.
-- Además: la migración de pasivos dejó mes_presupuestal/anio_presupuestal
-- como NOT NULL, pero el trigger no los llenaba -> una captura nueva desde
-- la app reventaría por NOT NULL. Este arreglo cubre ambas cosas.
--
-- Semántica nueva:
--   mes_presupuestal / anio_presupuestal  = periodo del SERVICIO (del periodo)
--   mes_asignado / anio_asignado (ejercicio):
--       factura normal -> coincide con el presupuestal
--       pasivo         -> se respeta el valor enviado (periodo posterior)
--
-- create or replace de la función; el trigger existente la sigue usando.
-- No cambia columnas. No re-migra las 94 filas (un trigger solo afecta
-- inserciones/updates nuevos).
-- =====================================================================
begin;

create or replace function fn_calcular_mes_y_vigencia()
returns trigger as $$
declare
    v_dias_mes_inicio integer;
    v_dias_mes_fin    integer;
    v_fin_mes_inicio  date;
    v_mes  integer;
    v_anio integer;
    v_vig_ini date;
    v_vig_fin date;
begin
    -- Periodo PRESUPUESTAL (a qué mes pertenece el servicio), por mayoría de días
    v_fin_mes_inicio := (date_trunc('month', new.periodo_inicio) + interval '1 month - 1 day')::date;
    if new.periodo_fin <= v_fin_mes_inicio then
        v_mes  := extract(month from new.periodo_inicio);
        v_anio := extract(year  from new.periodo_inicio);
    else
        v_dias_mes_inicio := v_fin_mes_inicio - new.periodo_inicio + 1;
        v_dias_mes_fin    := new.periodo_fin - (v_fin_mes_inicio + 1) + 1;
        if v_dias_mes_fin >= v_dias_mes_inicio then      -- empate -> mes de término
            v_mes  := extract(month from new.periodo_fin);
            v_anio := extract(year  from new.periodo_fin);
        else
            v_mes  := extract(month from new.periodo_inicio);
            v_anio := extract(year  from new.periodo_inicio);
        end if;
    end if;

    new.mes_presupuestal  := v_mes;
    new.anio_presupuestal := v_anio;

    -- Ejercicio: normal = presupuestal; pasivo = se respeta lo enviado (posterior)
    if not coalesce(new.es_pasivo, false) then
        new.mes_asignado  := v_mes;
        new.anio_asignado := v_anio;
    end if;

    -- Alerta de vigencia (igual que el trigger original)
    select vigencia_inicio, vigencia_fin into v_vig_ini, v_vig_fin
    from contratos where id = new.contrato_id;
    if new.periodo_fin < v_vig_ini or new.periodo_inicio > v_vig_fin then
        new.vigencia_alerta := 'sin_vigencia';
    elsif v_vig_fin - current_date <= 30 then
        new.vigencia_alerta := 'por_vencer';
    else
        new.vigencia_alerta := null;
    end if;

    return new;
end;
$$ language plpgsql;

commit;
