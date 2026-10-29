-- =====================================================================
-- SIGAF · Alta · 042 · 3 facturas que el sistema ya registró y SIGAF no tenía (pantalla Comprobantes → Faltan)
-- Fecha: 30/10/2026 · Aprobado por Gabriel · fuente: N_AP_IMSS_1043 del 29/10 y N_AP_IMSS_4002
--   Medina León Jorge Eduardo  3583  víveres 51221001  contrato D6M0029  $18,502.00
--       CR 00475063, PAGADO el 29/10/2026 (4002) → Gasto reflejado. Factura del 06/10/2026, servicio de septiembre.
--   Laboratorio Clínico Profesional y Bacteriológico  4278  51331003  contrato S6M0042  $1,496.40
--       CR 00476573, sin pagar (programado 17/11/2026) → En trámite OOAD. Factura del 01/09/2026, servicio de agosto.
--   Laboratorio Clínico Profesional y Bacteriológico  4252  51331003  contrato S6M0042  $16,283.56
--       CR 00476575 (factura total $17,168.00: $16,283.56 HGZ 2 + $884.44 UI 010101), sin pagar → En trámite OOAD.
--       Se registra la parte del HGZ 2, como en Cruz Roja y Autobuses. Factura del 06/08/2026, servicio de julio.
-- Firmas: autorizadas por Adm. de Contrato (si OOAD ya les dio CR, ya pasaron firmas).
-- SEGURO: no da de alta si ya existe una factura viva de ese proveedor con ese folio, ni si el contrato no existe.
-- Cómo: SQL Editor → Run. Debe mostrar 3 filas (si Medina León no sale, su contrato D6M0029 no está en SIGAF).
-- =====================================================================
with nv (n, contrato, serie, folio, f_factura, p_ini, p_fin, importe, gen, cr, f_pago) as (values
  (1, 'D6M0029', 'HGZ2-AMC-2026-', '3583', date '2026-10-06', date '2026-09-01', date '2026-09-30', 18502.00, 'gasto_reflejado', '00475063', date '2026-10-29'),
  (2, 'S6M0042', 'HGZ2-CDS-2026-', '4278', date '2026-09-01', date '2026-08-01', date '2026-08-31',  1496.40, 'en_tramite_ooad', '00476573', null::date),
  (3, 'S6M0042', 'HGZ2-CDS-2026-', '4252', date '2026-08-06', date '2026-07-01', date '2026-07-31', 16283.56, 'en_tramite_ooad', '00476575', null::date)),
con as (
  select nv.*, c.id as contrato_id, c.partida_id, c.proveedor_id, pa.capitulo_id
  from nv
  join lateral (select * from contratos c where c.numero_interno ilike nv.contrato || '%' order by c.vigencia_fin desc nulls last limit 1) c on true
  join partidas pa on pa.id = c.partida_id
  where not exists (select 1 from facturas f where f.proveedor_id = c.proveedor_id and f.anulada = false
                    and regexp_replace(f.folio_proveedor, '\D', '', 'g') = nv.folio)
),
num as (
  select con.*, (select coalesce(max(substring(f.folio_ingreso from '(\d+)$')::int), 0) from facturas f where f.folio_ingreso like con.serie || '%')
                + row_number() over (partition by con.serie order by con.n) as consecutivo
  from con
),
ins as (
  insert into facturas (
    folio_ingreso, folio_proveedor, fecha_factura, capitulo_id, partida_id, contrato_id, proveedor_id,
    periodo_inicio, periodo_fin, importe_factura, tasa_iva,
    estatus_general, estatus_firmas, estatus_pedido_recepcion, cr_contrarecibo, fecha_pago, origen_migracion, created_by
  )
  select num.serie || lpad(num.consecutivo::text, 6, '0'), num.folio, num.f_factura, num.capitulo_id, num.partida_id, num.contrato_id, num.proveedor_id,
         num.p_ini, num.p_fin, num.importe,
         coalesce((select f.tasa_iva from facturas f where f.contrato_id = num.contrato_id and f.anulada = false limit 1), 0),
         num.gen::estatus_general, 'autorizada_admin_contrato', 'generado', num.cr, num.f_pago,
         'Alta 30/10/2026 desde Comprobantes (faltan en SIGAF): N_AP_IMSS_1043 cbte ' || num.cr,
         (select id from usuarios where nombre = 'Gabriel Zacarias' limit 1)
  from num
  returning folio_ingreso, folio_proveedor, importe_factura, estatus_general, cr_contrarecibo, fecha_pago
)
select * from ins order by folio_ingreso;
