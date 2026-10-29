-- =====================================================================
-- SIGAF · Revisión · 023 · Candidatos de CR para las pendientes de la puesta al día (SOLO LECTURA)
-- Fecha: 29/10/2026
-- Antes de asignar un CR hay que confirmar que no lo tenga YA otra factura de SIGAF y que el folio del
-- sistema no esté capturado aparte. Busca:
--   CR 00471190 (PISA "64085702" $212,024.12)      ← candidata: PISA 640857022 (¿folio con un 2 de más?)
--   CR 00475355 (Prod. Hosp. "46015679994" $78,547.43) ← candidata: 4601567994
--   CR 00475357 (Prod. Hosp. "4601580626" $75,929.18)  ← candidata: 4601587649 (folio distinto)
--   CR 00476469 (SIE "33002969" $8,483.37)          ← candidata: 33002983 (folio distinto)
--   CR 00474947 (Médica San Juan "3979" $8,004, UI 010101) ← SIGAF 3979 $12,272.80
-- NO cambia nada. Cómo: SQL Editor → Run → pegar el resultado.
-- =====================================================================
select f.folio_ingreso, f.folio_proveedor, pr.razon_social as proveedor, pa.cuenta_finat,
       f.importe_factura, f.periodo_inicio, f.periodo_fin, f.estatus_general, f.cr_contrarecibo, f.anulada
from facturas f
join partidas pa on pa.id = f.partida_id
left join proveedores pr on pr.id = f.proveedor_id
where ltrim(coalesce(f.cr_contrarecibo, ''), '0') in ('471190','468531','475355','475357','476469','474947')
   or regexp_replace(f.folio_proveedor, '\D', '', 'g') in
      ('64085702','640857022','64012706','4601567994','46015679994','4601580626','4601587649',
       '33002969','33002983','3979')
order by pr.razon_social, f.folio_proveedor;
