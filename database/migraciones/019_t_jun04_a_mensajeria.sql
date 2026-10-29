-- =====================================================================
-- SIGAF · Corrección · 019 · "T JUN 04 - 15/2026" de traslados (52411011) a Mensajería (51371004)
-- Fecha: 29/10/2026 · Aprobado por Gabriel
-- En el sistema el CR 00465766 es "O JUN 04 - CD066/2026", $3,050.06, cuenta 51371004 Mensajería
-- (fondo fijo de Nayeli Alonso). SIGAF la tenía como traslado en el contrato PERNOCTA.
-- Si SIGAF no tiene la partida 51371004, se crea (mismo capítulo que traslados) junto con un contrato marco
-- "FF-MENSAJERIA" a nombre de Nayeli Alonso, igual que PERNOCTA y PERNOCTA-REEMB.
-- SEGURO: solo mueve la factura si sigue en 52411011 con ese CR.
-- Cómo: SQL Editor de Supabase → Run. Al final: 52411011 = 2,360,139.63 (= sistema) y la factura en 51371004.
-- =====================================================================
begin;

insert into partidas (capitulo_id, cuenta_finat, nombre)
select (select capitulo_id from partidas where cuenta_finat = '52411011' limit 1), '51371004', 'Mensajería'
where not exists (select 1 from partidas where cuenta_finat = '51371004');

insert into contratos (numero_interno, proveedor_id, partida_id, adquisicion_servicio, vigencia_inicio, vigencia_fin)
select 'FF-MENSAJERIA',
       (select proveedor_id from contratos where numero_interno = 'PERNOCTA' limit 1),
       (select id from partidas where cuenta_finat = '51371004' limit 1),
       'Mensajería pagada por fondo fijo',
       date '2026-01-01', date '2026-12-31'
where not exists (select 1 from contratos where numero_interno = 'FF-MENSAJERIA');

update facturas f set
  folio_proveedor = 'O JUN 04 - CD066/2026',
  capitulo_id     = pa.capitulo_id,
  partida_id      = c.partida_id,
  contrato_id     = c.id,
  cr_contrarecibo = '00465766'
from contratos c
join partidas pa on pa.id = c.partida_id
where c.numero_interno = 'FF-MENSAJERIA'
  and f.folio_ingreso = 'HGZ2-SS-HIST-000016'
  and f.cr_contrarecibo in ('465766','00465766') and f.anulada = false
  and (select p2.cuenta_finat from partidas p2 where p2.id = f.partida_id) = '52411011';

commit;

-- Verificación
select pa.cuenta_finat, count(f.id) as facturas, sum(f.importe_factura) as importe
from facturas f join partidas pa on pa.id = f.partida_id
where pa.cuenta_finat in ('52411011','51371004') and f.anulada = false and f.estatus_general <> 'devuelta_proveedor'
group by pa.cuenta_finat order by 1;
