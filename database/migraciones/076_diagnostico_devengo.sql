-- SIGAF · 076 · Diagnóstico (SOLO LECTURA): facturas y folios de S6M0040, S6M0046 y S6M0043 · 23/11/2026
select 'factura' as que, c.numero_interno as cto, f.folio_proveedor as folio, f.importe_factura as importe,
       f.estatus_general::text as estatus, f.cr_contrarecibo as cr,
       coalesce(f.periodo_inicio::text, '') || ' a ' || coalesce(f.periodo_fin::text, '') as periodo,
       (select count(*) from subrogados_folios s where s.factura_id = f.id) as folios_ligados,
       (select coalesce(sum(s.importe), 0) from subrogados_folios s where s.factura_id = f.id and not s.cancelado) as importe_folios
  from facturas f join contratos c on c.id = f.contrato_id
 where c.numero_interno in ('S6M0040', 'S6M0046', 'S6M0043') and not coalesce(f.anulada, false)
union all
select 'folio', c.numero_interno, s.folio, s.importe,
       case when s.cancelado then 'cancelado' when s.factura_id is not null then 'ligado' when s.factura_txt is not null then 'factura_txt ' || s.factura_txt else 'devengo' end,
       s.origen, coalesce(s.fecha::text, '') || ' · año ' || coalesce(s.anio::text, 'NULO') || ' mes ' || coalesce(s.mes::text, 'NULO'),
       null, null
  from subrogados_folios s join contratos c on c.id = s.contrato_id
 where c.numero_interno in ('S6M0040', 'S6M0046') or (c.numero_interno = 'S6M0043' and s.factura_id is null and not s.cancelado)
 order by 2, 1, 3;
