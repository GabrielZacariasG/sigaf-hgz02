-- =====================================================================
-- SIGAF · Fase 3c · 052 · Comentarios por contrato (como la columna "COMENTARIOS POR LA UNIDAD" del Avance SMS)
-- Fecha: 30/10/2026
-- Crea contrato_comentarios (bitácora: fecha, quién y qué) y carga los 3 comentarios que trae
-- "10 AVANCE CONTRATOS SMS OCTUBRE 2026.xlsx" (hoja avance, columna Y).
-- Permisos: leer = cualquier usuario con sesión; escribir = Finanzas (fn_es_personal). Se puede correr dos veces.
-- Cómo: SQL Editor de Supabase → Run. Al final muestra los comentarios cargados.
-- =====================================================================
create table if not exists contrato_comentarios (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references contratos(id) on delete cascade,
  texto        text not null,
  origen       text not null default 'captura',   -- captura | avance_sms
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_contrato_comentarios on contrato_comentarios (contrato_id, created_at desc);

alter table contrato_comentarios enable row level security;
drop policy if exists cco_read on contrato_comentarios;
create policy cco_read on contrato_comentarios for select using (auth.role() = 'authenticated');
drop policy if exists cco_write on contrato_comentarios;
create policy cco_write on contrato_comentarios for all using (public.fn_es_personal()) with check (public.fn_es_personal());

insert into contrato_comentarios (contrato_id, texto, origen, created_at)
select c.id, v.texto, 'avance_sms', timestamptz '2026-10-30 09:00:00-06'
from (values
  ('S6M0040', 'H3 apoyará mediante oficio de apoyo la factura de noviembre; diciembre se va a pasivo.'),
  ('S6M0049', 'Iniciar trámite de ESC 1 para liberar el 40% y ejercer el recurso en ampliaciones para LACBA y arco en C.'),
  ('S7M0163', 'Facturación corresponde a pasivo.')
) v(contrato, texto)
join contratos c on upper(regexp_replace(c.numero_interno, '[^A-Za-z0-9]', '', 'g')) = v.contrato
where not exists (select 1 from contrato_comentarios x where x.contrato_id = c.id and x.origen = 'avance_sms' and x.texto = v.texto);

select c.numero_interno, k.texto, k.origen, k.created_at
from contrato_comentarios k join contratos c on c.id = k.contrato_id
order by c.numero_interno, k.created_at;
