-- =====================================================================
-- SIGAF · Fase 3 (final) — Encender TODAS las cuentas de Integrales
-- =====================================================================
-- UN solo bloque, idempotente y seguro:
--   A) pobla cuenta_finat en las partidas (para enlazar con su presupuesto)
--   B) carga la disponibilidad (dispo/FINAT) de las 8 cuentas de Integrales
-- Datos tomados del reporte dispo. Tras correrlo, /disponibilidad muestra
-- las 8 cuentas con Presupuesto, Gasto, Pasivo y Disponible.
-- =====================================================================
begin;

-- A) cuenta_finat en las partidas (solo si está null; resuelve vía contrato existente)
update partidas p
set cuenta_finat = v.cuenta
from (values
  ('050GYR988T00925-001-00', '51251012'),
  ('050GYR032N03825-055-00', '51331013'),
  ('050GYR032N13825-182-00', '51331014'),
  ('050GYR032N02926-051-00', '51331015'),
  ('050GYR032N12326-005-00', '51331017'),
  ('050GYR032N13625-179-00', '51331020'),
  ('050GYR032N14425-188-00', '51331024')
) as v(numero_interno, cuenta)
join contratos c on c.numero_interno = v.numero_interno
where p.id = c.partida_id and p.cuenta_finat is null;

-- B) Disponibilidad FINAT (del dispo) para las 8 cuentas de Integrales
insert into disponibilidad_presupuestal (cuenta_prei, periodo, presupuesto, gasto, comprometido, precomprometido, disponible)
values
  ('51251012','2026',  6131388.00,  5371235.62, 0,       0.00,  760152.38),
  ('51251013','2026',  6366196.00,  1824055.78, 0,  234347.00, 4307793.22),
  ('51331013','2026', 37677928.00, 15216267.91, 0,       0.00, 22461660.09),
  ('51331014','2026', 19638070.00, 11000901.76, 0,       0.00, 8637168.24),
  ('51331015','2026',  9324293.00,  4926734.60, 0,       0.00, 4397558.40),
  ('51331017','2026',  4887386.00,  3066730.28, 0,       0.00, 1820655.72),
  ('51331020','2026',  2349295.00,   917742.23, 0,  116436.00, 1315116.77),
  ('51331024','2026',   476894.00,   352079.72, 0,       0.00,  124814.28)
on conflict (cuenta_prei, periodo) do update set
  presupuesto=excluded.presupuesto, gasto=excluded.gasto, comprometido=excluded.comprometido,
  precomprometido=excluded.precomprometido, disponible=excluded.disponible, actualizado_at=now();

commit;
