-- SIGAF · Uniformar nombres (Title Case) y separar el CARGO en su propia columna.
-- Deja los nombres parejos y con su cargo (Dr./Dra./Lic./QFB/L.A.).
begin;

alter table jefes_servicio add column if not exists cargo text;

-- old_nombre = como está hoy en la BD; new_nombre = parejo; cargo = título
update jefes_servicio js set nombre = v.new_nombre, cargo = v.cargo
from (values
  ('DRA. EURIDICE GARCIA RONQUILLO',        'Euridice García Ronquillo',          'Dra.'),
  ('DR. ADRIAN MAXIMILIANO MARTELL IBARRA', 'Adrián Maximiliano Martell Ibarra',  'Dr.'),
  ('LIC. JUAN RAMON',                       'Juan Ramón',                         'Lic.'),
  ('MARIAJOSE RUIZ RUVALCABA',              'Mariajosé Ruiz Ruvalcaba',           'Lic.'),
  ('JORGE NIEVES HERNANDEZ MORENO',         'Jorge Nieves Hernández Moreno',      'Lic.'),
  ('ROBERTO MOISES DIAZ MARTINEZ',          'Roberto Moisés Díaz Martínez',       'Dr.'),
  ('FERNANDO MORENO HERNANDEZ',             'Fernando Moreno Hernández',          'Dr.'),
  ('ROXANA BARAJAS CALDERA',                'Roxana Barajas Caldera',             'Dra.'),
  ('NOHEMI LILIANA MARQUEZ QUEZADA',        'Nohemí Liliana Márquez Quezada',     'Dra.'),
  ('HUGO ALEJANDRO ALVAREZ DIAZ',           'Hugo Alejandro Álvarez Díaz',        'QFB')
) as v(old_nombre, new_nombre, cargo)
where js.nombre = v.old_nombre;

commit;

-- Verifica:
-- select cargo, nombre, jefatura, matricula, email from jefes_servicio order by nombre;
