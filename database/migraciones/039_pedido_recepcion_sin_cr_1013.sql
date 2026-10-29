-- =====================================================================
-- SIGAF · Carga · 039 · Pedido-recepción de facturas que AÚN NO tienen CR (N_AP_IMSS_1013)
-- Fecha: 30/10/2026 · 1013 = recepciones del sistema sin comprobante todavía. Del HGZ 2 (UI 010102) hay 14.
-- A cada recepción se le busca en SIGAF UNA sola factura sin CR del mismo proveedor y con el MISMO importe
-- (±1 peso). Si hay exactamente una, se le anota pedido y recepción y queda "pedido-recepción generado".
-- Si no hay o hay más de una, no se toca. Las que no salgan en el resultado no tienen factura capturada en SIGAF.
-- Cómo: SQL Editor → Run. Muestra las facturas a las que se les puso pedido-recepción.
-- =====================================================================
drop table if exists t1013;
create temp table t1013 (pedido text, recepcion text, prov text, contrato text, importe numeric, fecha_recepcion date, cuentas text);
insert into t1013 values
  ('34766','33658','PRODUCTOS HOSPITALARIOS','050GYR988N0032401200',129714.91,date '2024-12-12','51331024'),
  ('34798','33692','CENTRAL DE GAS','050GYR032N0142401600',10583.25,date '2024-12-18','51311002'),
  ('35231','34124','INFRA','050GYR019N23524-002-00',83289.49,date '2025-03-06','51251015'),
  ('36562','35431','MAQUILADORA','050GYR032N0022504600',40716.00,date '2025-06-10','51351005'),
  ('39676','38511','DISTRIBUIDORA INTERNACIONAL','050GYR032N00225-031-00',16240.00,date '2025-10-14','51351005'),
  ('46386','45162','CENTENARIO','050GYR032T03226-068-00',24624.64,date '2026-10-20','51291001'),
  ('46390','45167','CENTENARIO','050GYR032T03226-068-00',25211.24,date '2026-10-20','51291001'),
  ('46423','45199','SEGURIDAD PRIVADA','050GYR019N21325 006 00',4213611.84,date '2026-10-20','51334001'),
  ('46543','45314','MEDAM','050GYR032N09026-156-00',1721320.11,date '2026-10-26','51351011'),
  ('46570','45341','RELIABLE','050GYR032N0702614700',462940.92,date '2026-10-27','51331017'),
  ('46571','45342','RELIABLE','050GYR032N1232600500',287235.72,date '2026-10-27','51331017'),
  ('46585','45356','INFRA','050GYR032N08626-151-00',117161.68,date '2026-10-28','51331029'),
  ('46586','45357','INFRA','050GYR032N08626-151-00',269479.72,date '2026-10-28','51331029'),
  ('46587','45358','INFRA','050GYR032N08626-151-00',137407.97,date '2026-10-28','51331029');

with cand as (
  select t.pedido, t.recepcion, f.id
  from t1013 t
  join facturas f on abs(f.importe_factura - t.importe) <= 1
  join proveedores p on p.id = f.proveedor_id and p.razon_social ilike '%' || t.prov || '%'
  where f.anulada = false and f.estatus_general <> 'devuelta_proveedor'
    and nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is null
),
unicos as (
  select pedido, recepcion, min(id::text)::uuid as id from cand group by pedido, recepcion having count(*) = 1
),
upd as (
  update facturas f set
    numero_pedido = u.pedido, numero_recepcion = u.recepcion, estatus_pedido_recepcion = 'generado'
  from unicos u
  where f.id = u.id
    and (nullif(btrim(f.numero_pedido), '') is null or ltrim(f.numero_pedido, '0') = u.pedido)
  returning f.folio_ingreso, f.folio_proveedor, f.importe_factura, f.numero_pedido, f.numero_recepcion, f.estatus_general
)
select * from upd order by folio_ingreso;