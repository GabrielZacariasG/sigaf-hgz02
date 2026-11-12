-- SIGAF · Alta del proveedor SOLUCIONES EN LIDERAZGO FARMACEUTICO, S.A. DE C.V.
-- Idempotente: no lo duplica si ya existe algo parecido.

insert into proveedores (razon_social)
select 'SOLUCIONES EN LIDERAZGO FARMACEUTICO, S.A. DE C.V.'
where not exists (select 1 from proveedores where razon_social ilike '%LIDERAZGO FARMACEUTICO%');

-- Verifica:
select id, razon_social from proveedores where razon_social ilike '%LIDERAZGO FARMACEUTICO%';
