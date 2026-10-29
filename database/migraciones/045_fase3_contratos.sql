-- =====================================================================
-- SIGAF · Fase 3 · 045 · Control de contratos (como "área médica" / "subrogados" / "linea am" / "lin sub" de la cédula)
-- Fecha: 30/10/2026
-- 1) contratos: campos que la cédula lleva y SIGAF no tenía
--      concepto · dictamen_numero · dictamen_tipo (DEF/PRE/PREI…) · numero_alterno (SAI D6M…/S6M… o el PO 050GYR…)
--      importe_maximo_contrato (el delegacional; monto_maximo sigue siendo el de la UNIDAD)
--      tope_ampliacion_pct (10% por defecto, como en "linea am")
-- 2) contrato_ampliaciones: ampliaciones y reducciones (AMP O RED) con fecha, convenio y nota.
-- 3) contrato_programado: lo programado por mes de cada contrato (ESC 1 / AMP de linea am y lin sub).
-- 4) contrato_reservas: renglones de la cédula SIN contrato que sí apartan presupuesto
--      (partidas desiertas, sin DDP, nueva contratación, no licitada).
-- 5) ajustes_devengo (ya existía: contrato, año, mes, importe): se le agrega origen (captura / 1013 / sugerido),
--      nota y quién lo capturó. Es el DEVENGO: servicio recibido que todavía no se factura.
-- Permisos: leer = cualquiera con sesión; escribir = Finanzas (fn_es_personal).
-- Se puede correr dos veces. Cómo: SQL Editor → Run. Al final muestra las tablas con su número de renglones.
-- =====================================================================
alter table contratos add column if not exists concepto                text;
alter table contratos add column if not exists dictamen_numero         text;
alter table contratos add column if not exists dictamen_tipo           text;
alter table contratos add column if not exists numero_alterno          text;
alter table contratos add column if not exists importe_maximo_contrato numeric(14,2);
alter table contratos add column if not exists tope_ampliacion_pct     numeric(5,2) not null default 10;

create table if not exists contrato_ampliaciones (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references contratos(id) on delete cascade,
  fecha        date,
  importe      numeric(14,2) not null,          -- positivo = ampliación, negativo = reducción
  convenio     text,
  nota         text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_contrato_amp on contrato_ampliaciones (contrato_id);

create table if not exists contrato_programado (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references contratos(id) on delete cascade,
  anio         int  not null,
  mes          int  not null check (mes between 1 and 12),
  escenario    text not null default 'ESC 1',   -- 'ESC 1' (base) · 'AMP' (con ampliación)
  importe      numeric(14,2) not null default 0,
  nota         text,
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  unique (contrato_id, anio, mes, escenario)
);

create table if not exists contrato_reservas (
  id           uuid primary key default gen_random_uuid(),
  partida_id   uuid not null references partidas(id),
  concepto     text not null,
  estatus      text not null,                   -- 'desierta' · 'sin DDP' · 'nueva contratación' · 'no licitada'
  importe      numeric(14,2) not null default 0,
  anio         int not null default 2026,
  nota         text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

alter table ajustes_devengo add column if not exists origen     text not null default 'captura';  -- captura · 1013 · sugerido · cedula
alter table ajustes_devengo add column if not exists nota       text;
alter table ajustes_devengo add column if not exists created_by uuid default auth.uid();

alter table contrato_ampliaciones enable row level security;
alter table contrato_programado   enable row level security;
alter table contrato_reservas     enable row level security;
do $$ declare t text; begin
  foreach t in array array['contrato_ampliaciones','contrato_programado','contrato_reservas'] loop
    execute format('drop policy if exists %1$s_read on %1$s', t);
    execute format('create policy %1$s_read on %1$s for select using (auth.role() = ''authenticated'')', t);
    execute format('drop policy if exists %1$s_write on %1$s', t);
    execute format('create policy %1$s_write on %1$s for all using (public.fn_es_personal()) with check (public.fn_es_personal())', t);
  end loop;
end $$;

-- Verificación
select 'contratos' as tabla, count(*) from contratos
union all select 'contrato_ampliaciones', count(*) from contrato_ampliaciones
union all select 'contrato_programado', count(*) from contrato_programado
union all select 'contrato_reservas', count(*) from contrato_reservas
union all select 'ajustes_devengo', count(*) from ajustes_devengo;
