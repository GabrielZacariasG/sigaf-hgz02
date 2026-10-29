-- SIGAF · 011b · Diagnóstico (SOLO LECTURA): por qué la 011 no dio de alta UCN 311/313
-- Muestra el contrato de UCN y cualquier factura de ese proveedor o con folio UCN, en una sola tabla.
select 'contrato' as que, c.numero_interno as dato1, p.cuenta_finat as dato2, pr.razon_social as dato3,
       c.vigencia_inicio::text as dato4, c.id::text as dato5
from contratos c
join partidas p on p.id = c.partida_id
join proveedores pr on pr.id = c.proveedor_id
where c.numero_interno ilike '%09825-108%' or pr.razon_social ilike '%NEFRO%'
union all
select 'factura', f.folio_proveedor, p.cuenta_finat,
       pr.razon_social || ' · ' || f.estatus_general || ' · anulada=' || f.anulada,
       f.importe_factura::text, f.folio_ingreso
from facturas f
join partidas p on p.id = f.partida_id
join proveedores pr on pr.id = f.proveedor_id
where pr.razon_social ilike '%NEFRO%' or f.folio_proveedor ilike '%UCN%'
   or regexp_replace(f.folio_proveedor, '\D', '', 'g') in ('311', '313')
order by 1, 2;
