-- =====================================================================
-- SIGAF · Alta del contrato 050GYR032T07726-135-00 (Osteosíntesis 2026)
--   BIODIST, S.A. de C.V. · adjudicación directa internacional AA-50-GYR-050GYR032-T-77-2026
--   Objeto: Adquisición de material de OSTEOSÍNTESIS Y ENDOPRÓTESIS, con dotación
--     de instrumental, capacitación y apoyo técnico.
--   Partida: cuenta_finat 51251019 (Osteosíntesis y Endoprótesis, Área Médica) — ya existe.
--   Administrador del contrato: Dra. María Josefina Rodal Díaz (Coord. de Gestión Médica).
--   Vigencia: 08/agosto/2026 – 31/diciembre/2026.
--   Montos (totales con IVA, según tabla del contrato):
--     mín $5,653,072.84 (subtotal 4,873,338.66 + IVA 779,734.18)
--     máx $14,132,682.10 (subtotal 12,183,346.64 + IVA 1,949,335.46)
--   5 partidas, cientos de renglones de implantes por clave (no se carga lista de
--   conceptos, igual que los demás contratos de osteosíntesis: se factura por clave).
-- Datos tomados del contrato PDF. Idempotente. Correr en el SQL Editor.
-- =====================================================================
begin;

-- 1) Proveedor (ya existe; se reutiliza)
insert into proveedores (razon_social)
select 'BIODIST, S.A. de C.V.'
where not exists (select 1 from proveedores where razon_social = 'BIODIST, S.A. de C.V.');

-- 2) Partida cuenta 51251019 (Osteosíntesis y Endoprótesis, Área Médica) — ya existe
insert into partidas (capitulo_id, cuenta_finat, nombre)
select (select id from capitulos where nombre = 'Área Médica'),
       '51251019', 'Osteosíntesis y Endoprótesis'
where not exists (select 1 from partidas where cuenta_finat = '51251019');

-- 3) Contrato (solo encabezado — sin lista de conceptos, como los demás de osteosíntesis)
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato,
                       adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo, comentarios)
select '050GYR032T07726-135-00',
       (select id from proveedores where razon_social = 'BIODIST, S.A. de C.V.' limit 1),
       (select id from partidas where cuenta_finat = '51251019' limit 1),
       'Dra. María Josefina Rodal Díaz',
       'Adquisición de material de osteosíntesis y endoprótesis (instrumental, capacitación y apoyo técnico)',
       '2026-08-08'::date, '2026-12-31'::date, 5653072.84, 14132682.10,
       'Adjudicación directa internacional AA-50-GYR-050GYR032-T-77-2026. Cuenta 51251019. Subtotales: min 4,873,338.66 / max 12,183,346.64 (+IVA). 5 partidas de implantes.'
where not exists (select 1 from contratos where numero_interno = '050GYR032T07726-135-00');

-- 4) Verificación
select ct.numero_interno, p.razon_social, pa.cuenta_finat, ca.nombre as capitulo,
       ct.administrador_contrato, ct.vigencia_inicio, ct.vigencia_fin,
       to_char(ct.monto_minimo,'FM999,999,999.00') as min,
       to_char(ct.monto_maximo,'FM999,999,999.00') as max
from   contratos ct
join   proveedores p on p.id = ct.proveedor_id
join   partidas pa   on pa.id = ct.partida_id
join   capitulos ca  on ca.id = pa.capitulo_id
where  ct.numero_interno = '050GYR032T07726-135-00';

commit;
