-- SIGAF · 078 · Diagnóstico (SOLO LECTURA): folios de S6M0043 desde julio, con su factura · 23/11/2026
select s.fecha, s.folio, s.origen, s.importe, s.estudio,
       case when s.cancelado then 'cancelado' when s.factura_id is not null then 'ligado a ' || f.folio_proveedor
            when s.factura_txt is not null then 'factura_txt ' || s.factura_txt else 'devengo' end as estado
  from subrogados_folios s join contratos c on c.id = s.contrato_id left join facturas f on f.id = s.factura_id
 where c.numero_interno = 'S6M0043' and s.fecha >= date '2026-07-01'
 order by s.fecha, s.folio, s.origen;
