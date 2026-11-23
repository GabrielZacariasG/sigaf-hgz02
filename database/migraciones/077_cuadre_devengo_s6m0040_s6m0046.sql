-- =====================================================================
-- SIGAF · 077 · Devengo de S6M0040 (dosímetros) y S6M0046 (val. oftalmológica) · 23/11/2026
-- 1) Renglones "SIN FOLIO … mm/2026" del Avance guardados sin año → anio = 2026 (si no, Contratos no los cuenta).
-- 2) S6M0040: "SIN FOLIO S6M0040 10/2026" se liga a la factura A 14466 (octubre, $7,273.20).
--    El 1451/2026 (CD_SMS, 01/09/2026) es copia del "SIN FOLIO S6M0040 09/2026" que ya va en la 14274 → cancelado.
-- 3) S6M0046: el folio 2287 (20/07/2026) se liga a la factura 86046 (julio, $5,798.84, pagada, sin folios).
-- Resultado esperado: S6M0046 devengo $0 · saldo ≈ $5,069 (FINAT $5,068.98) ·
--   S6M0040 facturado $56,654.40 + devengo noviembre $7,273.20 → saldo −$6,927.60 (el Avance da −$6,926.40).
-- Se puede correr dos veces.
-- =====================================================================
update subrogados_folios
   set anio = (regexp_match(folio, '/(\d{4})$'))[1]::int, actualizado_at = now()
 where anio is null and folio ~ '^SIN FOLIO .* \d{2}/\d{4}$';

update subrogados_folios s
   set factura_id = f.id, ligado_at = now()
  from facturas f join contratos c on c.id = f.contrato_id
 where c.numero_interno = 'S6M0040' and f.folio_proveedor = 'A 14466'
   and s.contrato_id = c.id and s.folio = 'SIN FOLIO S6M0040 10/2026' and s.factura_id is null;

update subrogados_folios s
   set cancelado = true, factura_id = null,
       motivo = 'Duplicado: copia del SIN FOLIO S6M0040 09/2026 (factura 14274) [CUADRE-077]', actualizado_at = now()
  from contratos c
 where s.contrato_id = c.id and c.numero_interno = 'S6M0040' and s.folio = '1451/2026' and s.origen = 'cd_sms' and not s.cancelado;

update subrogados_folios s
   set factura_id = f.id, ligado_at = now()
  from facturas f join contratos c on c.id = f.contrato_id
 where c.numero_interno = 'S6M0046' and f.folio_proveedor = '86046'
   and s.contrato_id = c.id and s.folio = '2287' and s.factura_id is null and not s.cancelado;

-- Revisión
select c.numero_interno, s.folio, s.importe, s.anio, s.mes,
       case when s.cancelado then 'cancelado' when s.factura_id is not null then 'ligado a ' || f.folio_proveedor else 'devengo' end as estado
  from subrogados_folios s join contratos c on c.id = s.contrato_id left join facturas f on f.id = s.factura_id
 where c.numero_interno in ('S6M0040', 'S6M0046') order by 1, s.anio, s.mes, 2;
