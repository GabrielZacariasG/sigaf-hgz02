-- =====================================================================
-- SIGAF · Fase 3 · 046 · Carga inicial de contratos desde la cédula (hojas "area médica", "subrogados", "linea am", "lin sub")
-- Fecha: 30/10/2026 · Correr DESPUÉS del 045
-- Toma de la cédula lo que NO viene en ningún reporte del sistema:
--   · concepto, dictamen (número y tipo), importe máximo del contrato (delegacional), número alterno (SAI ↔ PO)
--     y el máximo de la UNIDAD solo si SIGAF no lo tenía
--   · ampliaciones (AMP O RED) vigentes: D6M0032, D6M0033, D6M0034, Biodist 00126, S6M0030 (y S6M0012 si existiera)
--   · renglones sin contrato que apartan presupuesto: desiertas, sin DDP, nueva contratación
--   · lo programado por mes (ESC 1 / AMP) de linea am y lin sub
-- NO se cargan de la cédula: gasto, pagos, pasivo ni devengo (esos salen de las facturas de SIGAF; el devengo
--   se capturará en SIGAF). Lo que la cédula tenía con #REF! o −2,146,826,265 se ignora.
-- Empareja por número de contrato (con o sin guiones) o por el número SAI (D6M…/S6M…).
-- SEGURO: se puede correr dos veces (no duplica ampliaciones, reservas ni programado).
-- Cómo: SQL Editor → Run. Al final lista los renglones de la cédula que NO encontraron contrato en SIGAF.
-- =====================================================================
drop table if exists t_ced;
create temp table t_ced (contrato text, alterno text, concepto text, dictamen text, tipo text, max_contrato numeric, max_unidad numeric, hoja text, fila int);
insert into t_ced values
  ('050GYR032N14025-184-00',null,'Medicina Magistral',null,'PREI',3496.68,3496.68,'area_medica',4),
  ('050GYR032N12025-195-00',null,'Medicina Magistral',null,'PREI',423071,423071,'area_medica',5),
  ('050GYR032N13724-428-00',null,'Medicina Magistral',null,'PREI',null,426567.68,'area_medica',6),
  ('050GYR032T14125-185-00',null,'Aparatos de Ortopedia y Prótesis',null,null,2343814.99,738607,'area_medica',14),
  ('050GYR032T12125-009-00',null,'Aparatos de Ortopedia y Prótesis',null,null,1570938.86,650000,'area_medica',15),
  ('050GYR032T14225-187-00',null,'Osteosíntesis y Endoprotesisis',null,null,18146217.54,5269698.24,'area_medica',24),
  ('050GYR032T00126-016-00',null,'Osteosíntesis y Endoprotesisis',null,null,64336589.46,18487525.71,'area_medica',25),
  ('050GYR032T07726-135-00',null,'Osteosíntesis y Endoprotesisis',null,null,null,4933631.73,'area_medica',26),
  ('050GYR032T08425-098-00',null,'Osteosíntesis y Endoprotesisis',null,null,null,null,'area_medica',28),
  ('050GYR032T14024-434-00',null,'Osteosíntesis y Endoprotesisis',null,null,null,null,'area_medica',29),
  ('050GYR032T14024-433-00',null,'Osteosíntesis y Endoprotesisis',null,null,null,null,'area_medica',30),
  ('050GYR032T00425-002-00',null,'Osteosíntesis y Endoprotesisis',null,null,0,0,'area_medica',31),
  ('050GYR032T10425-121-00',null,'Osteosíntesis y Endoprotesisis',null,null,0,0,'area_medica',32),
  ('050GYR032N13725-180-00','D6M0018','Abarrotes (Grupo 1), Carnes (Grupo 2) Frutas y Verduras (Grupo 3) y Derivados Lacteos (Grupo 4), Varios (Grupo 6)','0000059287-2026','DEF',4700000,1457000,'area_medica',41),
  ('050GYR032N14625-191-00','D6M0019','Leches (Grupo 5)','0000076588-2026','DEF',250000,77500,'area_medica',42),
  ('050GYR032N12525-110-00','D6M0032','Abarrotes (Grupo 1), Carnes (Grupo 2)y Derivados Lacteos (Grupo 4), Varios (Grupo 6)','0000088391-2026','DEF',11532679,3575130.36,'area_medica',43),
  ('050GYR032N12525-012-00','D6M0033','Frutas y Verduras (Grupo 3)','0000094209-2026','DEF',5063206,1675842.36,'area_medica',44),
  ('050GYR032N12525-014-00','D6M0034','Leches (Grupo 5)','0000104077-2026','DEF',843868,279307.06,'area_medica',45),
  ('050GYR032N08426-149-00','D6M0107','Jugos y Concentrados (Grupo 7)','0000322059-2026','PRE',180198.1,55861.41,'area_medica',46),
  ('D5M0013',null,'Abarrotes (Grupo 1), Carnes (Grupo 2) Frutas y Verduras (Grupo 3) y Derivados Lacteos (Grupo 4), Varios (Grupo 6)','0000031654-2025','DEF',null,0,'area_medica',50),
  ('D5M0023',null,'Leches (Grupo 5)','0000047286-2025','DEF',null,0,'area_medica',51),
  ('D5M0024',null,'Jugos y Concentrados (Grupo 7)','0000186562-2025','DISPO',null,0,'area_medica',52),
  ('S6M0022',null,'Gastos x traslado de pacientes','0000097084-2026','DEF',1550000,550000,'subrogados',3),
  ('S6M0030',null,'Gastos x traslado de pacientes','0000097085-2026','DEF',4650000,1650000,'subrogados',4),
  ('S5M0081',null,'Gastos x traslado de pacientes',null,null,null,50000,'subrogados',6),
  ('S5M0081',null,'Gastos x traslado de pacientes',null,null,0,2250000,'subrogados',7),
  ('S6M0010',null,'26 VALORACION OFTALMO  ENE FEB','0000094357-2026','PRE',3333,3333,'subrogados',16),
  ('S6M0046',null,'26 VALORACION OFTALMO  MZO DIC','0000094360-2026','PRE',16667,16667,'subrogados',17),
  ('S5M0007',null,'PASIVO','0000007125-2025','DEF',0,9277.68,'subrogados',18),
  ('S6M0003',null,'1 PRUEBAS PSICOLOGIGAS Y 16 ELECTROENCEFALOGRAMAS','0000115663-2026','DEF',185003,70933.34,'subrogados',30),
  ('S6M0005',null,'2 TAC, RMN,  7 OFTALMO, 11 CPRES,  13 ENDOSCOPIAS, 19 CARDIOLOGIA','0000115659-2026','DEF',2579465,1393875.44,'subrogados',31),
  ('S6M0015',null,'24 FLUOROSCOPIO','0000115681-2026','DEF',51397,51107.25,'subrogados',32),
  ('S6M0016',null,'PARTIDA 14 MEDICINA NUCLEAR','0000118610-2026','DEF',684810,126666.66,'subrogados',33),
  ('S6M0017',null,'9 LABORATORIO','0000115672-2026','DEF',175537,63403.83,'subrogados',34),
  ('S6M0040',null,'15 DOSIMETRIA','0000137439-2026','DEF',303500,57000,'subrogados',35),
  ('S6M0041',null,'17 SERVICIO DE PATOLOGIA','0000175543-2026','DEF',1201482,166666.67,'subrogados',36),
  ('S6M0042',null,'9 LABORATORIO','0000137441-2026','DEF',877686,317019.14,'subrogados',37),
  ('S6M0043',null,'1 PRUEBAS PSICOLOGIGAS Y 16 ELECTROENCEFALOGRAMAS','0000137442-2026','DEF',925013,354666.67,'subrogados',38),
  ('S6M0047',null,'2 TAC, RMN,  7 OFTALMO, 11 CPRES,  13 ENDOSCOPIAS, 19 CARDIOLOGIA','0000155456-2026','DEF',17460008,7602710.52,'subrogados',39),
  ('S6M0049',null,'10 APOYO MECÁNICO VENTILATORIO','0000137444-2026','DEF',516567,475000,'subrogados',40),
  ('S6M0050',null,'24 FLUOROSCOPIO','0000137420-2026','DEF',256986,255536.24,'subrogados',41),
  ('S5M0003',null,null,null,null,null,null,'subrogados',51),
  ('S5M0010',null,null,null,null,null,null,'subrogados',52),
  ('S5M0022',null,null,null,null,null,null,'subrogados',53),
  ('S5M0008',null,null,null,null,null,null,'subrogados',54),
  ('S5M0007',null,null,null,null,null,null,'subrogados',55),
  ('S5M0009',null,null,null,null,null,null,'subrogados',56),
  ('S5M0025',null,null,null,null,null,null,'subrogados',57),
  ('S5M0005',null,null,null,null,null,null,'subrogados',58),
  ('S6M0012',null,null,'0000100779-2026',null,501447,123340.83,'subrogados',67),
  ('S6M0048',null,null,'0000155458-2026',null,3450704,616704.17,'subrogados',68),
  ('S5M0009',null,'Cirugía de Cateterismos (31) Cirugía de Angio (32) Cirugía de Oftalmo (29)','0000041413-2025','DEF',3058640,92800,'subrogados',71),
  ('S7M0163',null,'Serv Del Acuerdo Gral De Inter De Serv','0000123587-2026','DEF',null,2798396,'subrogados',80),
  ('S7M0163',null,'Serv Del Acuerdo Gral De Inter De Serv',null,'DEF',null,0,'subrogados',81)
