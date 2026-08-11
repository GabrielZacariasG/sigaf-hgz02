-- =====================================================================
-- SIGAF · Rediseño de estatus a 3 ejes — MIGRACIÓN 1 (EXPANDIR)
-- =====================================================================
-- Patrón expand/contract (compatible hacia atrás, sin ventana de caída).
-- Esta migración agrega el modelo nuevo SIN quitar estatus_actual ni el
-- enum viejo, así que la app anterior (que lee estatus_actual) sigue
-- funcionando mientras se despliega el código nuevo.
--
-- Orden de despliegue:
--   1) correr ESTA migración (M1)  <-- segura, ahora
--   2) fusionar/desplegar el código nuevo (usa estatus_general)
--   3) verificar
--   4) correr sigaf_m2_contract_circuitos.sql (M2)  <-- quita lo viejo
--
-- Modelo: 3 ejes independientes
--   general           : capturada -> en_revision -> enviada_ooad -> en_tramite_ooad -> gasto_reflejado
--   firmas            : pendiente -> envio_firmas_servicio -> autorizada_servicio ->
--                       envio_firmas_admin_contrato -> autorizada_admin_contrato
--   pedido_recepcion  : pendiente -> solicitado_fsi -> generado
-- Regla dura: enviar a OOAD requiere firmas='autorizada_admin_contrato'
--             y pedido_recepcion='generado' (trigger, no solo UI).
-- Sin control de rol: los 3 roles (auo/jefe_presupuesto/jefa_finanzas)
-- pueden cambiar cualquier eje. (No afecta la regla de conciliación P5.)
-- =====================================================================
begin;

-- 1. Enums nuevos
create type estatus_general as enum
  ('capturada','en_revision','enviada_ooad','en_tramite_ooad','gasto_reflejado');
create type estatus_firmas as enum
  ('pendiente','envio_firmas_servicio','autorizada_servicio',
   'envio_firmas_admin_contrato','autorizada_admin_contrato');
create type estatus_pedido_recepcion as enum
  ('pendiente','solicitado_fsi','generado');
create type tipo_circuito as enum ('general','firmas','pedido_recepcion');

-- 2. Borrón y cuenta nueva (datos de prueba); cascade limpia detalle e historial
delete from facturas;

-- 3. Quitar triggers/funciones viejas basadas en estatus_actual
--    (el viejo de historial es incompatible con el historial nuevo,
--     que exige la columna 'circuito')
drop trigger  if exists trg_historial_estatus      on facturas;
drop function if exists fn_registrar_historial_estatus();
drop trigger  if exists trg_control_cambio_estatus on facturas;
drop function if exists fn_control_cambio_estatus();

-- 4. Columnas nuevas — SE CONSERVA estatus_actual (se elimina en M2)
alter table facturas
  add column estatus_general           estatus_general          not null default 'capturada',
  add column estatus_firmas            estatus_firmas           not null default 'pendiente',
  add column estatus_pedido_recepcion  estatus_pedido_recepcion not null default 'pendiente';

-- 5. factura_estatus_historial: circuito + estatus como text (tabla vacía)
alter table factura_estatus_historial add column circuito tipo_circuito;
alter table factura_estatus_historial alter column estatus type text using estatus::text;
alter table factura_estatus_historial alter column circuito set not null;

-- 6. alertas_config: umbral por (circuito, estatus) + reseed
alter table alertas_config drop constraint if exists alertas_config_pkey;
alter table alertas_config alter column estatus type text using estatus::text;
alter table alertas_config add column circuito tipo_circuito;
delete from alertas_config;
alter table alertas_config alter column circuito set not null;
alter table alertas_config add primary key (circuito, estatus);
insert into alertas_config (circuito, estatus, dias_umbral) values
  ('general','capturada',2),
  ('general','en_revision',5),
  ('general','enviada_ooad',10),
  ('general','en_tramite_ooad',20),
  ('firmas','envio_firmas_servicio',3),
  ('firmas','autorizada_servicio',2),
  ('firmas','envio_firmas_admin_contrato',3),
  ('pedido_recepcion','solicitado_fsi',8);

-- 7. Trigger: historial de los 3 ejes.
--    - Registra SOLO el eje que cambió, etiquetado con su circuito.
--    - usuario_id = quien de verdad hizo el cambio (auth.uid()).
--    - clock_timestamp() da fechas distintas aun dentro de una misma
--      transacción (p. ej. capturada + en_revision en el mismo INSERT).
create or replace function fn_registrar_historial()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_usuario uuid := (select id from usuarios where auth_id = auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into factura_estatus_historial (factura_id, circuito, estatus, usuario_id, fecha)
      values (new.id, 'general', new.estatus_general::text, v_usuario, clock_timestamp());
    return new;
  end if;
  if new.estatus_general is distinct from old.estatus_general then
    insert into factura_estatus_historial (factura_id, circuito, estatus, usuario_id, fecha)
      values (new.id, 'general', new.estatus_general::text, v_usuario, clock_timestamp());
  end if;
  if new.estatus_firmas is distinct from old.estatus_firmas then
    insert into factura_estatus_historial (factura_id, circuito, estatus, usuario_id, fecha)
      values (new.id, 'firmas', new.estatus_firmas::text, v_usuario, clock_timestamp());
  end if;
  if new.estatus_pedido_recepcion is distinct from old.estatus_pedido_recepcion then
    insert into factura_estatus_historial (factura_id, circuito, estatus, usuario_id, fecha)
      values (new.id, 'pedido_recepcion', new.estatus_pedido_recepcion::text, v_usuario, clock_timestamp());
  end if;
  return new;
end $$;
create trigger trg_a_historial
  after insert or update of estatus_general, estatus_firmas, estatus_pedido_recepcion
  on facturas for each row execute function fn_registrar_historial();

-- 8. Trigger: auto capturada -> en_revision al INSERT (sin intervención manual)
create or replace function fn_auto_en_revision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estatus_general = 'capturada' then
    update facturas set estatus_general = 'en_revision' where id = new.id;
  end if;
  return null;
end $$;
create trigger trg_b_auto_en_revision
  after insert on facturas for each row execute function fn_auto_en_revision();

-- 9. Candado DURO: no enviar a OOAD si algún circuito no cerró
create or replace function fn_bloqueo_envio_ooad()
returns trigger language plpgsql as $$
begin
  if new.estatus_general = 'enviada_ooad'
     and old.estatus_general is distinct from 'enviada_ooad' then
    if new.estatus_firmas <> 'autorizada_admin_contrato'
       or new.estatus_pedido_recepcion <> 'generado' then
      raise exception 'No se puede enviar a OOAD: requiere firmas autorizadas (admin de contrato) Y pedido-recepción generado.';
    end if;
  end if;
  return new;
end $$;
create trigger trg_bloqueo_envio_ooad
  before update of estatus_general on facturas for each row execute function fn_bloqueo_envio_ooad();

commit;
