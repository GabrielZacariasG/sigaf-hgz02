-- =====================================================================
-- SIGAF · Alta del contrato 050GYR032N10426-169-00 (SAI S6M0112)
-- AUTOBUSES DE LA PIEDAD, S.A. DE C.V. — Traslado de derechohabientes en autobús.
-- Adjudicación directa AA-50-GYR032-N-104-2026, notificación del 23/10/2026.
--   Vigencia: 24/10/2026 al 31/12/2026 (cláusula SEXTA).
--   Contrato completo (HGZ 1, 2 y 3): mín $620,689.24 y máx $1,551,724.14 más IVA
--   = $1,800,000.00 con IVA.
--   Dictamen 0000505827-2026, cuenta 52411011: HGZ 1 $700,000 · HGZ 2 $600,000 · HGZ 3 $500,000.
--   Se guarda lo de HGZ 2: máximo $600,000.
--   Administradora: Dra. Hilda Mónica López Cervantes.
--   Precios antes de IVA (cláusula SEGUNDA): León 312.14, Guadalajara 530.85, CDMX 878.48,
--   Monterrey 1,169.23, San Luis Potosí 325.58.
-- Proveedor y partida se toman del contrato anterior S6M0030 (mismo proveedor, cuenta 52411011).
-- Idempotente: se puede correr dos veces sin duplicar.
-- NO toca el S6M0030 (su vigencia en SIGAF sigue al 31/12).
-- =====================================================================

begin;

-- 1) Contrato
insert into contratos (numero_interno, numero_alterno, proveedor_id, partida_id, administrador_contrato,
                       adquisicion_servicio, concepto, vigencia_inicio, vigencia_fin,
                       monto_minimo, monto_maximo, importe_maximo_contrato,
                       dictamen_numero, dictamen_tipo, tope_ampliacion_pct)
select 'S6M0112', '050GYR032N10426-169-00', a.proveedor_id, a.partida_id, a.administrador_contrato,
       a.adquisicion_servicio, a.concepto, date '2026-10-24', date '2026-12-31',
       null, 600000.00, 1800000.00,
       '0000505827-2026', 'DEF', 20
from contratos a
where a.numero_interno = 'S6M0030'
  and not exists (select 1 from contratos where numero_interno = 'S6M0112');

-- 2) Destinos y precios (antes de IVA), con los mismos nombres que el S6M0030
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id, v.nombre, v.precio, v.orden
from contratos c
cross join (values
  ('AGUASCALIENTES LEÓN, GTO AGUASCALIENTES 8340',       312.14, 1),
  ('AGUASCALIENTES GUADALAJARA AGUASCALIENTES',          530.85, 2),
  ('AGUASCALIENTES CD. DE MEXICO AGUASCALIENTES',        878.48, 3),
  ('AGUASCALIENTES MONTERREY AGUASCALIENTES',           1169.23, 4),
  ('AGUASCALIENTES SAN LUIS POTOSÍ AGUASCALIENTES',      325.58, 5)
) as v(nombre, precio, orden)
where c.numero_interno = 'S6M0112'
on conflict (contrato_id, nombre_servicio) do nothing;

-- 3) Liga con su dictamen
insert into contrato_dictamenes (contrato_id, dictamen, tipo, nota)
select c.id, '0000505827-2026', 'principal', 'Dictamen del contrato (contratos.dictamen_numero)'
from contratos c
where c.numero_interno = 'S6M0112'
on conflict (contrato_id, dictamen) do nothing;

-- 4) Verificación: debe salir 1 renglón, 5 destinos y asignado HGZ 2 = 600,000
select c.numero_interno, c.numero_alterno, p.razon_social, pa.cuenta_finat,
       c.vigencia_inicio, c.vigencia_fin,
       to_char(c.monto_maximo,'FM999,999,999.00') as max_hgz2,
       to_char(c.importe_maximo_contrato,'FM999,999,999.00') as max_contrato,
       c.dictamen_numero,
       (select count(*) from contrato_servicios cs where cs.contrato_id = c.id) as destinos,
       (select sum(s.definitivo) from dictamen_saldos s where s.dictamen = c.dictamen_numero and s.ui = '010102') as asignado_dictamen_hgz2
from contratos c
join proveedores p on p.id = c.proveedor_id
join partidas pa on pa.id = c.partida_id
where c.numero_interno = 'S6M0112';

commit;
