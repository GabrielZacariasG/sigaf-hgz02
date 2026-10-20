-- =====================================================================
-- SIGAF · Alta de la Subdirectora Médica (perfil tipo Director/Subdirector).
-- Entra a su panel /admin (solo lectura). NO captura ni valida facturas.
--
-- PASO 1 (lo haces TÚ en Supabase → Authentication → Users → Add user):
--   crea la cuenta con:  <MATRICULA>@hgz02.sigaf.mx   + su contraseña
--   >>> REEMPLAZA  _MATRICULA_  por la matrícula real de la Dra. antes de correr <<<
--
-- PASO 2: corre este SQL (idempotente, se enlaza por correo/matrícula).
-- =====================================================================

insert into administradores (nombre, cargo, email, matricula)
select 'Dra. Vanessa Valencia Aguirre', 'Subdirectora Médica',
       '_MATRICULA_@hgz02.sigaf.mx', '_MATRICULA_'
where not exists (select 1 from administradores where nombre = 'Dra. Vanessa Valencia Aguirre');

-- Verificación:
select nombre, cargo, email, matricula, activo from administradores order by nombre;
