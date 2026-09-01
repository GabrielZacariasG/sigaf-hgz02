-- SIGAF · Jefes de servicio por MATRÍCULA (login con matrícula en vez de correo)
-- Convención: la cuenta de Supabase Auth se crea con correo interno
--   <matricula>@hgz02.sigaf.mx  y el jefe teclea solo su matrícula en el login.
begin;

alter table jefes_servicio add column if not exists matricula text;
create unique index if not exists jefes_servicio_matricula_key on jefes_servicio (matricula) where matricula is not null;

-- Carga las matrículas reales de cada jefe (cámbialas por las verdaderas):
update jefes_servicio set matricula = v.mat, email = lower(v.mat) || '@hgz02.sigaf.mx'
from (values
  ('DRA. EURIDICE GARCIA RONQUILLO',        '00000001'),
  ('DR. ADRIAN MAXIMILIANO MARTELL IBARRA', '00000002'),
  ('MARIAJOSE RUIZ RUVALCABA',              '00000003'),
  ('JORGE NIEVES HERNANDEZ MORENO',         '00000004'),
  ('ROBERTO MOISES DIAZ MARTINEZ',          '00000005'),
  ('FERNANDO MORENO HERNANDEZ',             '00000006'),
  ('ROXANA BARAJAS CALDERA',                '00000007'),
  ('NOHEMI LILIANA MARQUEZ QUEZADA',        '00000008'),
  ('HUGO ALEJANDRO ALVAREZ DIAZ',           '00000009'),
  ('LIC. JUAN RAMON',                       '00000010')
) as v(nombre, mat)
where jefes_servicio.nombre = v.nombre;

commit;

-- Después: en Supabase → Authentication → Add user, crea cada cuenta con
-- email = <matricula>@hgz02.sigaf.mx  (Auto Confirm) y una contraseña temporal.
-- El jefe entra tecleando SOLO su matrícula + contraseña.
