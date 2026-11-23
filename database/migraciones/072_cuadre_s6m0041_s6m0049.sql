-- =====================================================================
-- SIGAF · 072 · Cuadre de Labopath (S6M0041) y SIMSA (S6M0049) con el análisis del 23/11/2026
-- Fecha: 23/11/2026
-- Qué hace:
--   1) Folios de subrogados duplicados que inflaban el devengo → cancelado = true (no se borran):
--      · S6M0049 folio 482/2026 ($5,090.01, 09/10, Mandujano): copia del 1482, ya va en la factura 33002994.
--      · S6M0041 folios 2467 y 2870, renglón de $1,160.00 cada uno: copia vieja del mismo folio, que ya está
--        con su importe completo ($11,600.00 y $9,280.00).
--   2) Apoyos de S6M0049 (dictamen 0000137444-2026):
--      · Se borran los dos apoyos de $30,000.00 "sin estudio" del Excel de la jefa.
--      · En su lugar se registran las facturas de SIMSA del HGZ 3 que FINAT pagó con UI 010102 (1043 histórico):
--          CR 00460956 (MAR) 33002783-2784-2788-2800  $9,237.36  pagado 28/05/2026
--          CR 00460987 (MAR) 33002786 33002785        $3,393.34  pagado 28/05/2026
--          CR 00469217 (MAR) 33002839-840-841-842     $13,981.42 pagado 26/08/2026
--          CR 00469203 (MAR) 33002843-844-846-857     $16,966.73 pagado 26/08/2026
--      · El apoyo de $1,218.00 al HGZ 3 (ventilador de traslado) es la factura 33002858, CR 00468800, pagada 19/08/2026:
--        se le pone factura y fecha real.
--      · El apoyo de $1,218.00 al HGZ 1 no aparece pagado con recurso del HGZ 2: regresa a devengo (pendiente).
--      Con esto los apoyos al HGZ 3 suman $44,796.85 = pagos del dictamen del HGZ 2 en mayo ($12,630.70) y agosto ($32,166.15).
-- Resultado esperado en Contratos:
--   S6M0041: devengo $26,100.00 · saldo −$77,343.64
--   S6M0049: facturado $276,326.45 · devengo $55,032.77 · saldo $48,640.78
-- Marca [CUADRE-23NOV]: correrlo dos veces no duplica ni vuelve a borrar.
-- Cómo: SQL Editor de Supabase → Run. Al final muestra cómo quedaron los folios y los apoyos.
-- =====================================================================

-- 1) Folios duplicados → cancelados
update subrogados_folios f
   set cancelado = true,
       motivo = 'Duplicado: copia del folio 1482/2026 (factura 33002994) [CUADRE-23NOV]',
       actualizado_at = now()
  from contratos c
 where f.contrato_id = c.id and c.numero_interno = 'S6M0049'
   and f.folio = '482/2026' and f.importe = 5090.01
   and f.factura_id is null and f.factura_txt is null and not f.cancelado;

update subrogados_folios f
   set cancelado = true,
       motivo = 'Duplicado: renglón viejo de $1,160 del mismo folio (el importe completo está en otro renglón) [CUADRE-23NOV]',
       actualizado_at = now()
  from contratos c
 where f.contrato_id = c.id and c.numero_interno = 'S6M0041'
   and f.folio in ('2467', '2870') and f.importe = 1160
   and f.factura_id is null and f.factura_txt is null and not f.cancelado;

-- 2) Apoyos de S6M0049
delete from contrato_apoyos a
 using contratos c
 where a.contrato_id = c.id and c.numero_interno = 'S6M0049'
   and a.dictamen = '0000137444-2026' and a.ui_destino = '010103'
   and a.importe = 30000 and a.nota like '%APOYOS-EXCEL-13NOV%';

update contrato_apoyos a
   set factura_txt = '(JUN) 33002858', fecha = date '2026-08-19', fecha_gasto = date '2026-08-19',
       nota = a.nota || ' · CR 00468800 pagado 19/08/2026 [CUADRE-23NOV]'
  from contratos c
 where a.contrato_id = c.id and c.numero_interno = 'S6M0049'
   and a.dictamen = '0000137444-2026' and a.ui_destino = '010103'
   and a.importe = 1218 and a.nota like '%APOYOS-EXCEL-13NOV #2%' and a.nota not like '%CUADRE-23NOV%';

update contrato_apoyos a
   set estado = 'devengo', fecha_gasto = null,
       nota = a.nota || ' · no aparece pagado con UI 010102: queda pendiente [CUADRE-23NOV]'
  from contratos c
 where a.contrato_id = c.id and c.numero_interno = 'S6M0049'
   and a.dictamen = '0000137444-2026' and a.ui_destino = '010101'
   and a.importe = 1218 and a.nota not like '%CUADRE-23NOV%';

insert into contrato_apoyos (contrato_id, dictamen, ui_destino, factura_txt, importe, fecha, estado, fecha_gasto, nota)
select c.id, '0000137444-2026', '010103', v.factura_txt, v.importe, v.fecha, 'gasto', v.fecha,
       'Factura de SIMSA del HGZ 3 pagada con UI 010102 (1043) [CUADRE-23NOV CR ' || v.cr || ']'
  from contratos c
 cross join (values
   ('(MAR) 33002783-2784-2788-2800', 9237.36::numeric,  date '2026-05-28', '00460956'),
   ('(MAR) 33002786 33002785',       3393.34::numeric,  date '2026-05-28', '00460987'),
   ('(MAR) 33002839-840-841-842',    13981.42::numeric, date '2026-08-26', '00469217'),
   ('(MAR) 33002843-844-846-857',    16966.73::numeric, date '2026-08-26', '00469203')
 ) as v(factura_txt, importe, fecha, cr)
 where c.numero_interno = 'S6M0049'
   and not exists (select 1 from contrato_apoyos x where x.nota like '%CUADRE-23NOV CR ' || v.cr || ']%');

-- Revisión
select 'folio' as que, c.numero_interno, f.folio, f.fecha::text, f.importe, case when f.cancelado then 'cancelado' when f.factura_id is not null or f.factura_txt is not null then 'facturado' else 'devengo' end as estado, f.origen || ' · ' || coalesce(f.motivo, '') as nota
  from subrogados_folios f join contratos c on c.id = f.contrato_id
 where c.numero_interno in ('S6M0041', 'S6M0049') and (f.motivo like '%CUADRE-23NOV%' or (f.factura_id is null and f.factura_txt is null and not f.cancelado))
union all
select 'apoyo', c.numero_interno, a.ui_destino, coalesce(a.fecha_gasto, a.fecha)::text, a.importe, a.estado, coalesce(a.factura_txt, '') || ' · ' || coalesce(a.nota, '')
  from contrato_apoyos a join contratos c on c.id = a.contrato_id
 where c.numero_interno = 'S6M0049'
 order by 1, 2, 4;
-- Debe dar: devengo S6M0041 = 2467 $11,600 + 2870 $9,280 + 1441/2026 $5,220 = $26,100;
-- devengo S6M0049 = 1916, 1444, 1445, 1552, 1578, 1551 = $53,814.77 (los renglones cd_sms con el mismo folio
--   que uno del Avance no cuentan: SIGAF los ignora);
-- apoyos S6M0049: HGZ 3 en gasto = $44,796.85 (5 renglones) y HGZ 1 $1,218 en devengo.
