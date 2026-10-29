-- =====================================================================
-- SIGAF · Corrección · 009 · Hemodiálisis intramuros (Reactivos y Químicos, facturas MTY) a su cuenta
-- Fecha: 29/10/2026 · Aprobado por Gabriel
--
-- Problema: los contratos de Reactivos y Químicos de hemodiálisis INTRAMUROS
--   050GYR032N13825-182-00, 050GYR032N13825-182-01 y 988T00323-010
-- quedaron dados de alta en la cuenta 51331002 (Subrogación de hemodiálisis EXTRAMUROS).
-- Sus 12 facturas ($12,816,271.60: pasivo oct–dic 2025 y ene–ago 2026) se veían en la 51331002.
--
-- Prueba con el sistema (dispo 29/10/2026): gasto 51331014 = $14,851,309.48
--   = $12,816,271.60 (estas 12 facturas) + $2,035,037.88 (contrato nuevo 07426-133, ya en 51331014). Cuadra al centavo.
--
-- Corrección: contratos y sus facturas pasan a la partida 51331014. No cambia importes ni estatus.
-- Cómo: SQL Editor de Supabase → Run. Al final debe mostrar 51331014 = 14,851,309.48 y 51331002 = 0.
-- =====================================================================
with destino as (
  select id from partidas where cuenta_finat = '51331014' limit 1
),
ctos as (
  select c.id from contratos c
  join partidas p on p.id = c.partida_id
  where p.cuenta_finat = '51331002'
    and c.numero_interno in ('050GYR032N13825-182-00', '050GYR032N13825-182-01', '988T00323-010')
),
upd_c as (
  update contratos set partida_id = (select id from destino)
  where id in (select id from ctos)
  returning id
),
upd_f as (
  update facturas set partida_id = (select id from destino)
  where contrato_id in (select id from ctos)
  returning id, importe_factura
)
select (select count(*) from upd_c)                    as contratos_movidos,
       (select count(*) from upd_f)                    as facturas_movidas,
       (select coalesce(sum(importe_factura), 0) from upd_f) as importe_movido;

-- Verificación (correr después; solo lectura): gasto en SIGAF por cuenta, sin anuladas ni devueltas
select p.cuenta_finat, count(f.id) as facturas, coalesce(sum(f.importe_factura), 0) as importe
from partidas p
left join facturas f on f.partida_id = p.id and f.anulada = false and f.estatus_general <> 'devuelta_proveedor'
where p.cuenta_finat in ('51331014', '51331002')
group by p.cuenta_finat
order by p.cuenta_finat;
