-- =====================================================================
-- SIGAF · Revisión · 040 · Comprobantes del HGZ 2 que ninguna factura de SIGAF tiene como CR (SOLO LECTURA)
-- Fecha: 30/10/2026 · fuente: comprobantes_ooad (lo que guardó la pantalla Comprobantes)
-- Son los "Faltan en SIGAF": el sistema ya registró el gasto del HGZ 2 (UI 010102) y SIGAF no tiene factura
-- con ese CR. Trae también, por si existe con otro folio, cuántas facturas SIN CR tiene SIGAF de ese
-- proveedor con el mismo importe. NO cambia nada.
-- Cómo: SQL Editor → Run → copiar el resultado y pegarlo aquí.
-- =====================================================================
with c as (
  select cbte,
         max(proveedor) as proveedor, max(no_proveedor) as no_proveedor, max(factura_txt) as factura,
         max(importe) as importe_total,
         sum(importe_cuenta) filter (where ui = '010102') as importe_hgz2,
         string_agg(distinct cuenta, ', ') filter (where ui = '010102') as cuentas,
         max(estado_pago) as estado_pago, max(fecha_prog_pago) as fecha_prog_pago, max(fecha_emision) as fecha_emision,
         max(tipo) as tipo, max(usuario) as usuario
  from comprobantes_ooad
  where estado_entrada <> 'X'
  group by cbte
  having bool_or(ui = '010102')
)
select c.*,
       (select count(*) from facturas f
         where f.anulada = false and nullif(btrim(coalesce(f.cr_contrarecibo, '')), '') is null
           and abs(f.importe_factura - coalesce(c.importe_hgz2, c.importe_total)) <= 1) as sigaf_sin_cr_mismo_importe
from c
where not exists (select 1 from facturas f where f.anulada = false
                  and ltrim(btrim(coalesce(f.cr_contrarecibo, '')), '0') = ltrim(c.cbte, '0'))
order by c.cuentas, c.proveedor, c.cbte;
