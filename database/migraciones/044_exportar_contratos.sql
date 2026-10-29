-- =====================================================================
-- SIGAF · Revisión · 044 · Contratos de SIGAF y columnas de ajustes_devengo (SOLO LECTURA)
-- Fecha: 30/10/2026 · Para la Fase 3 (pantalla Contratos): emparejar cada contrato de SIGAF con su renglón
-- de la cédula (área médica / subrogados) y ver cómo está hecha la tabla de devengo.
-- NO cambia nada. Cómo: SQL Editor → Run → "Download CSV" → dejarlo en Descargas
-- (sale una sola tabla: primero las columnas de ajustes_devengo, luego los contratos).
-- =====================================================================
select 'columna' as tipo, column_name as numero_interno, data_type as proveedor, null::text as capitulo, null::text as cuenta,
       null::date as vigencia_inicio, null::date as vigencia_fin, null::numeric as monto_minimo, null::numeric as monto_maximo,
       null::text as administrador, null::bigint as facturas, null::numeric as importe_facturas, null::numeric as devengo
from information_schema.columns where table_schema = 'public' and table_name = 'ajustes_devengo'
union all
select 'contrato', c.numero_interno, p.razon_social, cap.nombre, pa.cuenta_finat, c.vigencia_inicio, c.vigencia_fin,
       c.monto_minimo, c.monto_maximo, c.administrador_contrato,
       (select count(*) from facturas f where f.contrato_id = c.id and f.anulada = false and f.estatus_general <> 'devuelta_proveedor'),
       (select sum(f.importe_factura) from facturas f where f.contrato_id = c.id and f.anulada = false and f.estatus_general <> 'devuelta_proveedor'),
       (select sum(a.importe) from ajustes_devengo a where a.contrato_id = c.id)
from contratos c
join proveedores p on p.id = c.proveedor_id
join partidas pa on pa.id = c.partida_id
join capitulos cap on cap.id = pa.capitulo_id
order by 1, 4, 5, 2;
