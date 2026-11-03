-- =====================================================================
-- SIGAF · Fondo fijo · 059 · Pliegos, otras cuentas, reembolsos y banco
-- Fecha: 03/11/2026
-- Crea:
--   ff_comisionados  plantilla de comisionados (matrícula, categoría, jornada)
--   ff_reembolsos    solicitudes de reembolso (Relación de Gastos) y su CR
--   ff_gastos        un renglón por comprobante: pliego, pernocta, boleto, pasaje u otra cuenta
--   ff_precarga      lo que manda Servicios Generales, por llegar a Finanzas
--   ff_banco         ingresos y egresos de la cuenta del fondo
--   ff_arqueos       arqueos del efectivo
--   ff_crear_reembolso / ff_cancelar_reembolso   operaciones completas: o se hace todo o nada
-- Datos personales (NSS, pacientes): solo personal de SIGAF (fn_es_personal) lee y escribe.
-- No toca facturas, cédula ni comprobantes. Se puede correr dos veces.
-- Cómo: SQL Editor de Supabase → Run. Al final muestra las 6 tablas con 0 renglones.
-- =====================================================================
create table if not exists ff_comisionados (
  matricula      text primary key,
  nombre         text not null,
  categoria      text,
  clave_hora     text,
  horario        text,
  jornada        text,                 -- MAT, VESP, NOCT, JA, SUSTITUTO, SUPLENTE
  tc             text,                 -- sugerencia; manda el TC del pliego
  gj             text,
  activo         boolean not null default true,
  actualizado_at timestamptz not null default now()
);

create table if not exists ff_reembolsos (
  id                 uuid primary key default gen_random_uuid(),
  solicitud          text not null unique,  -- CD121/2026, STP024/2026
  serie              text,                  -- CD, STP u OTRA
  numero             int,
  anio               int,
  prefijo            text,                  -- V viáticos, T traslados, O otras (inicio del comprobante OOAD)
  folio_oficio       text,                  -- SIGAF-RG-0121/2026
  fecha              date,
  periodo_de         date,
  periodo_al         date,
  comprobantes       int not null default 0,
  total              numeric(14,2) not null default 0,
  total_excel        numeric(14,2),         -- lo que decía el Excel, para ver diferencias del histórico
  acumulado_anterior numeric(14,2) not null default 0,
  estatus            text not null default 'enviado' check (estatus in ('enviado', 'cancelado')),
  cr                 text,
  fecha_ingreso      date,
  fecha_prob_pago    date,
  ref_bancaria       text,
  origen             text not null default 'sigaf' check (origen in ('sigaf', 'historico')),
  creado_por         uuid default auth.uid(),
  created_at         timestamptz not null default now()
);
-- Un mismo número de solicitud no se puede emitir dos veces desde SIGAF.
create unique index if not exists ux_ff_reembolso_numero on ff_reembolsos (serie, numero, anio)
  where origen = 'sigaf' and estatus <> 'cancelado';

