-- =====================================================================
-- SIGAF · Fase 0 · 004 · Cerrar dos huecos de permisos encontrados con la 000
-- Fecha: 29/10/2026
--
-- 1) ajustes_devengo tenía una política extra "ajustes_devengo_auth" (ALL, true, true)
--    que permitía escribir a CUALQUIERA, incluso sin iniciar sesión (la llave pública
--    de la app está en la página). Las políticas se suman (OR), así que anulaba a
--    deveng_write (solo admin). Se elimina: quedan deveng_select (leer con sesión)
--    y deveng_write (escribir solo jefe_presupuesto / jefa_finanzas).
-- 2) stg_51251013 (tabla de paso de una carga vieja de hemodiálisis) no tenía
--    reglas de permisos. Se le activa RLS SIN políticas: nadie la lee ni la escribe
--    desde la app (el SQL Editor de Supabase sí, para consultarla o borrarla después).
--
-- Cómo correrlo: SQL Editor de Supabase. No borra ni cambia datos.
-- =====================================================================
drop policy if exists ajustes_devengo_auth on ajustes_devengo;

alter table if exists stg_51251013 enable row level security;

-- Verificación (solo lectura): tablas de la app SIN protección de permisos.
-- Debe salir VACÍA.
select c.relname as tabla_sin_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;
