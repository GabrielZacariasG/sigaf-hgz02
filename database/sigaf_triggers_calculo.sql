-- =====================================================================
-- SIGAF - Triggers de cálculo automático (Opción A: en base de datos)
-- Ejecutar DESPUÉS de sigaf_schema_piloto.sql
-- =====================================================================
-- Cubre 3 automatizaciones que hasta ahora solo existían en el mockup:
--   1. factura_detalle.importe_calculado = cantidad x precio_unitario
--   2. facturas.subtotal/iva/total_calculado + validacion_ok (tolerancia $1)
--   3. facturas.mes_asignado (regla de mayoría de días) + vigencia_alerta
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Calcular importe_calculado en factura_detalle al insertar/actualizar
-- ---------------------------------------------------------------------

create or replace function fn_calcular_importe_detalle()
returns trigger as $$
declare
    v_precio numeric(14,4);
begin
    select precio_unitario into v_precio
    from contrato_servicios
    where id = new.contrato_servicio_id;

    if v_precio is null then
        raise exception 'contrato_servicio_id % no existe en el catalogo de servicios', new.contrato_servicio_id;
    end if;

    new.importe_calculado := new.cantidad * v_precio;
    return new;
end;
$$ language plpgsql;

-- Nota: esto reemplaza la columna generated always de factura_detalle.
-- Antes de aplicar este trigger, quitar el "generated always as (...)"
-- de esa columna en el schema (una columna no puede ser generated Y
-- tener trigger que la escriba - son mutuamente excluyentes en Postgres).
alter table factura_detalle alter column importe_calculado drop expression if exists;

create trigger trg_calcular_importe_detalle
    before insert or update of cantidad, contrato_servicio_id on factura_detalle
    for each row execute function fn_calcular_importe_detalle();

-- ---------------------------------------------------------------------
-- 2. Recalcular totales de la factura cuando cambia su detalle
-- ---------------------------------------------------------------------

create or replace function fn_recalcular_totales_factura()
returns trigger as $$
declare
    v_factura_id uuid;
    v_subtotal numeric(14,2);
    v_tasa_iva numeric(5,4);
    v_iva numeric(14,2);
    v_total numeric(14,2);
    v_importe_factura numeric(14,2);
begin
    v_factura_id := coalesce(new.factura_id, old.factura_id);

    select coalesce(sum(importe_calculado), 0)
    into v_subtotal
    from factura_detalle
    where factura_id = v_factura_id;

    select tasa_iva, importe_factura into v_tasa_iva, v_importe_factura
    from facturas where id = v_factura_id;

    v_iva := round(v_subtotal * v_tasa_iva, 2);
    v_total := v_subtotal + v_iva;

    update facturas
    set subtotal_calculado = v_subtotal,
        iva_calculado = v_iva,
        total_calculado = v_total,
        -- tolerancia de $1.00 MXN, confirmada con el usuario
        validacion_ok = (abs(v_total - v_importe_factura) <= 1.00)
    where id = v_factura_id;

    return null;
end;
$$ language plpgsql;

create trigger trg_recalcular_totales_ins_upd
    after insert or update on factura_detalle
    for each row execute function fn_recalcular_totales_factura();

create trigger trg_recalcular_totales_del
    after delete on factura_detalle
    for each row execute function fn_recalcular_totales_factura();

-- ---------------------------------------------------------------------
-- 3. Mes asignado (regla de mayoría de días) + alerta de vigencia
-- ---------------------------------------------------------------------
-- Regla confirmada: nunca hay facturas trimestrales, el periodo toca
-- como máximo dos meses calendario. Empate 50/50 -> se asigna al mes
-- de la fecha de término (supuesto declarado; ajustar si no aplica).
-- ---------------------------------------------------------------------

create or replace function fn_calcular_mes_y_vigencia()
returns trigger as $$
declare
    v_dias_mes_inicio integer;
    v_dias_mes_fin integer;
    v_fin_mes_inicio date;
    v_vigencia_inicio date;
    v_vigencia_fin date;
begin
    -- Mes asignado por mayoría de días
    v_fin_mes_inicio := (date_trunc('month', new.periodo_inicio) + interval '1 month - 1 day')::date;

    if new.periodo_fin <= v_fin_mes_inicio then
        -- todo el periodo cae en un solo mes
        new.mes_asignado := extract(month from new.periodo_inicio);
        new.anio_asignado := extract(year from new.periodo_inicio);
    else
        v_dias_mes_inicio := v_fin_mes_inicio - new.periodo_inicio + 1;
        v_dias_mes_fin := new.periodo_fin - (v_fin_mes_inicio + 1) + 1;

        if v_dias_mes_fin >= v_dias_mes_inicio then
            -- incluye el caso de empate: se asigna al mes de término
            new.mes_asignado := extract(month from new.periodo_fin);
            new.anio_asignado := extract(year from new.periodo_fin);
        else
            new.mes_asignado := extract(month from new.periodo_inicio);
            new.anio_asignado := extract(year from new.periodo_inicio);
        end if;
    end if;

    -- Alerta de vigencia contra el contrato seleccionado
    select vigencia_inicio, vigencia_fin into v_vigencia_inicio, v_vigencia_fin
    from contratos where id = new.contrato_id;

    if new.periodo_fin < v_vigencia_inicio or new.periodo_inicio > v_vigencia_fin then
        new.vigencia_alerta := 'sin_vigencia';
    elsif v_vigencia_fin - current_date <= 30 then
        new.vigencia_alerta := 'por_vencer';
    else
        new.vigencia_alerta := null;
    end if;

    return new;
end;
$$ language plpgsql;

create trigger trg_calcular_mes_y_vigencia
    before insert or update of periodo_inicio, periodo_fin, contrato_id on facturas
    for each row execute function fn_calcular_mes_y_vigencia();

-- ---------------------------------------------------------------------
-- 4. Registrar automáticamente el historial de estatus (fechas por etapa)
-- ---------------------------------------------------------------------

create or replace function fn_registrar_historial_estatus()
returns trigger as $$
begin
    if (tg_op = 'INSERT') or (new.estatus_actual is distinct from old.estatus_actual) then
        insert into factura_estatus_historial (factura_id, estatus, usuario_id)
        values (new.id, new.estatus_actual, new.created_by);
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trg_historial_estatus
    after insert or update of estatus_actual on facturas
    for each row execute function fn_registrar_historial_estatus();
