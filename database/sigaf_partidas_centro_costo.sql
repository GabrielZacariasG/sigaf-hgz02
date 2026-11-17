-- =====================================================================
-- SIGAF · Centro de costos por CUENTA (codificación en toda factura)
-- ---------------------------------------------------------------------
-- Hasta hoy el centro de costos (CC) solo salía de la clave de cuadro
-- básico (Compra Emergente). La cédula muestra que el CC va pegado a la
-- CUENTA (relación 1:1). Se guarda en partidas.centro_costo y se muestra
-- al capturar cualquier factura; editable en Catálogos → Cuentas.
--
-- PASO 1: columna nueva.
-- PASO 2: pre-carga con el mapeo cuenta->CC extraído de la cédula
--         (00 Cedula Gasto 2026 RESPALDO · hojas por área + cb).
--         Solo rellena las que están vacías (no pisa lo editado a mano).
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

alter table partidas add column if not exists centro_costo text;

-- Mapeo cuenta (PREI/FINAT) -> centro de costos, tomado de la cédula.
update partidas p set centro_costo = v.cc
from (values
  -- Cuadro básico / Compra emergente (hoja cb)
  ('51211010','200217'),
  ('51251002','200223'),
  ('51251003','200223'),
  ('51251005','200223'),
  ('51251007','200223'),
  ('51251017','200217'),
  ('51251020','200217'),
  ('51251021','200217'),
  ('51251022','200205'),
  ('51251023','200207'),
  ('51251024','200205'),
  ('51291007','200217'),
  -- Integrales / Área médica (encabezados de bloque de la cédula)
  ('51251012','200217'),
  ('51251013','200217'),
  ('51321003','200217'),
  ('51331002','200227'),
  ('51331013','200205'),
  ('51331014','200227'),
  ('51331015','200219'),
  ('51331020','200223'),
  ('51331024','200263'),
  -- Servicios generales (cuenta SAI de la hoja generales)
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

-- Verificación: cuentas usadas por contratos y su CC (las vacías se capturan en Catálogos).
select coalesce(p.cuenta_finat, p.cuenta_prei) as cuenta, p.nombre, p.centro_costo,
       count(c.id) as contratos
from partidas p
left join contratos c on c.partida_id = p.id
group by p.id, p.cuenta_finat, p.cuenta_prei, p.nombre, p.centro_costo
having count(c.id) > 0
order by p.centro_costo nulls first, cuenta;
