-- SIGAF · contrato_servicios de PDFs ESCANEADOS (leídos por visión). Idempotente.
begin;

-- S6M0048 (19)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('CIRUGIA DE OFTALMOLOGIA URGENTE ADULTO Y PEDIATRICO TRAUMATISMO O LESIONES OCULARES DIVERSAS, EXTRACCION DE CUERPOS EXTRAÑOS EN CORNEAS', 34999),
  ('CATETERISMO CARDIACO', 30300),
  ('CATETERISMO CARDIACO CON ANGIOPLASTIA PRIMARIA CON STEN ADICIONAL MEDICADO', 105000),
  ('CATETERISMO CARDIACO CON ANGIOPLASTIA PRIMARIA SIN STEN', 12000),
  ('CATETERISMO CARDIACO CON ANGIOPLASTIA PRIMARIA CON STEN MEDICADO', 85000),
  ('CATETERISMO CARDIACO CON ANGIOPLASTIA PRIMARIA STEN NO MEDICADO', 16000),
  ('COLOCACION DE MARCAPASOS DEFINITIVO, INCLUYE INSUMOS (UNICAMERAL O BICAMERAL)', 72000),
  ('CATETERISMO PERIFERICO', 16000),
  ('CATETERISMO CON TROMBECTOMIA MECANICA PULMONAR', 50200),
  ('SOLO STENT MEDICADO', 23980),
  ('SOLO STENT NO MEDICADO', 3500),
  ('CIRUGIA DE ANGIOLOGIA (SAFENOEXCERESIS)', 21000),
  ('CIRUGIA DE ANGIOLOGIA (LESIONES VASCULARES TRAUMATICAS)', 32690),
  ('CIRUGIA DE ANGIOLOGIA (FISTULA ARTERIOVENOSAS)', 20500),
  ('CIRUGIA DE ANGIOLOGIA (INSUFICIENCIA ARTERIAL AGUDA CON STENT)', 30400),
  ('CIRUGIA ENDOVASCULAR CON STENT', 75650),
  ('CIRUGIA ENDOVASCULAR SIN STENT', 47745),
  ('CIRUGIA DE ANGIOLOGIA (COLOCACION DE CATETER PERMACAT PARA HEMODIALISIS)', 20350),
  ('SOLO STENT', 23980)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S6M0048'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- S6M0040 (1)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('DOSIMETRIA', 110)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S6M0040'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- S7M0163 (36)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('BIOPSIA DE RIÑON CON INMUNOFLUORESCENCIA', 4000),
  ('PLANEACION A (RADIOTERAPIA)', 998),
  ('PLANEACION B (RADIOTERAPIA)', 3515),
  ('PLANEACION C (RADIOTERAPIA) (INCLUYE MASCARILLA)', 4451),
  ('ANATOMIA PATOLOGICA DE BIOPSIA DE MAMA', 1735),
  ('ANATOMIA PATOLOGICA MASTECTOMIA RADICAL (CANCER DE MAMA)', 5030),
  ('ANATOMIA PATOLOGICA DE MASTECTOMIA SIMPLE', 2175),
  ('MASTECTOMIA RADICAL', 30415),
  ('CUADRANTECTOMIA MAMARIA / LUMPECTOMIA MAMARIA', 23395),
  ('MARCAJE DE MAMA (INCLUYE AGUJA Y PATOLOGIA)', 7600),
  ('PLASTIA DIAFRAGMATICA POR TORACOSCOPIA', 43815),
  ('BRONCOSCOPIA PEDIATRICA', 5895),
  ('BRONCOSCOPIA', 2685),
  ('INMOVILIZACION DE FRACTURA CON ANESTESIA SIN INSUMOS', 5500),
  ('INMOVILIZACION DE FRACTURA SIN ANESTESIA Y SIN INSUMOS', 1645),
  ('CONCENTRADO ERITROCITARIO (INCLUYE PROCEDIMIENTO, SIN MATERIAL, SIN HOSPITALIZACION, NO COMPLICACIONES)', 1575),
  ('OSTEOSINTESIS FRACTURA LUXACION DE TOBILLO REDUCCION CERRADA CON ANESTESIA', 5080),
  ('FRACTURA DIAFISIARIA DE CUBITO Y RADIO (REDUCCION CERRADA)', 2560),
  ('REDUCCION CERRADA LUXACION DE HOMBRO (CON ANESTESIA)', 4225),
  ('REDUCCION CERRADA LUXACION DE CODO (CON ANESTESIA)', 4225),
  ('REDUCCION CERRADA HUESO DE MANO', 2410),
  ('PROGRAMA REHABILITACION CAPRA (56 DIAS)', 28235),
  ('PROGRAMA REHABILITACION CAPRA (POR DIA)', 500),
  ('CONSULTAS DE ESPECIALIDAD (PSIQUIATRIA, PSICOLOGIA, PSICOPEDAGOGIA, PAIDOPSIQUIATRIA)', 480),
  ('PRUEBA DE PSICOLOGIA PSICOMETRIA (BATERIA DE 2 A 4 PRUEBAS)', 2415),
  ('HOSPITALIZACION DESINTOXICACION POR DIA', 1218),
  ('TERAPIA ELECTROCONVULSIVA', 2184),
  ('PRUEBA DE PSICOLOGIA PSICOMETRIA UNITARIA', 1071),
  ('COLOCACION DE MALLA ONFALOCELE O GASTROQUISIS', 34195),
  ('TORACOTOMIA EXPLORADORA', 21960),
  ('TORACOCENTESIS', 905),
  ('COLOCACION DE SELLO DE AGUA', 4865),
  ('INCUBADORA POR DIA SIN INSUMOS', 835),
  ('PERFIL TIROIDEO BASICO (TSH,T3,T3L,T4,T4L)', 875),
  ('TRANSPORTE INTRA-HOSPITALARIO DE PACIENTE PSIQUIATRICO A BORDO DE AMBULANCIA PSIQUIATRICO DE TRASLADO (HGZ 1 Y 2)', 700),
  ('TRANSPORTE INTRA-HOSPITALARIO DE PACIENTE PSIQUIATRICO A BORDO DE AMBULANCIA PSIQUIATRICO DE TRASLADO (HGZ 3)', 840)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S7M0163'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- S6M0043 (5)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('PRUEBAS PSICOLOGICAS', 4087.1),
  ('PRUEBAS PSICOLOGICAS PEDIATRICAS', 3392.5),
  ('ELECTROENCEFALOGRAMA PORTATIL ADULTO', 2645),
  ('ELECTROENCEFALOGRAMA ADULTOS', 2645),
  ('ELECTROENCEFALOGRAMA PORTATIL TODAS EDADES PEDIATRICAS', 2645)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S6M0043'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- S6M0046 (2)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('VALORACION OFTALMOLOGICA DE URGENCIA ADULTO Y PEDIATRICO', 4999),
  ('VALORACION DE ANGIOLOGIA DE URGENCIA ADULTO Y PEDIATRICO', 4200)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S6M0046'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- S6M0015 (1)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('FLUOROSCOPIO (ARCO EN C)', 4197.5)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S6M0015'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- S6M0050 (1)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('FLUOROSCOPIO (ARCO EN C)', 4197.5)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S6M0050'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- S6M0049 (4)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('APOYO MECANICO VENTILATORIO INVASIVO Y NO INVASIVO POR DIA', 1462.65),
  ('APOYO MECANICO VENTILATORIO PORTATIL (TRASLADO)', 1050),
  ('MONITOR DE SIGNOS VITALES PORTATIL (TRASLADO)', 525),
  ('APOYO MECANICO VENTILATORIO DE ALTA FRECUENCIA INVASIVO POR DIA', 2205)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S6M0049'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- S6M0041 (4)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('SERVICIO DE PATOLOGIA (INMUNOHISTOQUIMICO) Y TINCIONES ESPECIALES PARA MUESTRAS DE TEJIDO', 1000),
  ('ESTUDIO DE INMUNOFLOURESCENCIA POR MICROSCOPIA DE LUZ PARA BIOPSIA', 4500),
  ('ESTUDIOS DE CITOLOGIA CERVICO-VAGINAL CON TECNICA DE PAPANICOLAU BASE LIQUIDA', 99),
  ('ESTUDIO DE ANATOMIA PATOLOGICA', 900)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S6M0041'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- 050GYR032N09825-108-00 (1)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('SERVICIO MEDICO DE HEMODIALISIS SUBROGADA (SESION)', 1980)
) as v(servicio, precio) join contratos ct on ct.numero_interno='050GYR032N09825-108-00'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- S6M0010 (2)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('VALORACION OFTALMOLOGICA DE URGENCIA ADULTO Y PEDIATRICO', 3999),
  ('VALORACION DE ANGIOLOGIA DE URGENCIA ADULTO Y PEDIATRICO', 4200)
) as v(servicio, precio) join contratos ct on ct.numero_interno='S6M0010'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

-- 050GYR032N05725-092-00 (1)
insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio from (values
  ('SERVICIO MEDICO INTEGRAL PARA LA DIGITALIZACION, POST PROCESAMIENTO, ALMACENAMIENTO Y DISTRIBUCION DE ESTUDIOS MEDICOS', 76)
) as v(servicio, precio) join contratos ct on ct.numero_interno='050GYR032N05725-092-00'
where not exists (select 1 from contrato_servicios cs where cs.contrato_id=ct.id and cs.nombre_servicio=v.servicio);

commit;