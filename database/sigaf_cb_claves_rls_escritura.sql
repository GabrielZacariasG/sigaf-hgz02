-- =====================================================================
-- SIGAF · Permiso de ESCRITURA en el catálogo de claves (cb_claves)
-- ---------------------------------------------------------------------
-- Hasta hoy cb_claves solo tenía política de LECTURA (cb_claves_select).
-- Para dar de alta / editar / quitar claves desde Catálogos → Claves,
-- se agrega la escritura SOLO para admin de catálogos (jefe_presupuesto
-- / jefa_finanzas), igual que contratos, proveedores y partidas.
--
-- Usa fn_es_admin() (ya existe, creada en 003_permisos_rls / RLS completo).
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

alter table cb_claves enable row level security;

-- La lectura sigue igual (cualquier usuario con sesión). Por si acaso:
drop policy if exists cb_claves_select on cb_claves;
create policy cb_claves_select on cb_claves for select using (auth.uid() is not null);

-- Alta / edición / baja: solo admin de catálogos (Presupuesto / Finanzas).
drop policy if exists cb_claves_write on cb_claves;
create policy cb_claves_write on cb_claves for all
  using (public.fn_es_admin())
  with check (public.fn_es_admin());

-- Verificación: debe listar las dos políticas (select y write).
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'cb_claves'
order by policyname;
