-- =====================================================================
-- SIGAF · 061 · Saldo del contrato en FINAT vs saldo del dictamen (IMKK036, página 3)
-- Fecha: 17/11/2026
-- El IMKK036 trae en su "RESUMEN DE IMPORTES Y SALDOS":
--   [ICTO] Importe máximo de los contratos asociados  ·  [SDO1] Saldo comprometido SIN contrato = [IDEF] − [ICTO]
-- Si SDO1 > 0, el dictamen ya tiene dinero que el contrato todavía no trae en FINAT (falta registrar el convenio
-- modificatorio). FINAT valida contra el CONTRATO: saldo del contrato = ICTO − gastos. Mientras no se registre el
-- convenio, las facturas esperan ("en espera CM") aunque el dictamen tenga saldo. Caso que lo enseñó: Promotora
-- S6M0047, dictamen 0000155456-2026 al 17/11/2026: dictamen 17,460,007.55, contrato 16,162,728.99, gastos
-- 16,014,096.96 → saldo en contrato 148,632.03 y 1,297,278.56 sin contrato.
-- La carga del IMKK036 los guarda sola desde ahora; aquí se ponen los de los 40 dictámenes del 17/11/2026.
-- Se puede correr dos veces.
-- =====================================================================
alter table dictamenes add column if not exists importe_contratos  numeric(16,2);  -- [ICTO]
alter table dictamenes add column if not exists saldo_sin_contrato numeric(16,2);  -- [SDO1]

update dictamenes d set importe_contratos = v.icto, saldo_sin_contrato = v.sdo1
from (values
  ('0000007125-2025', 35000.00, 0.00),
  ('0000031654-2025', 27546532.70, 0.02),
  ('0000041413-2025', 3510367.99, -0.01),
  ('0000047286-2025', 1378860.86, 0.00),
  ('0000056673-2026', 450000.00, 0.00),
  ('0000059287-2026', 4638740.61, 0.00),
  ('0000076588-2026', 250000.00, 0.00),
  ('0000088391-2026', 13839213.59, 0.01),
  ('0000094209-2026', 6487131.70, 0.02),
  ('0000097084-2026', 1278595.00, 0.00),
  ('0000097085-2026', 5579999.99, 0.01),
  ('0000100779-2026', 253239.60, 0.00),
  ('0000104077-2026', 1081188.61, 0.01),
  ('0000115659-2026', 2575679.08, -0.01),
  ('0000115663-2026', 183323.03, 0.00),
  ('0000115672-2026', 162183.08, -0.01),
  ('0000115681-2026', 48691.00, 0.00),
  ('0000118610-2026', 655759.61, 0.00),
  ('0000123587-2026', 8274536.00, 0.00),
  ('0000137420-2026', 256986.24, 0.00),
  ('0000137439-2026', 303500.00, 0.00),
  ('0000137441-2026', 877685.80, 0.00),
  ('0000137442-2026', 925012.79, 0.00),
  ('0000137444-2026', 421566.66, 0.00),
  ('0000152504-2026', 533551.20, -1.00),
  ('0000155456-2026', 16162728.99, 1297278.56),
  ('0000155458-2026', 3652996.53, 0.01),
  ('0000175543-2026', 1201482.37, 0.00),
  ('0000205281-2026', 9277.68, 0.00),
  ('0000211466-2026', 50127.51, 0.00),
  ('0000211470-2026', 10025.51, 0.00),
  ('0000233878-2026', 1106792.67, 0.00),
  ('0000271322-2026', 12470.00, 0.00),
  ('0000271331-2026', 157760.00, 0.00),
  ('0000271336-2026', 195593.40, 0.00),
  ('0000277104-2026', 32837.28, 0.00),
  ('0000277107-2026', 27014.08, 0.00),
  ('0000277112-2026', 185600.00, 0.00),
  ('0000467664-2026', 180198.10, 0.00),
  ('0000505827-2026', 1620000.00, 0.00)
) as v(numero, icto, sdo1)
where d.numero = v.numero and d.corte = date '2026-11-17';

select numero, corte, to_char(importe_contratos, 'FM999,999,999.00') as contrato_finat,
       to_char(total_pagos, 'FM999,999,999.00') as gastos,
       to_char(importe_contratos - total_pagos, 'FM999,999,999.00') as saldo_en_contrato,
       to_char(saldo_sin_contrato, 'FM999,999,999.00') as sin_contrato
from dictamenes where saldo_sin_contrato > 0.5 order by saldo_sin_contrato desc;
