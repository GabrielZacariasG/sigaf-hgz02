-- SIGAF · Catálogo de folios de subrogado traídos del servidor CD_SMS (MySQL).
-- Se llena con el sincronizador (sync_folios_subrogado.php) desde las dos bases:
--   'nuevo' = subrogados_nuevo.subrogation_requests   (sistema CD_SMS actual)
--   'viejo' = subrogados.* (histórico)
-- SIGAF lo consume para ligar una factura de subrogados a su folio.
begin;

create table if not exists folios_subrogado (
  id             uuid primary key default gen_random_uuid(),
  origen         text not null,               -- 'nuevo' | 'viejo'
  folio          text not null,               -- folio tal cual (varchar nuevo / int viejo)
  fecha          date,
  contrato_code  text,                         -- empata con contratos.numero_interno de SIGAF
  proveedor      text,
  unidad         text,
  paciente       text,
  subtotal       numeric(14,2),
  iva            numeric(14,2),
  total          numeric(14,2),
  estatus        text,
  factura        text,                         -- si el histórico ya trae factura ligada
  fecha_pago     date,
  actualizado_at timestamptz not null default now(),
  unique (origen, folio)
);

create index if not exists idx_folios_sub_contrato on folios_subrogado (contrato_code);
create index if not exists idx_folios_sub_folio    on folios_subrogado (folio);

-- RLS: la app (usuarios autenticados) puede LEER. La escritura la hace el
-- sincronizador con la service_role key (que ignora RLS), así que no se
-- necesita política de insert para el rol anónimo.
alter table folios_subrogado enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='folios_subrogado' and policyname='folios_sub_select') then
    create policy folios_sub_select on folios_subrogado for select using (auth.uid() is not null);
  end if;
end $$;

commit;

-- Verifica: select origen, count(*) from folios_subrogado group by origen;
