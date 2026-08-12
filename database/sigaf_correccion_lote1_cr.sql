-- =====================================================================
-- SIGAF · Corrección Lote 1 — 5 facturas con cr + fecha de pago (Excel)
-- pero que quedaron 'en_revision' porque su columna de texto "estatus"
-- estaba vacía. Se pasan a 'gasto_reflejado' con la fecha de pago del
-- Excel. comprobante_ooad se deja NULL (no verificado por OOAD); el cr
-- del Excel va en el comentario del historial, marcado como sin verificar.
-- =====================================================================

-- PRE-CHECK (correr ANTES, standalone). Esperado: 5 filas, todas con
-- estatus_general='en_revision', comprobante_ooad NULL, hist general='en_revision'.
select f.folio_ingreso, f.folio_proveedor, f.estatus_general, f.comprobante_ooad,
       h.estatus as hist_general, h.fecha::date as hist_fecha, h.comentario
from facturas f
join factura_estatus_historial h on h.factura_id = f.id and h.circuito = 'general'
where f.folio_ingreso in ('HGZ2-INT-HIST-015', 'HGZ2-INT-HIST-016', 'HGZ2-INT-HIST-017', 'HGZ2-INT-HIST-018', 'HGZ2-INT-HIST-019')
order by f.folio_ingreso;

-- =====================================================================
begin;

alter table facturas disable trigger trg_a_historial;  -- evita renglón auto con fecha de hoy

-- 1) estatus_general -> gasto_reflejado (solo estas 5)
update facturas set estatus_general = 'gasto_reflejado'
where folio_ingreso in ('HGZ2-INT-HIST-015', 'HGZ2-INT-HIST-016', 'HGZ2-INT-HIST-017', 'HGZ2-INT-HIST-018', 'HGZ2-INT-HIST-019')
  and estatus_general = 'en_revision';  -- guarda de seguridad: no tocar si ya cambió

-- 2) Editar el renglón de historial 'general' existente: nuevo estatus,
--    fecha de pago del Excel y comentario con el cr (conservando el periodo).
update factura_estatus_historial h
set estatus = 'gasto_reflejado',
    fecha = v.fecha_pago::timestamptz,
    comentario = coalesce(h.comentario || ' · ', '')
      || 'Comprobante del Excel histórico (cr=' || v.cr || '): sin verificar contra reporte de OOAD'
from (values
  ('HGZ2-INT-HIST-015', 'EF577462', '2026-05-05'::date, '458862'),
  ('HGZ2-INT-HIST-016', 'EF580013', '2026-05-05'::date, '458864'),
  ('HGZ2-INT-HIST-017', 'EF581417', '2026-05-19'::date, '460209'),
  ('HGZ2-INT-HIST-018', 'EF583228', '2026-06-23'::date, '463320'),
  ('HGZ2-INT-HIST-019', 'EF585498', '2026-07-28'::date, '466513')
) as v(folio_ingreso, folio_proveedor, fecha_pago, cr)
join facturas f on f.folio_ingreso = v.folio_ingreso and f.folio_proveedor = v.folio_proveedor
where h.factura_id = f.id and h.circuito = 'general' and h.estatus = 'en_revision';
-- (el paso 1 cambio facturas.estatus_general; el renglon de historial general
--  sigue en 'en_revision' hasta aqui, por eso lo filtramos por ese valor.)

alter table facturas enable trigger trg_a_historial;

-- POST-CHECK (antes de commit). Esperado: 5, todas gasto_reflejado, comprobante_ooad NULL,
-- hist general con la fecha de pago y el comentario del cr.
--   select f.folio_ingreso, f.estatus_general, f.comprobante_ooad, h.estatus, h.fecha::date, h.comentario
--   from facturas f join factura_estatus_historial h on h.factura_id=f.id and h.circuito='general'
--   where f.folio_ingreso in ('HGZ2-INT-HIST-015', 'HGZ2-INT-HIST-016', 'HGZ2-INT-HIST-017', 'HGZ2-INT-HIST-018', 'HGZ2-INT-HIST-019') order by 1;
-- Si algo no cuadra: rollback;   (si todo bien:)  commit;
commit;