create table if not exists ff_gastos (
  id             uuid primary key default gen_random_uuid(),
  clave          text not null,          -- tipo|folio|año (u otra llave para otras cuentas)
  tipo           text not null check (tipo in ('PLIEGO', 'PERNOCTA', 'BOLETO', 'PASAJE', 'OTRA')),
  folio          text not null,
  anio           int,
  fecha          date,                   -- viaje en pliegos; pago por fondo fijo en lo demás
  mes_gasto      text,                   -- PASIVO, ENERO… como en el resumen mensual
  importe        numeric(14,2) not null default 0,
  casetas        numeric(14,2) not null default 0,
  boletos        numeric(14,2) not null default 0,
  anticipo       numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  cuenta         text,
  cc             text,
  -- pliegos
  matricula      text,
  persona        text,
  turno          text,
  tc             text,
  gj             text,
  calidad        text,
  folio_chofer   text,
  destino        text,
  unidad         text,
  salida         text,
  llegada        text,
  salida_destino text,
  regreso        text,
  cuota          numeric(14,2),
  motivo         text,
  infarto        text,
  especialidad   text,
  tp01           text,
  recibido       date,
  fecha_pago     date,
  -- pernoctas, boletos y pasajes
  nss            text,
  agregado       text,
  paciente       text,
  acompanante    text,
  unidad_origen  text,
  de             date,
  al             date,
  comprobante    text,
  dias           numeric(8,2),
  -- otras cuentas
  proveedor      text,
  fecha_factura  date,
  observaciones  text,
  avisos         jsonb,                  -- los filtros que quedaron visibles al guardar
  reembolso_id   uuid references ff_reembolsos(id) on delete set null,
  anulado        boolean not null default false,
  origen         text not null default 'sigaf' check (origen in ('sigaf', 'historico')),
  creado_por     uuid default auth.uid(),
  created_at     timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create unique index if not exists ux_ff_gasto_clave on ff_gastos (clave);
create index if not exists idx_ff_gasto_reembolso on ff_gastos (reembolso_id);
create index if not exists idx_ff_gasto_tipo on ff_gastos (tipo, fecha);
create index if not exists idx_ff_gasto_persona on ff_gastos (matricula, fecha);

create table if not exists ff_precarga (
  clave          text primary key,       -- folio normalizado|año
  folio          text not null,
  anio           text,
  fecha          date,
  matricula      text,
  nombre         text,
  turno_sg       text,
  lugar          text,
  destino        text,
  importe        numeric(14,2),
  casetas        numeric(14,2) not null default 0,
  unidad         text,
  estatus_sg     text,
  obs_sg         text,
  fuentes        text,
  total_persona  numeric(14,2),
  folios_persona int,
  deducido       text,
  archivo        text,
  gasto_id       uuid references ff_gastos(id) on delete set null,
  llego_at       timestamptz,
  cargado_por    uuid default auth.uid(),
  actualizado_at timestamptz not null default now()
);

create table if not exists ff_banco (
  id            uuid primary key default gen_random_uuid(),
  clave         text unique,             -- solo para no repetir el histórico al volver a cargarlo
  fecha_ingreso date,
  fecha_pago    date,
  ingreso       numeric(14,2) not null default 0,
  egreso        numeric(14,2) not null default 0,
  concepto      text,
  creado_por    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

create table if not exists ff_arqueos (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  conteo      jsonb,                     -- denominación → piezas
  contado     numeric(14,2) not null default 0,
  esperado    numeric(14,2) not null default 0,
  nota        text,
  creado_por  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['ff_comisionados', 'ff_reembolsos', 'ff_gastos', 'ff_precarga', 'ff_banco', 'ff_arqueos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_personal', t);
    execute format('create policy %I on %I for all using (public.fn_es_personal()) with check (public.fn_es_personal())', t || '_personal', t);
  end loop;
end $$;

-- Crea el reembolso y le asigna sus comprobantes. Si alguno ya está en otro, no hace nada.
create or replace function public.ff_crear_reembolso(p jsonb, p_gastos uuid[])
returns uuid language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_n  int;
begin
  if not public.fn_es_personal() then raise exception 'Sin permiso.'; end if;
  if coalesce(array_length(p_gastos, 1), 0) = 0 then raise exception 'Selecciona al menos un comprobante.'; end if;
  insert into ff_reembolsos (solicitud, serie, numero, anio, prefijo, folio_oficio, fecha, periodo_de, periodo_al, comprobantes, total, acumulado_anterior)
  values (p->>'solicitud', 'CD', (p->>'numero')::int, (p->>'anio')::int, p->>'prefijo', p->>'folio_oficio', (p->>'fecha')::date,
          nullif(p->>'periodo_de', '')::date, nullif(p->>'periodo_al', '')::date, array_length(p_gastos, 1), (p->>'total')::numeric, (p->>'acumulado_anterior')::numeric)
  returning id into v_id;
  update ff_gastos set reembolso_id = v_id, actualizado_at = now()
   where id = any(p_gastos) and reembolso_id is null and not anulado;
  get diagnostics v_n = row_count;
  if v_n <> array_length(p_gastos, 1) then
    raise exception 'Algún comprobante ya está en otro reembolso; recarga la pantalla.';
  end if;
  return v_id;
end $$;

-- Cancela un reembolso (por ejemplo, OOAD eliminó su CR): sus comprobantes vuelven a quedar por reembolsar.
create or replace function public.ff_cancelar_reembolso(p_id uuid)
returns void language plpgsql set search_path = public as $$
begin
  if not public.fn_es_personal() then raise exception 'Sin permiso.'; end if;
  update ff_gastos set reembolso_id = null, actualizado_at = now() where reembolso_id = p_id;
  update ff_reembolsos set estatus = 'cancelado', solicitud = solicitud || ' CANCELADO ' || left(p_id::text, 4) where id = p_id and estatus <> 'cancelado';
end $$;

revoke all on function public.ff_crear_reembolso(jsonb, uuid[]) from public;
revoke all on function public.ff_cancelar_reembolso(uuid) from public;
grant execute on function public.ff_crear_reembolso(jsonb, uuid[]) to authenticated;
grant execute on function public.ff_cancelar_reembolso(uuid) to authenticated;

select 'ff_comisionados' as tabla, count(*) as renglones from ff_comisionados
union all select 'ff_reembolsos', count(*) from ff_reembolsos
union all select 'ff_gastos', count(*) from ff_gastos
union all select 'ff_precarga', count(*) from ff_precarga
union all select 'ff_banco', count(*) from ff_banco
union all select 'ff_arqueos', count(*) from ff_arqueos;
