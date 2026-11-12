-- SIGAF · Alta de proveedores para Compra Emergente.
-- Idempotente: no los duplica si ya existe algo parecido.

insert into proveedores (razon_social)
select 'DISTRIBUIDORA POTOSINA BIOFAR'
where not exists (select 1 from proveedores where razon_social ilike '%POTOSINA BIOFAR%');

insert into proveedores (razon_social)
select 'PAMELA PEREDA VELAZQUEZ'
where not exists (select 1 from proveedores where razon_social ilike '%PAMELA PEREDA%');

-- Verifica:
select id, razon_social from proveedores
where razon_social ilike '%POTOSINA BIOFAR%' or razon_social ilike '%PAMELA PEREDA%';
