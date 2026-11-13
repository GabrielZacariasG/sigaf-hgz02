-- =====================================================================
-- SIGAF · Ampliaciones en trámite, cuenta 51331003 (correo de CAOA, 13/11/2026)
-- El incremento de presupuesto ya llegó a la dispo (51331003: 11,259,530 → 13,066,212). CAOA hará los convenios y
-- ampliará los dictámenes; mientras, el saldo de los contratos se monitorea con el máximo + ampliación:
--   S6M0041 Patología          18,353.33
--   S6M0043 Médica San Juan    40,290.72
--   S6M0047 Promotora         848,038.14
-- Se registran como "Ampliación en trámite…": cuentan para el enlace, el saldo, el semáforo y el tope del 20%.
-- La carga del IMKK036 ya no baja el enlace al dictamen mientras haya ampliación en trámite (lib/dictamenesCarga.js).
-- S6M0047: se quita el ajuste de −390,225.91 que igualaba el enlace al dictamen; con la ampliación en trámite el
-- enlace queda en el máximo + ampliación (8,450,748.66). Cuando llegue el convenio, cambiar la nota por su número.
-- Idempotente: se puede correr dos veces.
-- =====================================================================

begin;

insert into contrato_ampliaciones (contrato_id, fecha, importe, nota)
select c.id, date '2026-11-13', v.importe, 'Ampliación en trámite (correo de CAOA 13/11/2026, incremento cuenta 51331003; convenio y dictamen pendientes)'
from (values ('S6M0041', 18353.33), ('S6M0043', 40290.72), ('S6M0047', 848038.14)) as v(contrato, importe)
join contratos c on c.numero_interno = v.contrato
where not exists (
  select 1 from contrato_ampliaciones a where a.contrato_id = c.id and a.nota like 'Ampliación en trámite%'
);

delete from contrato_ampliaciones a
using contratos c
where a.contrato_id = c.id and c.numero_interno = 'S6M0047' and a.nota like 'Ajuste para igualar al dictamen FINAT%';

-- Verificación: enlace = máximo + ampliaciones
select c.numero_interno,
       to_char(c.monto_maximo, 'FM999,999,999.00') as maximo,
       to_char(coalesce(sum(a.importe), 0), 'FM999,999,999.00') as ampliaciones,
       to_char(c.monto_maximo + coalesce(sum(a.importe), 0), 'FM999,999,999.00') as enlace,
       string_agg(left(a.nota, 40), ' | ') as notas
from contratos c
left join contrato_ampliaciones a on a.contrato_id = c.id
where c.numero_interno in ('S6M0041', 'S6M0043', 'S6M0047')
group by c.numero_interno, c.monto_maximo
order by c.numero_interno;

commit;
