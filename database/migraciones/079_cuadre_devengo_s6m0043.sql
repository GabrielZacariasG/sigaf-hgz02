-- =====================================================================
-- SIGAF · 079 · Devengo de S6M0043 (Médica San Juan) · 23/11/2026
-- En el Avance de noviembre los folios 2239, 2246, 2262, 2932 y 2938 están CANCELADOS (importe 0), pero SIGAF
-- conserva su renglón viejo de $3,068.20 como devengo (de una carga anterior con otro texto de estudio).
-- Se cancelan (no se borran). Resultado esperado: devengo $18,686.68 · saldo $9,204.60.
-- =====================================================================
update subrogados_folios s
   set cancelado = true,
       motivo = 'Cancelado en el Avance SMS de noviembre (importe 0) [CUADRE-079]', actualizado_at = now()
  from contratos c
 where s.contrato_id = c.id and c.numero_interno = 'S6M0043'
   and s.folio in ('2239', '2246', '2262', '2932', '2938') and s.importe = 3068.20
   and s.factura_id is null and s.factura_txt is null and not s.cancelado;

select s.folio, s.fecha, s.origen, s.importe, case when s.cancelado then 'cancelado' else 'devengo' end as estado
  from subrogados_folios s join contratos c on c.id = s.contrato_id
 where c.numero_interno = 'S6M0043' and s.factura_id is null and s.factura_txt is null
   and (s.cancelado = false or s.motivo like '%CUADRE-079%')
 order by s.fecha, s.folio;
