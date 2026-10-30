-- =====================================================================
-- SIGAF · Fase 3b · 050 · Varios dictámenes por contrato (principal y de pasivo)
-- Fecha: 30/10/2026
-- Por qué: los contratos 2025 se pagan en 2026 con un dictamen de PASIVO aparte
--   ("solicitud de DDP para trámite de asociación de pago de pasivo"), distinto al dictamen 2025 del contrato.
--   Hasta ahora SIGAF solo guardaba un dictamen por contrato (contratos.dictamen_numero).
-- Qué hace:
--   · Crea contrato_dictamenes (contrato, dictamen, tipo principal | pasivo).
--   · Pasa ahí los dictámenes que ya tenían los contratos (principal).
--   · S5M0009: le pone su dictamen 0000041413-2025 (lo trae la cédula; en SIGAF estaba vacío).
--   · Liga los 9 dictámenes de pasivo 2026 a su contrato 2025 (según SALDO DE LOS CONTRATOS 29/10 y la descripción
--     del dictamen). Si hay dos contratos con el mismo número, se usa el de la misma cuenta del dictamen.
-- No toca importes ni el enlace de ningún contrato.
-- Permisos: leer = cualquier usuario con sesión; escribir = Finanzas (fn_es_personal). Se puede correr dos veces.
-- Cómo: SQL Editor de Supabase → Run. Al final muestra cada dictamen de pasivo, su contrato y el saldo del HGZ 2.
-- =====================================================================
create table if not exists contrato_dictamenes (
  contrato_id  uuid not null references contratos(id) on delete cascade,
  dictamen     text not null,
  tipo         text not null check (tipo in ('principal', 'pasivo')),
  nota         text,
  created_at   timestamptz not null default now(),
  primary key (contrato_id, dictamen)
);
create index if not exists idx_contrato_dictamenes_dic on contrato_dictamenes (dictamen);

alter table contrato_dictamenes enable row level security;
drop policy if exists cdi_read on contrato_dictamenes;
create policy cdi_read on contrato_dictamenes for select using (auth.role() = 'authenticated');
drop policy if exists cdi_write on contrato_dictamenes;
create policy cdi_write on contrato_dictamenes for all using (public.fn_es_personal()) with check (public.fn_es_personal());

-- S5M0009: dictamen 2025 de la cédula (cuenta 51331005)
update contratos c set dictamen_numero = '0000041413-2025', dictamen_tipo = coalesce(nullif(c.dictamen_tipo, ''), 'DEF')
from partidas p
where p.id = c.partida_id and upper(regexp_replace(c.numero_interno, '[^A-Za-z0-9]', '', 'g')) = 'S5M0009'
  and coalesce(c.dictamen_numero, '') = ''
  and (p.cuenta_finat = '51331005' or (select count(*) from contratos x where upper(regexp_replace(x.numero_interno, '[^A-Za-z0-9]', '', 'g')) = 'S5M0009') = 1);

-- Principal: el dictamen que ya tiene cada contrato
insert into contrato_dictamenes (contrato_id, dictamen, tipo, nota)
select id, dictamen_numero, 'principal', 'Dictamen del contrato (contratos.dictamen_numero)'
from contratos where dictamen_numero ~ '^[0-9]{10}-[0-9]{4}$'
on conflict (contrato_id, dictamen) do nothing;

-- Pasivo 2026 de contratos 2025
drop table if exists t_pasivo;
create temp table t_pasivo (contrato text, dictamen text, nota text);
insert into t_pasivo values
  ('S5M0007', '0000205281-2026', 'Asociación de pago de pasivo S5M0007 Promotora Médica (51331001)'),
  ('D5M0013', '0000233878-2026', 'Asociación de pasivo D5M0013 Jesús Manuel Romo Alba (51221001)'),
  ('S5M0025', '0000271322-2026', 'Asociación de pago de pasivo S5M0025 Médica San Juan (51331003)'),
  ('S5M0003', '0000271331-2026', 'Asociación de pago de pasivo S5M0003 Gabinete de Estudios Diagnósticos (51331003)'),
  ('S5M0022', '0000271336-2026', 'Asociación de pago de pasivo S5M0022 Laboratorio Clínico Profesional (51331003)'),
  ('S5M0005', '0000277104-2026', 'Asociación de pago de pasivo S5M0005 Médica San Juan (51331003)'),
  ('S5M0010', '0000277107-2026', 'Asociación de pago de pasivo S5M0010 Servicios de Ingeniería en Medicina (51331003)'),
  ('S5M0009', '0000277112-2026', 'Pago de pasivo S5M0009 Promotora Médica (51331005)'),
  ('S5M0081', '0000152504-2026', 'Traslado de pacientes S5M0081 (52411011); el SAI lo liga a S5M0081-25');

insert into contrato_dictamenes (contrato_id, dictamen, tipo, nota)
select k.id, k.dictamen, 'pasivo', k.nota
from (
  select t.dictamen, t.nota, c.id,
         exists (select 1 from dictamen_saldos s where s.dictamen = t.dictamen and s.cuenta = p.cuenta_finat) as misma_cuenta,
         count(*) over (partition by t.dictamen) as n
  from t_pasivo t
  join contratos c on upper(regexp_replace(c.numero_interno, '[^A-Za-z0-9]', '', 'g')) = t.contrato
  left join partidas p on p.id = c.partida_id
) k
where k.misma_cuenta or k.n = 1
on conflict (contrato_id, dictamen) do nothing;

-- Verificación: cada dictamen de pasivo con su contrato ligado y lo que FINAT dice del HGZ 2
select t.contrato, t.dictamen, p.cuenta_finat as cuenta_contrato,
       case when cd.contrato_id is null then 'NO SE LIGÓ: el contrato no existe en SIGAF o su cuenta no coincide' else 'ligado' end as estado,
       (select sum(s.definitivo) from dictamen_saldos s where s.dictamen = t.dictamen and s.ui = '010102') as asignado_hgz2,
       (select sum(s.pagos)      from dictamen_saldos s where s.dictamen = t.dictamen and s.ui = '010102') as pagado_hgz2,
       (select sum(s.disponible) from dictamen_saldos s where s.dictamen = t.dictamen and s.ui = '010102') as disponible_hgz2
from t_pasivo t
left join contrato_dictamenes cd on cd.dictamen = t.dictamen and cd.tipo = 'pasivo'
left join contratos c on c.id = cd.contrato_id
left join partidas p on p.id = c.partida_id
order by estado desc, t.contrato;
