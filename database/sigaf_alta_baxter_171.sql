-- =====================================================================
-- SIGAF · Alta del contrato 050GYR032N10326-171-00 (Integrales)
-- BAXTER S.A. DE C.V. — Servicio de Diálisis Peritoneal Automatizada (DPA)
-- para PACIENTES NUEVOS. Adjudicación directa nacional electrónica
-- AA-50-GYR-050GYR032-N-103-2026 (notificación "NOT N103").
--   Cuenta: 51251012 · Mín $331,407.60 · Máx $828,519.00 · IVA 0%
--   Concepto único: DPA pacientes nuevos (soluciones 2350 al 1.5%, 2353 al 2.5%,
--   2355 al 4.25%, DIANEAL, Baxter, México) = $171.24 por bolsa.
--   Unidades del evento: HGZ No. 1, HGZ No. 2 y HGZ No. 3.
--
-- *** BORRADOR: NO CORRER TODAVÍA ***
-- Falta confirmar (y escribir abajo donde dice POR_CONFIRMAR):
--   1) Vigencia inicio y fin (viene en el contrato, no en la notificación).
--   2) Administrador del contrato (en los otros DPA es la Dra. María Josefina Rodal Díaz).
--   3) Si el mínimo/máximo de la notificación es del evento completo (HGZ 1, 2 y 3)
--      o solo de HGZ 2. En SIGAF se guarda el que corresponda a HGZ 2.
-- Idempotente. Correr en SQL Editor una vez completo.
-- =====================================================================

begin;

-- 1) Contrato (proveedor y partida se toman del contrato DPA NUEVOS vigente 050GYR988T00925-001-00, también de BAXTER y cuenta 51251012)
insert into contratos (numero_interno, proveedor_id, partida_id, administrador_contrato,
                       adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo, monto_maximo)
select '050GYR032N10326-171-00',
       (select proveedor_id from contratos where numero_interno = '050GYR988T00925-001-00' limit 1),
       (select partida_id   from contratos where numero_interno = '050GYR988T00925-001-00' limit 1),
       'POR_CONFIRMAR administrador',
       'Diálisis Peritoneal Automatizada (DPA) NUEVOS — AA-50-GYR-050GYR032-N-103-2026',
       date 'POR_CONFIRMAR-inicio', date 'POR_CONFIRMAR-fin', 331407.60, 828519.00
where not exists (select 1 from contratos where numero_interno = '050GYR032N10326-171-00');

-- 2) Concepto único ($171.24 por bolsa, IVA 0%)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id,
       'DIÁLISIS PERITONEAL AUTOMATIZADA PARA PACIENTES NUEVOS (SOLUCIÓN PARA DIÁLISIS PERITONEAL AL 1.5%, 2.5% Y 4.25%)',
       171.24, 1
from contratos c
where c.numero_interno = '050GYR032N10326-171-00'
  and not exists (
    select 1 from contrato_servicios cs
    where cs.contrato_id = c.id and cs.nombre_servicio like 'DIÁLISIS PERITONEAL AUTOMATIZADA%'
  );

-- 3) Verificación
select c.numero_interno, p.razon_social, pa.cuenta_finat, pa.cuenta_prei, ca.nombre as capitulo,
       c.vigencia_inicio, c.vigencia_fin,
       to_char(c.monto_minimo,'FM999,999,999.00') as min, to_char(c.monto_maximo,'FM999,999,999.00') as max,
       (select count(*) from contrato_servicios cs where cs.contrato_id = c.id) as conceptos,
       (select precio_unitario from contrato_servicios cs where cs.contrato_id = c.id limit 1) as precio
from contratos c
join proveedores p on p.id = c.proveedor_id
join partidas pa on pa.id = c.partida_id
join capitulos ca on ca.id = pa.capitulo_id
where c.numero_interno = '050GYR032N10326-171-00';

commit;
