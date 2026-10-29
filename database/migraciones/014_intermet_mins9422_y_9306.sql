-- =====================================================================
-- SIGAF · Corrección · 014 · Intermet (laparoscopía, 51331015): MINS9422 que faltaba y CR de MINS9306
-- Fecha: 29/10/2026 · Aprobado por Gabriel
--
-- Cuenta 51331015: SIGAF tenía $422,759.68 menos que el sistema. Es exactamente la factura
--   MINS9422 (servicio del 1 al 25 de julio 2026), Intermet:
--   · en la cédula (hoja integrales, fila 14)
--   · en el sistema: CR 00476345, emitido 26/10/2026, presupuesto V, aún SIN pagar,
--     fecha de factura 30/07/2026, pedido 46420 / recepción 45194
--   · se envió a pago con SIGAF-EP-0024 pero la factura nunca se capturó en SIGAF.
-- Además MINS9306 (junio, $488,413.36) seguía "En revisión" sin CR; el sistema ya le dio CR 00476309
--   (emitido 26/10/2026, sin pagar, pedido 46419 / recepción 45193).
--
-- 1) Alta de MINS9422 en el contrato 988T01723-022, "En trámite OOAD" con su CR, firmas y P&R.
-- 2) MINS9306 a "En trámite OOAD" con su CR.
-- SEGURO: no da de alta MINS9422 si ya existe (no anulada); solo actualiza MINS9306 si sigue sin CR.
-- Cómo: SQL Editor de Supabase → Run. Al final: 51331015 = 23 facturas $6,880,853.20 (= gasto del sistema).
-- =====================================================================
insert into facturas (
  folio_ingreso, folio_proveedor, fecha_factura, capitulo_id, partida_id, contrato_id, proveedor_id,
  periodo_inicio, periodo_fin, importe_factura, tasa_iva,
  estatus_general, estatus_firmas, estatus_pedido_recepcion,
  cr_contrarecibo, numero_pedido, numero_recepcion, origen_migracion, created_by
)
select
  'HGZ2-INT-2026-' || lpad((coalesce((select max(substring(folio_ingreso from 'HGZ2-INT-2026-(\d+)$')::int)
                                       from facturas where folio_ingreso ~ '^HGZ2-INT-2026-\d+$'), 0) + 1)::text, 6, '0'),
  'MINS9422', date '2026-07-30', pa.capitulo_id, c.partida_id, c.id, c.proveedor_id,
  date '2026-07-01', date '2026-07-25', 422759.68,
  coalesce((select f.tasa_iva from facturas f where f.contrato_id = c.id and f.anulada = false limit 1), 0),
  'en_tramite_ooad', 'autorizada_admin_contrato', 'generado',
  '00476345', '46420', '45194',
  'Puesta al día 29/10/2026: N_AP_IMSS_1043 cbte 00476345; enviada con SIGAF-EP-0024 sin factura en SIGAF',
  (select id from usuarios where nombre = 'Gabriel Zacarias' limit 1)
from contratos c
join partidas pa on pa.id = c.partida_id
where c.numero_interno = '988T01723-022'
  and not exists (
    select 1 from facturas f join proveedores p on p.id = f.proveedor_id
    where p.razon_social ilike '%INTERMET%' and f.anulada = false
      and regexp_replace(f.folio_proveedor, '\D', '', 'g') = '9422'
  );

update facturas f set
  estatus_general = 'en_tramite_ooad',
  cr_contrarecibo = '00476309',
  numero_pedido   = coalesce(nullif(f.numero_pedido, ''), '46419'),
  numero_recepcion = coalesce(nullif(f.numero_recepcion, ''), '45193')
from proveedores p
where p.id = f.proveedor_id and p.razon_social ilike '%INTERMET%'
  and f.anulada = false
  and regexp_replace(f.folio_proveedor, '\D', '', 'g') = '9306'
  and nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is null;

-- Verificación: debe dar 51331015 = 23 facturas y 6,880,853.20
select p.cuenta_finat, count(f.id) as facturas, sum(f.importe_factura) as importe,
       count(*) filter (where nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is null) as sin_cr
from facturas f join partidas p on p.id = f.partida_id
where p.cuenta_finat = '51331015' and f.anulada = false and f.estatus_general <> 'devuelta_proveedor'
group by p.cuenta_finat;
