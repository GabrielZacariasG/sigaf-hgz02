-- =====================================================================
-- SIGAF - Completar RLS en todas las tablas
-- Ejecutar DESPUÉS de sigaf_schema_piloto.sql / seed / triggers
-- Corrige dos problemas detectados:
--   1. Tablas sin RLS activado (capitulos, partidas, proveedores,
--      contratos, contrato_servicios, usuarios, alertas_config,
--      ooad_import_lotes, factura_estatus_historial) -> quedaban
--      abiertas a cualquiera con el anon key.
--   2. factura_detalle: tenía RLS activado pero SIN políticas ->
--      quedaba bloqueada incluso para el AUO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Activar RLS en todas las tablas restantes
-- ---------------------------------------------------------------------

alter table capitulos enable row level security;
alter table partidas enable row level security;
alter table proveedores enable row level security;
alter table contratos enable row level security;
alter table contrato_servicios enable row level security;
alter table usuarios enable row level security;
alter table alertas_config enable row level security;
alter table ooad_import_lotes enable row level security;
alter table factura_estatus_historial enable row level security;

-- ---------------------------------------------------------------------
-- 2. Catálogos maestros: lectura para cualquier usuario autenticado,
--    escritura solo para jefe_presupuesto / jefa_finanzas
-- ---------------------------------------------------------------------

create or replace function fn_es_admin()
returns boolean as $$
  select exists (
    select 1 from usuarios u
    where u.auth_id = auth.uid() and u.rol in ('jefe_presupuesto', 'jefa_finanzas')
  );
$$ language sql stable security definer;

-- capitulos
create policy capitulos_select on capitulos for select using (auth.uid() is not null);
create policy capitulos_write on capitulos for all using (fn_es_admin()) with check (fn_es_admin());

-- partidas
create policy partidas_select on partidas for select using (auth.uid() is not null);
create policy partidas_write on partidas for all using (fn_es_admin()) with check (fn_es_admin());

-- proveedores
create policy proveedores_select on proveedores for select using (auth.uid() is not null);
create policy proveedores_write on proveedores for all using (fn_es_admin()) with check (fn_es_admin());

-- contratos
create policy contratos_select on contratos for select using (auth.uid() is not null);
create policy contratos_write on contratos for all using (fn_es_admin()) with check (fn_es_admin());

-- contrato_servicios
create policy contrato_servicios_select on contrato_servicios for select using (auth.uid() is not null);
create policy contrato_servicios_write on contrato_servicios for all using (fn_es_admin()) with check (fn_es_admin());

-- alertas_config
create policy alertas_config_select on alertas_config for select using (auth.uid() is not null);
create policy alertas_config_write on alertas_config for all using (fn_es_admin()) with check (fn_es_admin());

-- ---------------------------------------------------------------------
-- 3. usuarios: lectura para autenticados (necesaria para asignaciones
--    y mostrar nombres en el historial), escritura solo jefa_finanzas
-- ---------------------------------------------------------------------

create policy usuarios_select on usuarios for select using (auth.uid() is not null);

create policy usuarios_write on usuarios for all using (
    exists (select 1 from usuarios u where u.auth_id = auth.uid() and u.rol = 'jefa_finanzas')
) with check (
    exists (select 1 from usuarios u where u.auth_id = auth.uid() and u.rol = 'jefa_finanzas')
);

-- ---------------------------------------------------------------------
-- 4. factura_detalle: faltaban las políticas (tenía RLS sin reglas)
--    Captura permitida a AUO y superiores; lectura para autenticados
-- ---------------------------------------------------------------------

create policy factura_detalle_select on factura_detalle for select using (auth.uid() is not null);

create policy factura_detalle_write on factura_detalle for all using (
    exists (
        select 1 from usuarios u
        where u.auth_id = auth.uid() and u.rol in ('auo', 'jefe_presupuesto', 'jefa_finanzas')
    )
) with check (
    exists (
        select 1 from usuarios u
        where u.auth_id = auth.uid() and u.rol in ('auo', 'jefe_presupuesto', 'jefa_finanzas')
    )
);

-- ---------------------------------------------------------------------
-- 5. ooad_import_lotes: solo jefe_presupuesto / jefa_finanzas suben
--    reportes; lectura para todos los autenticados
-- ---------------------------------------------------------------------

create policy ooad_lotes_select on ooad_import_lotes for select using (auth.uid() is not null);
create policy ooad_lotes_write on ooad_import_lotes for all using (fn_es_admin()) with check (fn_es_admin());

-- ---------------------------------------------------------------------
-- 6. factura_estatus_historial: se escribe SOLO vía el trigger
--    (fn_registrar_historial_estatus), nunca directo desde la app.
--    Por eso no se agrega política de INSERT para usuarios normales:
--    se vuelve el trigger SECURITY DEFINER para que pueda escribir
--    aunque el usuario que dispara el cambio no tenga permiso directo
--    sobre esta tabla.
-- ---------------------------------------------------------------------

create policy historial_select on factura_estatus_historial for select using (auth.uid() is not null);

alter function fn_registrar_historial_estatus() security definer;

-- =====================================================================
-- Verificación sugerida después de correr esto:
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' order by tablename;
--   -> rowsecurity debe ser 'true' en las 12 tablas.
-- =====================================================================