;

drop table if exists t_match;
create temp table t_match as
select t.*, c.id as contrato_id
from t_ced t
left join lateral (
  select c.id from contratos c
  where upper(regexp_replace(c.numero_interno, '[^A-Za-z0-9]', '', 'g')) in (upper(regexp_replace(t.contrato, '[^A-Za-z0-9]', '', 'g')), upper(regexp_replace(coalesce(t.alterno,'#'), '[^A-Za-z0-9]', '', 'g')))
  order by c.vigencia_fin desc limit 1) c on true;

update contratos c set
  concepto                = coalesce(nullif(c.concepto, ''), m.concepto),
  dictamen_numero         = coalesce(nullif(c.dictamen_numero, ''), m.dictamen),
  dictamen_tipo           = coalesce(nullif(c.dictamen_tipo, ''), m.tipo),
  numero_alterno          = coalesce(nullif(c.numero_alterno, ''),
                              case when upper(c.numero_interno) like 'D_M%' or upper(c.numero_interno) like 'S_M%' then nullif(m.contrato, c.numero_interno)
                                   else nullif(m.alterno, '') end),
  importe_maximo_contrato = coalesce(c.importe_maximo_contrato, nullif(m.max_contrato, 0)),
  monto_maximo            = coalesce(c.monto_maximo, nullif(m.max_unidad, 0))
