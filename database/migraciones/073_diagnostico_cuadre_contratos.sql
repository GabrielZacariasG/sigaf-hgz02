-- =====================================================================
-- SIGAF · 073 · Diagnóstico (SOLO LECTURA) del cuadre de los contratos del Avance SMS de noviembre 2026
-- Fecha: 23/11/2026 · No modifica nada.
-- Cruza las facturas de SIGAF de cada contrato contra los comprobantes de FINAT (1043 cargado en comprobantes_ooad,
-- con su reparto por unidad de información) y los apoyos registrados. Saca cada diferencia con su tipo:
--   A) CR repartido: la factura de SIGAF es del HGZ 2 pero FINAT cargó parte (o todo) a otra UI → apoyo RECIBIDO.
--   B) CR con importe al HGZ 2 que no es factura del contrato en SIGAF → apoyo DADO (dice si ya está registrado).
--   C) Factura marcada pagada en SIGAF cuyo CR no está en comprobantes_ooad (o está eliminado/no pagado).
-- Cómo: SQL Editor de Supabase → Run → descargar el resultado como CSV y pasárselo a Claude.
-- =====================================================================
with ctos as (
  select id, numero_interno from contratos
  where numero_interno in ('S6M0010','S6M0016','S6M0003','S5M0005','S6M0017','S6M0015','S6M0012','S6M0046','S6M0040',
                           'S6M0041','S6M0042','S6M0043','S6M0047','S6M0049','S6M0050','S6M0048','S7M0163','S6M0022','S6M0030','S6M0112')
),
fac as (
  select c.numero_interno as cto, f.folio_proveedor, f.importe_factura, f.estatus_general::text as estatus_general,
         nullif(ltrim(regexp_replace(coalesce(f.cr_contrarecibo, ''), '\D', '', 'g'), '0'), '') as cr
  from facturas f join ctos c on c.id = f.contrato_id
  where not coalesce(f.anulada, false)
),
fcr as (
  select cto, cr, sum(importe_factura) as imp, string_agg(folio_proveedor, ', ' order by folio_proveedor) as folios,
         string_agg(distinct estatus_general, ', ') as estatus
  from fac where cr is not null group by cto, cr
),
cmp as (
  select nullif(ltrim(cbte, '0'), '') as cr,
         upper(split_part(regexp_replace(coalesce(contrato, ''), '\s', '', 'g'), '-', 1)) as cto,
         round(sum(importe_cuenta) filter (where ui = '010102'), 2) as hgz2,
         round(sum(importe_cuenta) filter (where ui <> '010102'), 2) as otras,
         string_agg(ui || '=' || importe_cuenta, ' ' order by linea) as reparto,
         max(factura_txt) as factura_txt, max(usuario) as usuario, max(estado_entrada) as entrada,
         max(estado_ppto) as ppto, max(estado_pago) as pago, max(fecha_prog_pago) as fecha_pago
  from comprobantes_ooad group by 1, 2
),
apo as (select a.nota, a.importe, a.estado from contrato_apoyos a join ctos c on c.id = a.contrato_id)
-- A) Factura de SIGAF cuyo CR no cargó todo al HGZ 2
select 'A apoyo recibido / reparto' as tipo, fcr.cto, fcr.cr, fcr.folios as sigaf_facturas, fcr.imp as sigaf_importe, fcr.estatus as sigaf_estatus,
       cmp.hgz2 as finat_hgz2, cmp.otras as finat_otras_ui, cmp.reparto, cmp.usuario, cmp.entrada || '/' || cmp.ppto || '/' || cmp.pago as ent_ppto_pago, cmp.fecha_pago::text,
       null::text as apoyo_registrado
from fcr join cmp on cmp.cr = fcr.cr
where coalesce(cmp.entrada, '') <> 'X' and abs(coalesce(cmp.hgz2, 0) - fcr.imp) > 1
union all
-- B) CR del contrato con importe al HGZ 2 que no es factura del contrato en SIGAF
select 'B apoyo dado / falta en SIGAF', ctos.numero_interno, cmp.cr, cmp.factura_txt, null, null,
       cmp.hgz2, cmp.otras, cmp.reparto, cmp.usuario, cmp.entrada || '/' || cmp.ppto || '/' || cmp.pago, cmp.fecha_pago::text,
       (select string_agg(apo.estado || ' ' || apo.importe, ', ') from apo where apo.nota like '%' || cmp.cr || ']%' or apo.nota like '%' || lpad(cmp.cr, 8, '0') || '%')
from cmp join ctos on ctos.numero_interno = cmp.cto
where coalesce(cmp.hgz2, 0) > 0 and coalesce(cmp.entrada, '') <> 'X'
  and not exists (select 1 from fcr where fcr.cr = cmp.cr)
union all
-- C) Factura pagada en SIGAF sin CR vivo y pagado en comprobantes_ooad
select 'C pagada en SIGAF sin CR pagado en FINAT', fcr.cto, fcr.cr, fcr.folios, fcr.imp, fcr.estatus,
       cmp.hgz2, cmp.otras, cmp.reparto, cmp.usuario, coalesce(cmp.entrada || '/' || cmp.ppto || '/' || cmp.pago, 'no está en comprobantes_ooad'), cmp.fecha_pago::text, null
from fcr left join cmp on cmp.cr = fcr.cr
where fcr.estatus = 'gasto_reflejado' and (cmp.cr is null or cmp.entrada = 'X' or coalesce(cmp.pago, '') <> 'P')
order by 1, 2, 3;
