-- SIGAF · Alta de cuentas: tu jefa (Finanzas) + 3 auxiliares de ventanilla.
--
-- PASO 1 (lo haces TÚ en Supabase → Authentication → Users → "Add user"):
--   Crea estos 4 usuarios con su contraseña (email confirmado):
--     99013207@hgz02.sigaf.mx            (L.A. Nayeli Alonso Orozco)
--     ventanilla.finanzas1@hgz02.sigaf.mx
--     ventanilla.finanzas2@hgz02.sigaf.mx
--     ventanilla.finanzas3@hgz02.sigaf.mx
--
-- PASO 2 (corre este SQL): vincula cada cuenta con su rol en la tabla usuarios.
--   Roles: 'jefa_finanzas' (tu jefa) y 'auo' (auxiliares/ventanilla).
--   Se enlaza por correo, así que NO necesitas copiar UUIDs.

insert into usuarios (auth_id, nombre, rol)
select u.id, v.nombre, v.rol::rol_usuario
from auth.users u
join (values
  ('99013207@hgz02.sigaf.mx',             'L.A. Nayeli Alonso Orozco', 'jefa_finanzas'),
  ('ventanilla.finanzas1@hgz02.sigaf.mx', 'Ventanilla Finanzas 1',     'auo'),
  ('ventanilla.finanzas2@hgz02.sigaf.mx', 'Ventanilla Finanzas 2',     'auo'),
  ('ventanilla.finanzas3@hgz02.sigaf.mx', 'Ventanilla Finanzas 3',     'auo')
) as v(email, nombre, rol) on lower(u.email) = v.email
on conflict (auth_id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- Verifica (deben salir las 4 con su rol):
-- select u.email, us.nombre, us.rol
-- from usuarios us join auth.users u on u.id = us.auth_id
-- where u.email in ('99013207@hgz02.sigaf.mx','ventanilla.finanzas1@hgz02.sigaf.mx',
--   'ventanilla.finanzas2@hgz02.sigaf.mx','ventanilla.finanzas3@hgz02.sigaf.mx');
