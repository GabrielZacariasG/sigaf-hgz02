-- =====================================================================
-- SIGAF · 054 · Apoyos que el HGZ 2 da a otras unidades
-- Fecha: 02/11/2026
-- Regla de Gabriel: el apoyo se captura primero en DEVENGO y después se registra el GASTO, para que se descuente
-- del saldo del dictamen del HGZ 2:
--   · devengo → se descuenta del saldo del dictamen desde que se captura
--   · gasto   → cuenta como gasto del contrato; se sigue descontando hasta que se carga un IMKK036 con corte
--               POSTERIOR a fecha_gasto, porque desde ese corte FINAT ya lo trae en sus pagos
-- Solo personal de SIGAF (fn_es_personal) puede leer y escribir.
-- Se puede correr dos veces. Cómo: SQL Editor de Supabase → Run. Al final muestra la tabla con 0 renglones.
-- =====================================================================
create table if not exists contrato_apoyos (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references contratos(id) on delete cascade,
  dictamen      text not null,                 -- dictamen del HGZ 2 del que sale el dinero
  ui_destino    text not null,                 -- unidad que recibe el apoyo (p. ej. 010103)
  factura_txt   text,                          -- factura de la otra unidad
  importe       numeric(14,2) not null check (importe > 0),
  fecha         date not null default current_date,  -- cuándo se capturó en devengo
  estado        text not null default 'devengo' check (estado in ('devengo', 'gasto')),
  fecha_gasto   date,                          -- cuándo se registró el gasto
  nota          text,
  creado_por    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  check (estado = 'devengo' or fecha_gasto is not null)
);
create index if not exists idx_capoyos_contrato on contrato_apoyos (contrato_id);
create index if not exists idx_capoyos_dictamen on contrato_apoyos (dictamen);

alter table contrato_apoyos enable row level security;
drop policy if exists ca_read on contrato_apoyos;
create policy ca_read on contrato_apoyos for select using (public.fn_es_personal());
drop policy if exists ca_write on contrato_apoyos;
create policy ca_write on contrato_apoyos for all using (public.fn_es_personal()) with check (public.fn_es_personal());

select 'contrato_apoyos' as tabla, count(*) as renglones from contrato_apoyos;
