-- =====================================================================
-- SIGAF · Fase B (Avance SMS) · 053 · Folios de subrogados
-- Fecha: 30/10/2026
-- Cada solicitud de subrogación (folio de CD_SMS o del Avance SMS) es un servicio pedido al proveedor:
--   · sin factura  → DEVENGO (servicio dado que todavía no se cobra)
--   · con factura  → FACTURADO (factura_id = la factura de SIGAF que lo cobra)
--   · cancelado    → no cuenta
-- Se cargan desde "Cargar reportes" (CD_SMS y el Excel del Avance para el historial). Los folios se ligan a la
-- factura al capturarla o desde su detalle. Un renglón = folio + estudio (clave única).
-- Datos de pacientes: solo personal de SIGAF (fn_es_personal) puede leer y escribir.
-- Se puede correr dos veces. Cómo: SQL Editor de Supabase → Run. Al final muestra la tabla con 0 renglones.
-- =====================================================================
create table if not exists subrogados_folios (
  clave             text primary key,          -- FOLIO|ESTUDIO|n
  folio             text not null,
  fecha             date,
  anio              int,
  mes               int,                        -- mes del servicio
  contrato_id       uuid references contratos(id) on delete set null,
  contrato_txt      text,                       -- como viene en el archivo (S6M0047 o 050GYR032N12225-025-00)
  paciente          text,
  curp              text,
  medico            text,
  matricula_medico  text,
  estudio           text,
  cantidad          numeric(12,2),
  costo_unitario    numeric(14,2),
  importe           numeric(14,2) not null default 0,
  diagnostico       text,
  motivo            text,
  umf               text,
  estatus_sistema   text,                       -- estatus en CD_SMS (draft, …)
  cancelado         boolean not null default false,
  factura_id        uuid references facturas(id) on delete set null,
  factura_txt       text,                       -- número de factura como venía en el Excel
  origen            text,                       -- cd_sms | avance_sms
  hoja              text,
  ligado_por        uuid,
  ligado_at         timestamptz,
  actualizado_at    timestamptz not null default now()
);
create index if not exists idx_subfol_contrato on subrogados_folios (contrato_id, anio, mes);
create index if not exists idx_subfol_factura  on subrogados_folios (factura_id);
create index if not exists idx_subfol_folio    on subrogados_folios (folio);

alter table subrogados_folios enable row level security;
drop policy if exists sf_read on subrogados_folios;
create policy sf_read on subrogados_folios for select using (public.fn_es_personal());
drop policy if exists sf_write on subrogados_folios;
create policy sf_write on subrogados_folios for all using (public.fn_es_personal()) with check (public.fn_es_personal());

select 'subrogados_folios' as tabla, count(*) as renglones from subrogados_folios;
