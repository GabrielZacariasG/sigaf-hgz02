-- =====================================================================
-- SIGAF · REEMPLAZO del catalogo de D6M0033 (viveres: frutas y verduras)
-- 73 conceptos reales del contrato (nombre + precio + orden), U.MEDIDA KG.
-- Protegido: aborta si hay desglose (factura_detalle) contra los conceptos
-- actuales, para no romper capturas reales. Transaccional.
-- Correr en el SQL Editor de Supabase.
-- =====================================================================

begin;

-- 0) Debe existir exactamente 1 contrato D6M0033
do $$ declare nc int; begin
  select count(*) into nc from contratos where numero_interno='D6M0033';
  if nc <> 1 then raise exception 'Esperaba 1 contrato D6M0033, encontre % — se aborta.', nc; end if;
end $$;

-- 1) Guard: no debe haber desglose capturado contra los conceptos actuales
do $$ declare n int; begin
  select count(*) into n from factura_detalle d
  join contrato_servicios cs on cs.id=d.contrato_servicio_id
  join contratos c on c.id=cs.contrato_id
  where c.numero_interno='D6M0033';
  if n>0 then raise exception 'D6M0033 tiene % renglones de desglose capturados; no se reemplaza (avisar).', n; end if;
end $$;

-- 2) Borrar catalogo actual de D6M0033
delete from contrato_servicios where contrato_id in (select id from contratos where numero_interno='D6M0033');

-- 3) Cargar los 73 conceptos reales (nombre, precio, orden)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario, orden)
select c.id, v.nombre, v.precio, v.orden
from (values
(1,'CIRUELA ROJA',45),
(2,'DURAZNO',50),
(3,'GUAYABA',35),
(4,'JÍCAMA',15),
(5,'LIMA DULCE',25),
(6,'LIMÓN AGRIO',22),
(7,'LIMÓN SIN SEMILLA',27),
(8,'MANDARINA REINA O TANGERINA',38),
(9,'MANGO ATAULFO',40),
(10,'MANGO MANILA',40),
(11,'MANZANA RED DELICIOUS',39),
(12,'MELÓN CHINO',28),
(13,'MELÓN VALENCIANO',20),
(14,'NARANJA SIN SEMILLA',18),
(15,'PAPAYA ROJA',32),
(16,'PERA MANTEQUILLA',45),
(17,'PERÓN',40),
(18,'PIÑA',30),
(19,'PLÁTANO DOMINICO',20),
(20,'PLÁTANO TABASCO',25),
(21,'SANDIA',18),
(22,'TAMARINDO',40),
(23,'TE DE LIMÓN ZACATE NATURAL',25),
(24,'TE DE MANZANILLA NATURAL',25),
(25,'TE DE YERBABUENA NATURAL',25),
(26,'TORONJA ROJA',20),
(27,'TUNA',20),
(28,'UVA SIN SEMILLA',50),
(29,'ACELGA',20),
(30,'AGUACATE HASS',42),
(31,'AJO EN BULBO',60),
(32,'APIO',25),
(33,'BETABEL',18),
(34,'BRÓCOLI',25),
(35,'CALABACITA ITALIANA',25),
(36,'CEBOLLA BLANCA',22),
(37,'CEBOLLA MORADA',22),
(38,'CHAMPIÑÓN FRESCO',78),
(39,'CHAYOTE SIN ESPINAS',24),
(40,'CHÍCHARO CONGELADO',85),
(41,'CHÍCHARO LIMPIO',70),
(42,'CHILE HABANERO',30),
(43,'CHILE JALAPEÑO',23),
(44,'CHILE LARGO GÜERO',24),
(45,'CHILE POBLANO',32),
(46,'CHILE SERRANO',25),
(47,'CILANTRO',22),
(48,'COL BLANCA',15),
(49,'COL MORADA',17),
(50,'COLIFLOR FRESCA',22),
(51,'EJOTE',38),
(52,'ELOTE FRESCO ENTERO',18),
(53,'EPAZOTE',20),
(54,'ESPINACA FRESCA',24),
(55,'GERMINADO DE ALFALFA',40),
(56,'GERMINADO DE SOYA',40),
(57,'HIERBAS DE OLOR (LAUREL, MEJORANA Y TOMILLO)',40),
(58,'JITOMATE BOLA',23),
(59,'JITOMATE GUAJE O GUAJITO',25),
(60,'LAUREL',39),
(61,'LECHUGA OREJONA',16),
(62,'LECHUGA ROMANA',20),
(63,'MEJORANA',25),
(64,'NOPAL',29),
(65,'PAPA BLANCA',27),
(66,'PEPINO',20),
(67,'PEREJIL',30),
(68,'PIMIENTO MORRÓN FRESCO',40),
(69,'PORO',20),
(70,'RÁBANO CHICO',25),
(71,'TOMATE VERDE',27),
(72,'TOMILLO',25),
(73,'ZANAHORIA',22)
) as v(orden,nombre,precio),
(select id from contratos where numero_interno='D6M0033' limit 1) c;

-- 4) Verificacion (esperado: 73 / 73 / min 15 / max 85)
select count(*) as conceptos, count(orden) as con_orden,
       to_char(min(precio_unitario),'FM999,999.00') as precio_min,
       to_char(max(precio_unitario),'FM999,999.00') as precio_max
from contrato_servicios cs join contratos c on c.id=cs.contrato_id where c.numero_interno='D6M0033';

commit;
