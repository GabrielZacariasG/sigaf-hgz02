-- =====================================================================
-- SIGAF · Corrección · 051 · D6M0029 es el contrato de AGUA EN GARRAFONES (no víveres)
-- Fecha: 30/10/2026 · Contrato que pasó Gabriel (verPDF.pdf)
-- En la 043 el contrato D6M0029 se dio de alta copiando los datos de D6M0032 (víveres). El contrato real es:
--   050GYR032N00426-008-00 · Reg. SAI D6M0029 · JORGE EDUARDO MEDINA LEÓN
--   "Servicio de agua para beber en garrafones para unidades médicas y administrativas del ejercicio 2026 (partida 2)"
--   Cuenta 51221001 · vigencia 24/01/2026 al 31/12/2026 · OOAD: mínimo $180,000, máximo $450,000
--   Dictamen 0000056673-2026: al HGZ 2 le asigna $55,000 (IMKK036 29/10).
-- Gabriel: este contrato no lo administra la oficina; queda en SIGAF solo para que su factura (3583, $18,502,
-- pagada el 29/10, CR 00475063, cargada al HGZ 2) cuadre con FINAT. El administrador copiado de víveres se quita.
-- No toca facturas. Se puede correr dos veces. Cómo: SQL Editor → Run. Debe mostrar 1 fila con los datos nuevos.
-- =====================================================================
update contratos set
  concepto                = 'Agua para beber en garrafones (partida 2)',
  adquisicion_servicio    = 'Servicio de agua para beber en garrafones',
  numero_alterno          = '050GYR032N00426-008-00',
  dictamen_numero         = '0000056673-2026',
  dictamen_tipo           = 'DEF',
  vigencia_inicio         = date '2026-01-24',
  vigencia_fin            = date '2026-12-31',
  importe_maximo_contrato = 450000,
  monto_maximo            = 55000,
  administrador_contrato  = null
where upper(regexp_replace(numero_interno, '[^A-Za-z0-9]', '', 'g')) like 'D6M0029%';

insert into contrato_dictamenes (contrato_id, dictamen, tipo, nota)
select id, '0000056673-2026', 'principal', 'Contrato de agua en garrafones (051)'
from contratos where upper(regexp_replace(numero_interno, '[^A-Za-z0-9]', '', 'g')) like 'D6M0029%'
on conflict (contrato_id, dictamen) do nothing;

select c.numero_interno, c.numero_alterno, c.concepto, c.dictamen_numero, c.vigencia_inicio, c.vigencia_fin,
       c.importe_maximo_contrato, c.monto_maximo, p.cuenta_finat,
       (select count(*) from facturas f where f.contrato_id = c.id and not f.anulada) as facturas
from contratos c left join partidas p on p.id = c.partida_id
where upper(regexp_replace(c.numero_interno, '[^A-Za-z0-9]', '', 'g')) like 'D6M0029%';
