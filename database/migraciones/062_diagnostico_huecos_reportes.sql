-- =====================================================================
-- SIGAF · 062 · Diagnóstico: ¿los reportes (1043 / 4002 / 4007) están ligando bien? ¿hay huecos?
-- Fecha: 18/11/2026 · SOLO LECTURA: no cambia nada. Se puede correr las veces que sea.
-- Devuelve una sola tabla (orden, revision, ...). Cada "revision" es un tipo de hueco:
--   0 cobertura   · por mes de emisión: cuántos comprobantes del HGZ 2 tiene SIGAF y cuándo se refrescaron por última vez
--   1 cr_no_existe · la factura tiene un CR que no está en ningún 1043 cargado (mal capturado o de un mes no cargado)
--   2 cr_no_cuadra · el CR existe pero su importe no cuadra con la(s) factura(s) que lo tienen (CR de otra factura)
--   3 cr_eliminado · el CR de la factura fue eliminado en el sistema y SIGAF no tiene el nuevo
--   4 pagado_no_reflejado · el sistema ya lo pagó y en SIGAF no está como gasto reflejado
--   5 reflejado_no_pagado · en SIGAF es gasto reflejado pero el sistema no lo tiene pagado
--   6 sin_fecha_pago · gasto reflejado sin fecha de pago
--   7 faltan_en_sigaf · comprobantes vivos del HGZ 2 que SIGAF no tiene (por mes)
--   8 cargas · últimas cargas de reportes
-- =====================================================================
with cb as (
  select ltrim(regexp_replace(cbte, '\D', '', 'g'), '0') as cr,
         min(cbte) as cbte,
         bool_and(estado_entrada = 'X') as eliminado,
         bool_or(estado_entrada <> 'X' and estado_pago = 'P') as pagado,
         bool_or(estado_entrada <> 'X' and estado_pago = 'X') as pago_cancelado,
         max(importe) as importe,
         sum(importe_cuenta) filter (where ui in ('010102', '019001')) as imp_hgz2,
         bool_or(ui in ('010102', '019001')) as hgz2,
         bool_or(ui = '010102') as ui_hgz2,
         min(fecha_emision) as emision,
         max(fecha_prog_pago) as fprog,
         max(actualizado_at) as refresco,
         max(factura_txt) as factura_txt,
         max(proveedor) as proveedor
  from comprobantes_ooad
  group by 1
),
fa as (
  select f.id, f.folio_ingreso, f.folio_proveedor, f.importe_factura, f.estatus_general, f.fecha_pago,
         p.razon_social as proveedor,
         ltrim(regexp_replace(coalesce(f.cr_contrarecibo, ''), '\D', '', 'g'), '0') as cr
  from facturas f left join proveedores p on p.id = f.proveedor_id
  where not f.anulada and f.estatus_general <> 'devuelta_proveedor'
),
porcr as (
  select cr, sum(importe_factura) as suma, count(*) as n, string_agg(folio_proveedor, ', ') as folios
  from fa where cr <> '' group by cr
),
r as (
  -- 0 cobertura
  select 0 as orden, 'cobertura' as revision, to_char(date_trunc('month', emision), 'YYYY-MM') as referencia,
         null::text as proveedor, null::text as factura,
         count(*)::numeric as importe_sigaf, null::numeric as importe_sistema,
         'comprobantes del HGZ 2 · último refresco ' || to_char(max(refresco) at time zone 'America/Mexico_City', 'DD/MM/YYYY') as detalle
  from cb where hgz2 and emision >= date '2026-01-01' group by 3
  union all
  -- 1 CR que no existe en ningún 1043 cargado
  select 1, 'cr_no_existe', fa.cr, fa.proveedor, fa.folio_ingreso || ' · ' || fa.folio_proveedor, fa.importe_factura, null,
         'estatus ' || fa.estatus_general
  from fa left join cb on cb.cr = fa.cr
  where fa.cr <> '' and cb.cr is null
  union all
  -- 2 CR que existe pero no cuadra con lo que SIGAF le cuelga (±1 peso, contra el total o contra lo del HGZ 2)
  select 2, 'cr_no_cuadra', pc.cr, cb.proveedor, pc.folios, pc.suma, cb.importe,
         'el sistema dice: ' || coalesce(cb.factura_txt, '') || ' · HGZ 2 ' || coalesce(to_char(cb.imp_hgz2, 'FM999,999,990.00'), '—') || ' · ' || pc.n || ' factura(s) en SIGAF con este CR'
  from porcr pc join cb on cb.cr = pc.cr
  where not cb.eliminado
    and abs(pc.suma - cb.importe) > 1
    and abs(pc.suma - coalesce(cb.imp_hgz2, -1)) > 1
  union all
  -- 3 CR eliminado
  select 3, 'cr_eliminado', fa.cr, fa.proveedor, fa.folio_ingreso || ' · ' || fa.folio_proveedor, fa.importe_factura, cb.importe,
         'estatus ' || fa.estatus_general || ' · el sistema eliminó el CR; buscar el nuevo'
  from fa join cb on cb.cr = fa.cr where cb.eliminado
  union all
  -- 4 pagado en el sistema, no reflejado en SIGAF
  select 4, 'pagado_no_reflejado', fa.cr, fa.proveedor, fa.folio_ingreso || ' · ' || fa.folio_proveedor, fa.importe_factura, cb.importe,
         'estatus ' || fa.estatus_general || ' · pagado (prog. ' || coalesce(to_char(cb.fprog, 'DD/MM/YYYY'), '—') || ')'
  from fa join cb on cb.cr = fa.cr
  where cb.pagado and fa.estatus_general <> 'gasto_reflejado'
  union all
  -- 5 gasto reflejado en SIGAF pero el sistema no lo tiene pagado
  select 5, 'reflejado_no_pagado', fa.cr, fa.proveedor, fa.folio_ingreso || ' · ' || fa.folio_proveedor, fa.importe_factura, cb.importe,
         case when cb.pago_cancelado then 'PAGO CANCELADO en el sistema' else 'el sistema no lo tiene pagado' end
  from fa join cb on cb.cr = fa.cr
  where fa.estatus_general = 'gasto_reflejado' and not cb.pagado and not cb.eliminado
  union all
  -- 6 gasto reflejado sin fecha de pago
  select 6, 'sin_fecha_pago', fa.cr, fa.proveedor, fa.folio_ingreso || ' · ' || fa.folio_proveedor, fa.importe_factura, null, ''
  from fa where fa.estatus_general = 'gasto_reflejado' and fa.fecha_pago is null
  union all
  -- 7 comprobantes vivos del HGZ 2 (UI 010102) que SIGAF no tiene, por mes
  select 7, 'faltan_en_sigaf', to_char(date_trunc('month', cb.emision), 'YYYY-MM'), null, null,
         count(*)::numeric, sum(coalesce(cb.imp_hgz2, cb.importe)), 'comprobantes sin factura en SIGAF'
  from cb left join porcr pc on pc.cr = cb.cr
  where cb.ui_hgz2 and not cb.eliminado and pc.cr is null and cb.emision >= date '2026-01-01'
  group by 3
  union all
  -- 8 últimas cargas
  select 8, 'cargas', to_char(created_at at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI'), null, archivo,
         renglones::numeric, comprobantes::numeric,
         'emisión ' || coalesce(to_char(desde, 'DD/MM/YYYY'), '—') || ' a ' || coalesce(to_char(hasta, 'DD/MM/YYYY'), '—')
  from (select * from cargas_nap order by created_at desc limit 25) c
)
select * from r order by orden, referencia;