from t_match m
where m.contrato_id = c.id;

-- Ampliaciones
insert into contrato_ampliaciones (contrato_id, fecha, importe, nota)
select c.id, null, v.importe, 'Carga inicial desde la cédula (AMP O RED, fila ' || v.fila || ') 30/10/2026'
from (values
  ('050GYR032T00126-016-00',3697505.14,25),
  ('D6M0032',715026.07,43),
  ('D6M0033',335168.47,44),
  ('D6M0034',55861.41,45),
  ('S6M0030',310000,4),
  ('S6M0012',20098.97,67)

) v(contrato, importe, fila)
join lateral (select id from contratos c where upper(regexp_replace(c.numero_interno, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(v.contrato, '[^A-Za-z0-9]', '', 'g')) limit 1) c on true
where not exists (select 1 from contrato_ampliaciones a where a.contrato_id = c.id);

-- Reservas sin contrato
insert into contrato_reservas (partida_id, concepto, estatus, importe, nota)
select p.id, v.concepto, v.estatus, v.importe, 'Carga inicial desde la cédula (fila ' || v.fila || ')'
from (values
  (51221001,'Abarrotes (Grupo 1), Carnes (Grupo 2)y Derivados Lacteos (Grupo 4), Varios (Grupo 6)','nueva contratación',747187.01,47),
  (51221001,'Frutas y Verduras (Grupo 3)','nueva contratación',40000,48),
  (51221001,'Leches (Grupo 5)','nueva contratación',100000,49),
  (51331001,'Valoracion Otorrino','desierta',0,19),
  (51331001,'Valoración Neuro','desierta',0,20),
  (51331001,'Plasmaferesis','no licitada',0,21),
  (51331001,'Valoración Electrofisiología','desierta',0,22),
  (51331003,'3 DENSITOMETRIA','sin DDP',19000,42),
  (51331003,'4 USG DOPPLER','sin DDP',31666.67,43),
  (51331003,'5 USG','sin DDP',31666.67,44),
  (51331003,'6 PH METRIAS Y MANOMETRIAS','sin DDP',272333.33,45),
  (51331003,'12 COLONOSCOPIAS','sin DDP',114000,46),
  (51331003,'20 SERIE ESOFAGICA','sin DDP',6333.33,47),
  (51331003,'21 TRANSITO INTESTINAL','sin DDP',6333.33,48),
  (51331003,'22 COLON POR ENEMA','sin DDP',6333.33,49),
  (51331003,'25 URETEROCISTOGRAFIA','sin DDP',6333.33,50),
  (51331005,'Cirugía de Neurocirugía (33)','desierta',0,69)

) v(cuenta, concepto, estatus, importe, fila)
join lateral (select id from partidas p where p.cuenta_finat = v.cuenta::text limit 1) p on true
where not exists (select 1 from contrato_reservas r where r.partida_id = p.id and r.concepto = v.concepto);

-- Programado mensual
insert into contrato_programado (contrato_id, anio, mes, escenario, importe, nota)
select c.id, 2026, v.mes, v.escenario, v.importe, 'Carga inicial desde la cédula (linea am / lin sub)'
from (values
  ('S6M0022',3,'ESC 1',520430),
  ('S6M0022',4,'ESC 1',29570),
  ('S6M0030',4,'ESC 1',167576),
  ('S6M0030',5,'ESC 1',257554),
  ('S6M0030',6,'ESC 1',228044),
  ('S6M0030',7,'ESC 1',208958),
  ('S6M0030',8,'ESC 1',228700),
  ('S6M0030',9,'ESC 1',346623.95),
  ('S6M0030',10,'ESC 1',490619.85),
  ('S6M0010',3,'ESC 1',3333),
  ('S6M0046',4,'ESC 1',4169),
  ('S6M0046',5,'ESC 1',4166),
  ('S6M0046',6,'ESC 1',4166),
  ('S6M0046',7,'ESC 1',4166),
  ('S6M0003',3,'ESC 1',70933.34),
  ('S6M0005',3,'ESC 1',1393875.44),
  ('S6M0015',3,'ESC 1',51107.25),
  ('S6M0016',3,'ESC 1',126666.66),
  ('S6M0017',3,'ESC 1',63403.83),
  ('S6M0040',3,'ESC 1',6400),
  ('S6M0040',4,'ESC 1',6400),
  ('S6M0040',5,'ESC 1',6400),
  ('S6M0040',6,'ESC 1',6300),
  ('S6M0040',7,'ESC 1',12600),
  ('S6M0040',8,'ESC 1',12600),
  ('S6M0040',9,'ESC 1',6300),
  ('S6M0041',3,'ESC 1',18666.67),
  ('S6M0041',4,'ESC 1',18500),
  ('S6M0041',5,'ESC 1',18500),
  ('S6M0041',6,'ESC 1',18500),
  ('S6M0041',7,'ESC 1',37000),
  ('S6M0041',8,'ESC 1',37000),
  ('S6M0041',9,'ESC 1',18500),
  ('S6M0042',3,'ESC 1',37019.14),
  ('S6M0042',4,'ESC 1',35000),
  ('S6M0042',5,'ESC 1',35000),
  ('S6M0042',6,'ESC 1',35000),
  ('S6M0042',7,'ESC 1',70000),
  ('S6M0042',8,'ESC 1',70000),
  ('S6M0042',9,'ESC 1',35000),
  ('S6M0043',3,'ESC 1',11081.67),
  ('S6M0043',4,'ESC 1',67785),
  ('S6M0043',5,'ESC 1',39400),
  ('S6M0043',6,'ESC 1',39400),
  ('S6M0043',7,'ESC 1',78800),
  ('S6M0043',8,'ESC 1',78800),
  ('S6M0043',9,'ESC 1',39400),
  ('S6M0047',4,'ESC 1',786315),
  ('S6M0047',5,'ESC 1',814700),
  ('S6M0047',6,'ESC 1',1577158.52),
  ('S6M0047',7,'ESC 1',1177729),
  ('S6M0047',8,'ESC 1',1706183),
  ('S6M0047',9,'ESC 1',1540625),
  ('S6M0049',3,'ESC 1',37926),
  ('S6M0049',4,'ESC 1',56000),
  ('S6M0049',5,'ESC 1',56000),
  ('S6M0049',6,'ESC 1',56000),
  ('S6M0049',7,'ESC 1',71950),
  ('S6M0049',8,'ESC 1',141124),
  ('S6M0049',9,'ESC 1',56000),
  ('S6M0050',4,'ESC 1',50533.48),
  ('S6M0050',5,'ESC 1',30000),
  ('S6M0050',6,'ESC 1',30000),
  ('S6M0050',7,'ESC 1',58000),
  ('S6M0050',8,'ESC 1',58000),
  ('S6M0050',9,'ESC 1',29002.76),
  ('S6M0012',3,'ESC 1',123340.83),
  ('S6M0048',3,'ESC 1',83645.21),
  ('S6M0048',4,'ESC 1',174294),
  ('S6M0048',5,'ESC 1',197602),
  ('S6M0048',6,'ESC 1',60008),
  ('S6M0048',7,'ESC 1',60450),
  ('S6M0048',8,'ESC 1',31550),
  ('S6M0048',9,'ESC 1',3000),
  ('S6M0048',10,'ESC 1',3000),
  ('S6M0048',11,'ESC 1',1577),
  ('S6M0048',12,'ESC 1',1577),
  ('S7M0163',4,'ESC 1',474737),
  ('S7M0163',5,'ESC 1',849123),
  ('S7M0163',6,'ESC 1',1000000),
  ('S7M0163',7,'ESC 1',474536),
  ('D6M0018',3,'ESC 1',1457000),
  ('D6M0019',3,'ESC 1',77500),
  ('D6M0032',5,'AMP',-226663.2),
  ('D6M0032',8,'AMP',150078.86),
  ('D6M0032',9,'ESC 1',3128736),
  ('D6M0032',9,'AMP',150078.86),
  ('D6M0032',10,'ESC 1',446394.36),
  ('D6M0032',10,'AMP',641601.94),
  ('D6M0033',5,'AMP',-113103.14),
  ('D6M0033',8,'AMP',113103.14),
  ('D6M0033',9,'ESC 1',1467162),
  ('D6M0033',9,'AMP',335168.47),
  ('D6M0033',10,'ESC 1',208680.36),
  ('D6M0034',5,'AMP',-17708.07),
  ('D6M0034',6,'AMP',17708.07),
  ('D6M0034',9,'ESC 1',241856),
  ('D6M0034',10,'ESC 1',37451.06),
  ('D6M0034',10,'AMP',55861.41),
  ('D6M0107',9,'ESC 1',55861.41)

) v(contrato, mes, escenario, importe)
join lateral (select id from contratos c where upper(c.numero_interno) = upper(v.contrato) limit 1) c on true
on conflict (contrato_id, anio, mes, escenario) do nothing;

-- Verificación: renglones de la cédula SIN contrato en SIGAF (hay que darlos de alta o son de 2025)
select 'sin contrato en SIGAF' as resultado, hoja, fila, contrato, alterno, concepto, max_unidad
from t_match where contrato_id is null
union all
select 'cargados', 'contratos con datos de la cédula', count(*)::int, null, null, null, null from contratos where concepto is not null
union all
select 'cargados', 'ampliaciones', count(*)::int, null, null, null, sum(importe) from contrato_ampliaciones
union all
select 'cargados', 'reservas sin contrato', count(*)::int, null, null, null, sum(importe) from contrato_reservas
union all
select 'cargados', 'programado (meses)', count(*)::int, null, null, null, sum(importe) from contrato_programado
order by 1 desc, 2, 3;