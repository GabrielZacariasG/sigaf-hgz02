-- =====================================================================
-- SIGAF · 074 · Apoyos RECIBIDOS + cuadre de S6M0048, S6M0016, S6M0042 y S6M0003
-- Fecha: 23/11/2026
-- 1) contrato_apoyos.tipo: 'dado' (lo de siempre: el HGZ 2 paga facturas de otra unidad) o 'recibido' (otra unidad
--    pagó con su recurso parte de una factura del HGZ 2: el CR se repartió en FINAT). En un recibido, ui_destino es la
--    unidad que pagó. SIGAF lo resta del gasto y de los pagos del HGZ 2 en el contrato y NO lo descuenta del dictamen.
--    Correr ANTES de publicar el código nuevo (el código pide la columna tipo).
-- 2) Apoyos recibidos según el 1043 (diagnóstico 073):
--      S6M0048 CR 00472705 (JUL) 86048-86047-86179 · HGZ 3 $158,622.43 · pagado 30/09/2026
--      S6M0016 CR 00456015 3251                    · HGZ 1 $10,085.74 + HGZ 3 $23,907.60 · pagado 06/04/2026
--      S6M0042 CR 00467794 4228                    · HGZ 1 $23,409.82 · pagado 06/08/2026
--      S6M0003 CR 00462946 2522                    · HGZ 1 $320.15 + HGZ 3 $6,185.21 · pagado 17/06/2026
-- 3) S6M0042, apoyos DADOS: se borra el apoyo del Excel de la jefa ($9,222, sin factura) y se registran las facturas
--    que FINAT pagó con UI 010102 (glosador CRODRIGUEZO01 = HGZ 3):
--      CR 00468025 (JUN) 4229 $12,180.00 pagado 10/08/2026 · CR 00473294 (AGO) 4280 $2,900.00 pagado 08/10/2026
-- Resultado esperado (saldo del contrato = disponible del dictamen en FINAT):
--   S6M0048 saldo $6,154.00 · S6M0016 saldo $0.00 · S6M0003 saldo $0.00
--   S6M0042 gasto facturado $310,825.10 (= pagos de FINAT); saldo $6,194.04 menos el devengo de $3,364.00 = $2,830.04
-- Marca [CUADRE-074 CR ...]: correrlo dos veces no duplica.
-- =====================================================================
alter table contrato_apoyos add column if not exists tipo text not null default 'dado';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contrato_apoyos_tipo_chk') then
    alter table contrato_apoyos add constraint contrato_apoyos_tipo_chk check (tipo in ('dado', 'recibido'));
  end if;
end $$;

-- 2) Recibidos
insert into contrato_apoyos (contrato_id, dictamen, ui_destino, factura_txt, importe, fecha, estado, fecha_gasto, nota, tipo)
select c.id, v.dictamen, v.ui, v.factura_txt, v.importe, v.fecha, 'gasto', v.fecha,
       'Apoyo recibido: la UI ' || v.ui || ' pagó esta parte del CR (1043) [CUADRE-074 CR ' || v.cr || ' ' || v.ui || ']', 'recibido'
  from (values
    ('S6M0048', '0000155458-2026', '010103', '(JUL) 86048-86047-86179', 158622.43::numeric, date '2026-09-30', '00472705'),
    ('S6M0016', '0000118610-2026', '010101', '3251',                     10085.74::numeric, date '2026-04-06', '00456015'),
    ('S6M0016', '0000118610-2026', '010103', '3251',                     23907.60::numeric, date '2026-04-06', '00456015'),
    ('S6M0042', '0000137441-2026', '010101', '4228',                     23409.82::numeric, date '2026-08-06', '00467794'),
    ('S6M0003', '0000115663-2026', '010101', '2522',                       320.15::numeric, date '2026-06-17', '00462946'),
    ('S6M0003', '0000115663-2026', '010103', '2522',                      6185.21::numeric, date '2026-06-17', '00462946')
  ) as v(cto, dictamen, ui, factura_txt, importe, fecha, cr)
  join contratos c on c.numero_interno = v.cto
 where not exists (select 1 from contrato_apoyos x where x.nota like '%[CUADRE-074 CR ' || v.cr || ' ' || v.ui || ']%');

-- 3) S6M0042: apoyos dados reales en lugar del del Excel
delete from contrato_apoyos a
 using contratos c
 where a.contrato_id = c.id and c.numero_interno = 'S6M0042'
   and a.tipo = 'dado' and a.importe in (6380, 2842) and a.nota like '%APOYOS-EXCEL-13NOV%';
-- (El $9,222 del Excel estaba en dos renglones: KAJ-2 $6,380 #1 y tamiz $2,842 #5.)

insert into contrato_apoyos (contrato_id, dictamen, ui_destino, factura_txt, importe, fecha, estado, fecha_gasto, nota, tipo)
select c.id, '0000137441-2026', '010103', v.factura_txt, v.importe, v.fecha, 'gasto', v.fecha,
       'Factura del HGZ 3 pagada con UI 010102 (1043) [CUADRE-074 CR ' || v.cr || ' 010103]', 'dado'
  from (values
    ('(JUN) 4229', 12180.00::numeric, date '2026-08-10', '00468025'),
    ('(AGO) 4280',  2900.00::numeric, date '2026-10-08', '00473294')
  ) as v(factura_txt, importe, fecha, cr)
  join contratos c on c.numero_interno = 'S6M0042'
 where not exists (select 1 from contrato_apoyos x where x.nota like '%[CUADRE-074 CR ' || v.cr || ' 010103]%');

-- Revisión
select c.numero_interno, a.tipo, a.estado, a.ui_destino, a.importe, coalesce(a.fecha_gasto, a.fecha) as fecha, a.factura_txt, a.nota
  from contrato_apoyos a join contratos c on c.id = a.contrato_id
 where c.numero_interno in ('S6M0048', 'S6M0016', 'S6M0042', 'S6M0003')
 order by 1, 2, 6;
