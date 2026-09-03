-- Diagnóstico: ¿qué proveedores del Excel cruzan con la BD?
with excel(prov, patron) as (values
  ('Derma Body, SA de CV', '%Derma Body%'),
  ('Tecnología en Ortesis y Prótesis S. de R.L. de C.V', '%Tecnología en%'),
  ('BIODIST S.A. DE C.V', '%BIODIST%'),
  ('Jesús Manuel Romo Alba', '%Jesús Manuel%'),
  ('Mercedes Adriana Diaz Cano', '%Mercedes Adriana%'),
  ('Ana Karen Perez Alvarez', '%Ana Karen%'),
  ('AUTOBUSES DE LA PIEDAD SA DE CV', '%AUTOBUSES DE%'),
  ('Promotora Medica De Aguascalientes, S.A. De C.V.', '%Promotora Medica%'),
  ('Fisica Fimera SA de CV', '%Fisica Fimera%'),
  ('LABOPATH PARTICIPACION CONJUNTA CON GRUPO LAPCIT', '%LABOPATH%'),
  ('LABORATORIO CLINICO PROFESIONAL Y BACTERIOLOGICO SA DE CV', '%LABORATORIO CLINICO%'),
  ('MEDICA SAN JUAN DE AGUASCALIENTES SA DE CV', '%MEDICA SAN%'),
  ('PROMOTORA MEDICA AGUASCALIENTES SA DE CV', '%PROMOTORA MEDICA%'),
  ('SERVICIO DE INGENIERIA S,A DE C.V.', '%SERVICIO DE%'),
  ('UNIDAD MEDICA DEL PILAR SA DE CV', '%UNIDAD MEDICA%'),
  ('ISSEA', '%ISSEA%'),
  ('BAXTER, S.A. DE C.V. NUEVOS DPA', '%BAXTER SA%'),
  ('BAXTER, S.A. DE C.V. PREVALENTES DPA', '%BAXTER SA%'),
  ('LABORATORIOS PISA, S.A. DE C.V. PREVALENTES DPA', '%LABORATORIOS PISA%'),
  ('LABORATORIOS PISA, S.A. DE C.V. NUEVOS', '%LABORATORIOS PISA%'),
  ('LABORATORIOS PISA, S.A. DE C.V. PREVALENTES', '%LABORATORIOS PISA%'),
  ('IGSA MEDICAL SERVICES', '%IGSA MEDICAL%'),
  ('REACTIVOS Y QUIMICOS, S.A. DE C.V.', '%REACTIVOS Y%'),
  ('INTERMET, S.A. DE C.V.', '%INTERMET%'),
  ('OSTEO SCOPE', '%OSTEO SCOPE%'),
  ('RELIABLE', '%RELIABLE%'),
  ('BIODIST, SA DE CV', '%BIODIST%'),
  ('PRODUCTOS HOSPITALARIOS, SA DE CV', '%PRODUCTOS HOSPITALARIOS%')
)
select e.prov as proveedor_excel,
       (select p.razon_social from proveedores p where p.razon_social ilike e.patron order by length(p.razon_social) limit 1) as match_en_bd
from excel e order by match_en_bd nulls first, e.prov;