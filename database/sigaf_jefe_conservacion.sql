-- =====================================================================
--  Alta del Jefe de Conservación
--  Ing. Enrique González Esquivel · matrícula 99012273
--  Login: teclea su matrícula + contraseña.
--  Correo interno de la cuenta: 99012273@hgz02.sigaf.mx
--  Correr una vez en el SQL Editor de Supabase.
-- =====================================================================
begin;

insert into jefes_servicio (nombre, cargo, jefatura, matricula, email, activo)
values ('Enrique González Esquivel', 'Ing.', 'Conservación',
        '99012273', '99012273@hgz02.sigaf.mx', true)
on conflict (nombre) do update
  set cargo     = excluded.cargo,
      jefatura  = excluded.jefatura,
      matricula = excluded.matricula,
      email     = excluded.email,
      activo    = true;

commit;

-- Verifica:
-- select cargo, nombre, jefatura, matricula, email from jefes_servicio where matricula = '99012273';

-- (Opcional) Asignarle los proveedores que valida Conservación, por ejemplo:
--   insert into jefe_proveedor (jefe_id, proveedor_id)
--   select j.id, p.id from jefes_servicio j join proveedores p
--     on p.razon_social = 'NOMBRE EXACTO DEL PROVEEDOR'
--   where j.nombre = 'Enrique González Esquivel'
--   on conflict do nothing;
-- Si NO se le asignan proveedores, verá TODAS las facturas enviadas al servicio.
