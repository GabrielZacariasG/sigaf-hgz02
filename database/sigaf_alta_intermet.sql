-- SIGAF · Alta del contrato INTERMET 988T01723-022 (Integrales)
--   "Servicio Médico Integral para Procedimientos de Mínima Invasión" (2023-2025;
--    el Convenio Modificatorio N°3 cubre compromisos del ejercicio fiscal 2026).
--   Cuenta: 51331015 "Serv. Integral cirugía mínima invasión" (capítulo Integrales).
--   VA POR SUBTOTAL: el precio es multi-procedimiento y está en anexo económico escaneado
--   (598 pp), no se puede deducir del Excel (gasto÷cantidad varía por mezcla de procedimientos).
--   Por eso NO se carga contrato_servicios; la factura se valida por subtotal.
-- Idempotente. Corre en el SQL Editor de Supabase.
begin;

-- 1) Proveedor
insert into proveedores (razon_social)
select 'INTERMET, S.A. DE C.V.'
where not exists (select 1 from proveedores where upper(razon_social) = 'INTERMET, S.A. DE C.V.');

-- 2) Partida 51331015 en Integrales (alta si no existe)
--    La cuenta va en cuenta_finat; cuenta_prei se deja NULL (check de formato chk_cuenta_prei).
insert into partidas (capitulo_id, cuenta_finat, nombre)
select cap.id, '51331015', 'Serv. Integral cirugía mínima invasión'
from capitulos cap
where cap.nombre = 'Integrales'
  and not exists (
    select 1 from partidas p
    where p.capitulo_id = cap.id and p.cuenta_finat = '51331015'
  );

-- 3) Contrato INTERMET (sin catálogo de servicios → captura por subtotal)
insert into contratos
  (numero_interno, proveedor_id, partida_id, administrador_contrato,
   adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo, comentarios)
select
  '988T01723-022',
  (select id from proveedores where upper(razon_social) = 'INTERMET, S.A. DE C.V.' limit 1),
  (select p.id from partidas p join capitulos cap on cap.id = p.capitulo_id
     where cap.nombre = 'Integrales' and p.cuenta_finat = '51331015' limit 1),
  'Lic. Rubén Pizaña González',
  'Servicio Médico Integral para Procedimientos de Mínima Invasión (2023-2025; CM3 cubre 2026)',
  date '2023-01-01', date '2026-12-31',
  18183692.40, 43059156.84,
  'Alta para captura 2026. Contrato 2023-2025 con Convenio Modificatorio N°3 que cubre ejercicio fiscal 2026. Precio por subtotal (anexo económico escaneado, multi-procedimiento).'
where not exists (select 1 from contratos where numero_interno = '988T01723-022')
  and exists     (select 1 from partidas p join capitulos cap on cap.id = p.capitulo_id
                    where cap.nombre = 'Integrales' and p.cuenta_finat = '51331015');

commit;

-- Verificación:
-- select c.numero_interno, pr.razon_social, cap.nombre capitulo, p.cuenta_prei, c.vigencia_inicio, c.vigencia_fin
-- from contratos c
-- join proveedores pr on pr.id=c.proveedor_id
-- join partidas p on p.id=c.partida_id
-- join capitulos cap on cap.id=p.capitulo_id
-- where c.numero_interno='988T01723-022';
