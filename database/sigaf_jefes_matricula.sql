-- SIGAF · Matrículas reales de los jefes de servicio (login con matrícula).
-- La cuenta de Supabase Auth se crea con correo interno <matricula>@hgz02.sigaf.mx
-- y el jefe teclea SOLO su matrícula + contraseña.
begin;

alter table jefes_servicio add column if not exists matricula text;
create unique index if not exists jefes_servicio_matricula_key on jefes_servicio (matricula) where matricula is not null;

update jefes_servicio set matricula = v.mat, email = lower(v.mat) || '@hgz02.sigaf.mx'
from (values
  ('DRA. EURIDICE GARCIA RONQUILLO',        '99011823'),
  ('DR. ADRIAN MAXIMILIANO MARTELL IBARRA', '98231691'),
  ('MARIAJOSE RUIZ RUVALCABA',              '99014477'),
  ('ROBERTO MOISES DIAZ MARTINEZ',          '98010221'),
  ('FERNANDO MORENO HERNANDEZ',             '99011733'),
  ('ROXANA BARAJAS CALDERA',                '99017651'),
  ('NOHEMI LILIANA MARQUEZ QUEZADA',        '991429651'),
  ('HUGO ALEJANDRO ALVAREZ DIAZ',           '99011573')
  -- Pendientes (no venían en la lista):
  -- ('LIC. JUAN RAMON',                    '________'),
  -- ('JORGE NIEVES HERNANDEZ MORENO',      '________')
) as v(nombre, mat)
where jefes_servicio.nombre = v.nombre;

commit;

-- Verifica:  select nombre, matricula, email from jefes_servicio order by nombre;
