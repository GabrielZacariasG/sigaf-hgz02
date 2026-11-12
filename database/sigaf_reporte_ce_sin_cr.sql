-- SIGAF · Compra Emergente SIN contra-recibo (CR), agrupado por cuenta.
-- "Sin CR" = cr_contrarecibo vacío → aún no refleja gasto / no pagada.
-- Compra Emergente = contrato marco CE-<cuenta>.

-- 1) Por cuenta:
select
  replace(c.numero_interno, 'CE-', '') as cuenta,
  count(*)                             as facturas_sin_cr,
  sum(f.importe_factura)               as importe_sin_cr
from facturas f
join contratos c on c.id = f.contrato_id
where c.numero_interno like 'CE-%'
  and f.anulada = false
  and nullif(trim(f.cr_contrarecibo), '') is null
group by replace(c.numero_interno, 'CE-', '')
order by importe_sin_cr desc;

-- 2) Total (una sola cifra):
select
  count(*)               as facturas_sin_cr,
  sum(f.importe_factura) as importe_total_sin_cr
from facturas f
join contratos c on c.id = f.contrato_id
where c.numero_interno like 'CE-%'
  and f.anulada = false
  and nullif(trim(f.cr_contrarecibo), '') is null;
