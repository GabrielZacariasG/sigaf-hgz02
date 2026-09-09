-- SIGAF · Unificar nombres de "Administrador de contrato" (correcciones del usuario)
--   "DRA. HILDA MÓNICA LOPEZ"      -> "Dra. Hilda Mónica López Cervantes"
--   "Dra. Maria Josefina Rodarte"  -> "Dra. María Josefina Rodal Díaz"
-- Compara sin acentos/mayúsculas/espacios para atrapar todas las variantes. Idempotente.
begin;

-- Hilda Mónica López Cervantes (incluye el contrato marcado como "NA", que es de ella)
update contratos set administrador_contrato = 'Dra. Hilda Mónica López Cervantes'
where regexp_replace(translate(upper(coalesce(administrador_contrato,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g') like '%HILDAMONICALOPEZ%'
   or upper(trim(coalesce(administrador_contrato,''))) = 'NA';

-- María Josefina Rodal Díaz (incluye la variante mal escrita "Rodarte")
update contratos set administrador_contrato = 'Dra. María Josefina Rodal Díaz'
where regexp_replace(translate(upper(coalesce(administrador_contrato,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g') like '%JOSEFINARODARTE%'
   or regexp_replace(translate(upper(coalesce(administrador_contrato,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g') like '%JOSEFINARODALDIAZ%';

-- Esly Gerardo García Nava (unifica "Dr. C. ..." y "Dr. ..." -> sin "C.", con acentos)
update contratos set administrador_contrato = 'Dr. Esly Gerardo García Nava'
where regexp_replace(translate(upper(coalesce(administrador_contrato,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g') like '%ESLYGERARDOGARCIANAVA%';

-- Rubén Pizaña González (unifica sin acentos -> con acentos)
update contratos set administrador_contrato = 'Lic. Rubén Pizaña González'
where regexp_replace(translate(upper(coalesce(administrador_contrato,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g') like '%RUBENPIZANAGONZALEZ%';

-- Víctor Iván García Godínez (corrige puntuación/mayúsculas/acentos)
update contratos set administrador_contrato = 'Dr. Víctor Iván García Godínez'
where regexp_replace(translate(upper(coalesce(administrador_contrato,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g') like '%VICTORIVANGARCIAGODINEZ%';

commit;

-- Verificación (lista de administradores distintos y cuántos contratos):
-- select administrador_contrato, count(*) from contratos group by 1 order by 1;
