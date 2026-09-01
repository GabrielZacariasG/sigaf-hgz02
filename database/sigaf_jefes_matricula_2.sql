-- SIGAF · Matrículas de los 2 jefes que faltaban.
-- Crea sus cuentas en Supabase Auth con: <matricula>@hgz02.sigaf.mx
begin;
update jefes_servicio set matricula = v.mat, email = lower(v.mat) || '@hgz02.sigaf.mx'
from (values
  ('LIC. JUAN RAMON',                  '99014512'),
  ('JORGE NIEVES HERNANDEZ MORENO',    '10384006')
) as v(nombre, mat)
where jefes_servicio.nombre = v.nombre;
commit;
-- Verifica: select nombre, matricula, email from jefes_servicio order by nombre;
