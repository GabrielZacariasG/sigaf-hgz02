-- =====================================================================
-- SIGAF · Limpieza de 7 facturas de PRUEBA en Subrogados
-- Son capturas de prueba (folios "...PRUEBA"/"1"), NO formales, anteriores a
-- FVR-01250. Inflaban el total (incluye dos falsas de $15.4M y $5.47M).
-- Se borran SOLO estas 7 por su folio de ingreso. Transaccional.
-- =====================================================================
begin;

-- Liberar referencias sin cascade hacia estas 7
update facturas set sustituida_por_id=null where sustituida_por_id in
  (select id from facturas where folio_ingreso in
   ('HGZ2-CDS-2026-000001','HGZ2-CDS-2026-000002','HGZ2-CDS-2026-000003',
    'HGZ2-CDS-2026-000004','HGZ2-CDS-2026-000005','HGZ2-CDS-2026-000006','HGZ2-CDS-2026-000007'));
update facturas set sustituye_a_id=null where sustituye_a_id in
  (select id from facturas where folio_ingreso in
   ('HGZ2-CDS-2026-000001','HGZ2-CDS-2026-000002','HGZ2-CDS-2026-000003',
    'HGZ2-CDS-2026-000004','HGZ2-CDS-2026-000005','HGZ2-CDS-2026-000006','HGZ2-CDS-2026-000007'));
do $$ begin if to_regclass('ooad_import_filas') is not null then
  update ooad_import_filas set matched_factura_id=null where matched_factura_id in
   (select id from facturas where folio_ingreso in
    ('HGZ2-CDS-2026-000001','HGZ2-CDS-2026-000002','HGZ2-CDS-2026-000003',
     'HGZ2-CDS-2026-000004','HGZ2-CDS-2026-000005','HGZ2-CDS-2026-000006','HGZ2-CDS-2026-000007'));
end if; end $$;

-- Borrar SOLO estas 7 (desglose/historial/validaciones caen en cascada)
delete from facturas where folio_ingreso in
  ('HGZ2-CDS-2026-000001','HGZ2-CDS-2026-000002','HGZ2-CDS-2026-000003',
   'HGZ2-CDS-2026-000004','HGZ2-CDS-2026-000005','HGZ2-CDS-2026-000006','HGZ2-CDS-2026-000007');

-- Verificacion: Subrogados debe quedar 253 / 16,089,767.16
select c.nombre,
       count(*) as facturas,
       to_char(sum(f.importe_factura),'FM999,999,999.00') as importe
from facturas f join capitulos c on c.id=f.capitulo_id
where c.nombre='Capitulo De Subrogados' group by c.nombre;

commit;
