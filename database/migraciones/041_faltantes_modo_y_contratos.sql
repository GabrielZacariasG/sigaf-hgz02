-- =====================================================================
-- SIGAF · Revisión · 041 · Para las facturas que faltan: ¿la cédula lleva esa cuenta por factura? ¿hay contrato? (SOLO LECTURA)
-- Fecha: 30/10/2026
-- 1ª parte: modo de la cédula por cuenta (facturas = se lleva factura por factura; sistema/vacio = no).
-- 2ª parte: contratos que SIGAF ya tiene de esos proveedores.
-- NO cambia nada. Cómo: SQL Editor → Run → pegar el resultado (sale una sola tabla con las dos partes).
-- =====================================================================
select 'cuenta' as tipo, b.cuenta_finat as clave, b.modo as dato, b.nombre as detalle, null::text as extra
from cedula_bloques b
where b.cuenta_finat in ('51221001','51251014','51261001','51311003','51311004','51321003','51331003','51351008','51371004','51371007')
union all
select 'contrato', c.numero_interno, pa.cuenta_finat, p.razon_social,
       to_char(c.vigencia_inicio, 'DD/MM/YYYY') || ' – ' || to_char(c.vigencia_fin, 'DD/MM/YYYY')
from contratos c
join proveedores p on p.id = c.proveedor_id
join partidas pa on pa.id = c.partida_id
where p.razon_social ilike any (array['%MEDINA LEON%','%INFRA%','%EDENRED%','%DE LA TORRE%','%MODELO INTEGRAL%','%TELEFONOS DE MEXICO%','%TELMEX%',
                                      '%ACE MEDICAL%','%LABORATORIO CLINICO PROFESIONAL%','%OTIS%','%NAYELI%'])
order by 1, 2;
