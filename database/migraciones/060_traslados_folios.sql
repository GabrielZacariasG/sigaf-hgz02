-- =====================================================================
-- SIGAF · 060 · Folios de traslado de pacientes (SCACE "Gastos TP por Unidad")
-- Fecha: 09/11/2026
-- Cada folio TP del SCACE es un viaje que el HGZ 2 autorizó a Autobuses de la Piedad (cuenta 52411011).
--   · Contrato y mes: por FECHA DEL VIAJE ("Fecha y Hora de Cita"), NUNCA por la fecha en que se generó el folio
--     (regla de Gabriel 9/11/2026). S6M0022 ene–feb · S6M0030 1/03–23/10 · S6M0112 24/10–31/12.
--   · Sin factura que cubra la fecha del viaje → DEVENGO. La factura de Autobuses es por periodo y destino:
--     el folio queda facturado cuando una factura del mismo contrato, con su detalle de viajes, cubre esa fecha.
--   · Fondo fijo (Estado TP "En relación de gastos" o con importe pagado) → no es del contrato.
-- Sin NSS ni nombres: del paciente solo se guarda una huella (SHA-256 recortado del NSS + agregado) para
-- señalar folios del mismo paciente el mismo día (posibles repetidos: cuentan, pero se marcan para revisar).
-- Se puede correr dos veces. Cómo: SQL Editor de Supabase → Run. Al final muestra la tabla con sus renglones.
-- =====================================================================
create table if not exists traslados_folios (
  folio            text primary key,           -- Folio TP (01261100257)
  tipo_folio       text,                       -- TP07
  unidad_receptora text,                       -- H. ESP. No 1 Leon
  ciudad           text,                       -- LEON | GUADALAJARA | CDMX | MONTERREY | SAN LUIS POTOSI | OTRA
  especialidad     text,
  fecha_viaje      date not null,              -- de "Fecha y Hora de Cita"
  hora_viaje       text,
  tipo_cita        text,                       -- S subsecuente · P primera vez
  transporte       text,                       -- Transportes Contratados | Ambulancia
  con_acompanante  boolean not null default false, -- columna "Acompañante" con dato
  boletos          numeric(6,2),               -- importe ÷ tarifa del destino (0.5 sencillo, 1 redondo, 1.5, 2…)
  importe_emitido  numeric(14,2) not null default 0,
  importe_pagado   numeric(14,2) not null default 0,
  fecha_pago       date,
  estado_tp        text,                       -- Emitido | En relacion de gastos
  motivo_ajuste    text,
  fondo_fijo       boolean not null default false,
  paciente_huella  text,                       -- SHA-256 (16 hex) de NSS|agregado; no permite saber quién es
  contrato_id      uuid references contratos(id) on delete set null,
  archivo          text,
  actualizado_at   timestamptz not null default now()
);
create index if not exists idx_trasfol_contrato on traslados_folios (contrato_id, fecha_viaje);
create index if not exists idx_trasfol_fecha    on traslados_folios (fecha_viaje);

alter table traslados_folios enable row level security;
drop policy if exists tf_read on traslados_folios;
create policy tf_read on traslados_folios for select using (public.fn_es_personal());
drop policy if exists tf_write on traslados_folios;
create policy tf_write on traslados_folios for all using (public.fn_es_personal()) with check (public.fn_es_personal());

select 'traslados_folios' as tabla, count(*) as renglones from traslados_folios;
