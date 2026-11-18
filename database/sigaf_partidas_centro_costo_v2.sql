-- =====================================================================
-- SIGAF · Centro de costos por CUENTA  (v2 · fuente FINAT: hoja "dispo")
-- ---------------------------------------------------------------------
-- CORRECCIÓN. En la v1 solo mapeé las cuentas que aparecían en los
-- encabezados de bloque de la cédula, y 23 cuentas quedaron sin CC.
-- Resulta que SÍ están en la cédula: en la hoja "dispo" (el reporte de
-- disponibilidad de FINAT, ID IMKK022), que lista CADA cuenta con su
-- Centro de Costo real (columna "Centro Costo").
--
-- Cuando una cuenta trae presupuesto repartido en varios CC, se tomó
-- el CC donde de verdad está el presupuesto+gasto (el dominante).
-- Las 31 cuentas de la v1 coincidieron EXACTAMENTE con FINAT; aquí se
-- agregan las que faltaban (subrogados, víveres, osteosíntesis, etc.).
--
-- Solo rellena cuentas que estén VACÍAS (no pisa lo editado a mano).
-- Correr en el SQL Editor de Supabase. Idempotente.
-- Fuente: "Cedula Gasto 2026 OCTUBRE-.xlsb" · hoja dispo (26/10/2026).
-- =====================================================================

alter table partidas add column if not exists centro_costo text;

-- Mapeo cuenta PREI -> centro de costos (FINAT / hoja dispo).
update partidas p set centro_costo = v.cc
from (values
  ('51211001','142901'),
  ('51211003','200200'),
  ('51211007','200203'),
  ('51211010','200217'),
  ('51221001','200209'),   -- Víveres
  ('51221005','200209'),
  ('51241004','142902'),
  ('51241006','142902'),
  ('51241007','142902'),
  ('51241008','142902'),
  ('51241009','142902'),
  ('51251002','200223'),
  ('51251003','200223'),
  ('51251005','200223'),
  ('51251006','200223'),   -- Prod. medicina magisterial
  ('51251007','200223'),
  ('51251012','200217'),
  ('51251013','200217'),
  ('51251014','200217'),
  ('51251015','200217'),
  ('51251017','200217'),
  ('51251018','200223'),   -- Aparatos ortopedia / prótesis
  ('51251019','200219'),   -- Mat. osteosíntesis / endoprótesis
  ('51251020','200217'),
  ('51251021','200217'),
  ('51251022','200205'),
  ('51251023','200207'),
  ('51251024','200205'),
  ('51251025','142902'),
  ('51261001','141901'),
  ('51261002','141901'),
  ('51261003','142901'),
  ('51271002','250904'),   -- Vestuario
  ('51291001','142902'),
  ('51291002','142902'),
  ('51291003','200200'),
  ('51291006','142902'),
  ('51291007','200217'),
  ('51291009','142902'),
  ('51311001','142901'),
  ('51311002','142901'),
  ('51311003','142901'),
  ('51311004','200200'),
  ('51311009','200200'),
  ('51311013','200200'),
  ('51321003','200217'),
  ('51331001','200223'),   -- Honorarios atención médica subrogada
  ('51331002','200227'),
  ('51331003','200223'),   -- Subrogación diag. laboratorio (18 contratos)
  ('51331005','200217'),   -- Hospitalización subrogada
  ('51331010','200223'),
  ('51331013','200205'),
  ('51331014','200227'),
  ('51331015','200219'),
  ('51331017','200207'),   -- Serv. integral digitalización/imagen
  ('51331020','200223'),
  ('51331024','200263'),
  ('51331029','200217'),
  ('51332001','142902'),
  ('51332009','200200'),
  ('51334001','140200'),
  ('51351002','142902'),
  ('51351003','142902'),
  ('51351005','142909'),
  ('51351008','142915'),
  ('51351009','142901'),
  ('51351011','200217'),
  ('51351013','142902'),
  ('51371004','340909'),
  ('51371005','141901'),
  ('51371007','141901'),
  ('51391001','200200'),
  ('52411011','200905'),   -- Traslado de pacientes
  ('52411024','200905'),
  -- Servicios generales (cuentas SAI 42*, de la hoja "generales" - no están en dispo)
  ('42060422','200207'),
  ('42061101','141901'),
  ('42061102','140200'),
  ('42061105','142902'),
  ('42061309','200912'),
  ('42061404','200217'),
  ('42062421','200200'),
  ('42062422','200223'),
  ('42062423','200217')
) as v(cuenta, cc)
where p.centro_costo is null
  and (coalesce(p.cuenta_prei,'') = v.cuenta or coalesce(p.cuenta_finat,'') = v.cuenta);

-- Verificación: cuentas usadas por contratos y su CC. No debe quedar ninguna en NULL.
select coalesce(p.cuenta_finat, p.cuenta_prei) as cuenta, p.nombre, p.centro_costo,
       count(c.id) as contratos
from partidas p
left join contratos c on c.partida_id = p.id
group by p.id, p.cuenta_finat, p.cuenta_prei, p.nombre, p.centro_costo
having count(c.id) > 0
order by p.centro_costo nulls first, cuenta;
