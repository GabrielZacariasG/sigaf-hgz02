-- =====================================================================
-- SIGAF · Fase 2 · 031 · Comprobantes del sistema (N_AP_IMSS_1043) dentro de SIGAF
-- Fecha: 29/10/2026
-- Crea:
--   · comprobantes_ooad: una fila por línea de distribución de cada comprobante (como viene en el reporte).
--     Cada carga nueva actualiza el estado (entrada/pago) del mismo comprobante + línea.
--   · cargas_nap: bitácora de cada reporte cargado (quién, cuándo, cuántos, qué se aplicó).
-- Permisos: leer = cualquier usuario con sesión; escribir = solo personal de Finanzas (fn_es_personal).
-- No toca facturas. Se puede correr dos veces sin problema.
-- Cómo: SQL Editor de Supabase → Run. Al final debe decir las 2 tablas con 0 filas.
-- =====================================================================
create table if not exists comprobantes_ooad (
  cbte             text not null,
  linea            int  not null default 1,
  usuario          text,
  tipo             text,
  no_proveedor     text,
  proveedor        text,
  contrato         text,
  factura_txt      text,
  fecha_emision    date,
  fecha_factura    date,
  fecha_prog_pago  date,
  importe          numeric(14,2),
  estado_entrada   text,          -- P = vivo · X = eliminado
  estado_ppto      text,
  estado_pago      text,          -- P = pagado · N = no pagado · X = cancelado
  ui               text,          -- unidad de información (010102 = HGZ 2)
  centro_costo     text,
  cuenta           text,
  importe_cuenta   numeric(14,2),
  fecha_ppto       date,
  pedido           text,
  recepcion        text,
  archivo          text,
  corte            date,          -- última fecha de emisión que traía el reporte
  actualizado_at   timestamptz not null default now(),
  primary key (cbte, linea)
);
create index if not exists idx_comprob_ooad_prov   on comprobantes_ooad (no_proveedor);
create index if not exists idx_comprob_ooad_ui     on comprobantes_ooad (ui, cuenta);
create index if not exists idx_comprob_ooad_estado on comprobantes_ooad (estado_entrada, estado_pago);

create table if not exists cargas_nap (
  id             uuid primary key default gen_random_uuid(),
  archivo        text,
  desde          date,
  hasta          date,
  renglones      int,
  comprobantes   int,
  aplicadas      int,
  confirmadas    int,
  detalle        jsonb,
  cargado_por    uuid default auth.uid(),
  created_at     timestamptz not null default now()
);

alter table comprobantes_ooad enable row level security;
alter table cargas_nap        enable row level security;

drop policy if exists co_read on comprobantes_ooad;
create policy co_read on comprobantes_ooad for select using (auth.role() = 'authenticated');
drop policy if exists co_write on comprobantes_ooad;
create policy co_write on comprobantes_ooad for all using (public.fn_es_personal()) with check (public.fn_es_personal());

drop policy if exists cn_read on cargas_nap;
create policy cn_read on cargas_nap for select using (auth.role() = 'authenticated');
drop policy if exists cn_write on cargas_nap;
create policy cn_write on cargas_nap for all using (public.fn_es_personal()) with check (public.fn_es_personal());

-- Verificación
select 'comprobantes_ooad' as tabla, count(*) from comprobantes_ooad
union all select 'cargas_nap', count(*) from cargas_nap;
