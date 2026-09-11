-- =====================================================================
-- SIGAF · Borrado de facturas de PRUEBA (fase de pruebas)
-- ---------------------------------------------------------------------
-- Borra 18 facturas capturadas en la app que son ensayo:
--   Grupo A (10): folio dice PRUEBA y SIN desglose.
--   Grupo B (7): folio de juguete (1, 1p, 858, 747, A17299/A1729) y SIN desglose.
--   Duplicada (1): HGZ2-AMC-2026-000022 (folio 21249, idéntica a la 000021).
-- SE CONSERVAN: Compra Emergente (no lleva desglose), PRUEBA9422 (tiene
--   desglose = real), INT-000002, SG-000002 y todo lo que tiene desglose.
-- Regla aplicada: "sin desglose = prueba" SOLO en Área Médica/Integrales/
--   Servicios Generales (que sí capturan detalle). Compra Emergente NO.
--
-- Seguro: factura_detalle, historial y validaciones caen por CASCADE; se
--   limpian oficios (array), conciliación OOAD y enlaces de devolución.
-- Transaccional + verificación (aborta si no son exactamente 18).
-- Correr en el SQL Editor de Supabase.
-- =====================================================================

begin;

create temp table _borrar_folios(folio text) on commit drop;
insert into _borrar_folios(folio) values
  -- Grupo A: dicen PRUEBA, sin desglose
  ('HGZ2-AMC-2026-000001'),('HGZ2-AMC-2026-000002'),('HGZ2-AMC-2026-000003'),
  ('HGZ2-AMC-2026-000004'),('HGZ2-AMC-2026-000007'),
  ('HGZ2-INT-2026-000003'),('HGZ2-INT-2026-000004'),
  ('HGZ2-INT-2026-000005'),('HGZ2-INT-2026-000006'),
  ('HGZ2-SG-2026-000001'),
  -- Grupo B: folio de juguete, sin desglose
  ('HGZ2-AMC-2026-000005'),('HGZ2-AMC-2026-000006'),('HGZ2-AMC-2026-000008'),
  ('HGZ2-AMC-2026-000009'),('HGZ2-AMC-2026-000010'),('HGZ2-AMC-2026-000011'),
  ('HGZ2-INT-2026-000001'),
  -- Duplicada exacta (se conserva la 000021)
  ('HGZ2-AMC-2026-000022');

create temp table _ids on commit drop as
  select id from facturas where folio_ingreso in (select folio from _borrar_folios);

-- Seguridad: deben ser exactamente 18. Si no, aborta (no borra nada).
do $$ declare n int; begin
  select count(*) into n from _ids;
  if n <> 18 then raise exception 'Esperaba 18 facturas, encontré % — se aborta.', n; end if;
end $$;

-- 1) Quitar estas facturas de cualquier oficio (columna array factura_ids)
update oficios o
set factura_ids = coalesce(
  (select array_agg(x) from unnest(o.factura_ids) x where x not in (select id from _ids)), '{}')
where exists (select 1 from unnest(o.factura_ids) x where x in (select id from _ids));

-- 2) Soltar conciliación OOAD (matched_factura_id no tiene cascade)
update ooad_import_filas
set matched_factura_id = null, matched_at = null, matched_by = null
where matched_factura_id in (select id from _ids);

-- 3) Romper enlaces de sustitución (devoluciones)
update facturas set sustituida_por_id = null where sustituida_por_id in (select id from _ids);
update facturas set sustituye_a_id    = null where sustituye_a_id    in (select id from _ids);

-- 4) Borrar (factura_detalle, historial y validaciones por CASCADE)
delete from facturas where id in (select id from _ids);

-- 5) Verificación: deben quedar 0 de la lista
select count(*) as deben_ser_cero
from facturas where folio_ingreso in (select folio from _borrar_folios);

commit;
