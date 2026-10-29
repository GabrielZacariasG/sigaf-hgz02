-- =====================================================================
-- SIGAF · Fase 3 · 047 · Permiso para capturar devengo desde la pantalla Contratos
-- Fecha: 30/10/2026
-- La tabla ajustes_devengo solo se llenaba por SQL. Ahora Finanzas (Gabriel, su jefa y su analista)
-- la captura desde Contratos → Línea mensual. Leer: cualquiera con sesión; escribir: solo Finanzas.
-- Cómo: SQL Editor → Run. Al final muestra las políticas de la tabla.
-- =====================================================================
alter table ajustes_devengo enable row level security;
drop policy if exists ad_read on ajustes_devengo;
create policy ad_read on ajustes_devengo for select using (auth.role() = 'authenticated');
drop policy if exists ad_write on ajustes_devengo;
create policy ad_write on ajustes_devengo for all using (public.fn_es_personal()) with check (public.fn_es_personal());

select policyname, cmd, qual from pg_policies where tablename = 'ajustes_devengo' order by policyname;
