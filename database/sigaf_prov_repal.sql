-- SIGAF · Alta del proveedor REPAL Y ASOC (para Compra Emergente y donde se ocupe).
-- Idempotente: no lo duplica si ya existe algo parecido.
insert into proveedores (razon_social)
select 'REPAL Y ASOC'
where not exists (select 1 from proveedores where razon_social ilike '%REPAL%');

-- Verifica:
select id, razon_social from proveedores where razon_social ilike '%REPAL%';
