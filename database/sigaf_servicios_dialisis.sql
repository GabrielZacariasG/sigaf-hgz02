-- SIGAF · contrato_servicios de Diálisis Peritoneal / Mezclas / Hemodiálisis
-- Precio unitario DEDUCIDO de la hoja "integrales" del Excel (gasto ÷ bolsas/sesiones),
-- validado contra el DPCA Nuevos ya cargado ($56.63 = 6795.60/120). Convención: precio
-- por bolsa/sesión tal como aparece en la factura (misma base que el resto del catálogo diálisis).
-- Idempotente (WHERE NOT EXISTS). Contratos de soluciones son IVA 0%.
begin;

insert into contrato_servicios (contrato_id, nombre_servicio, precio_unitario)
select ct.id, v.servicio, v.precio
from (values
  ('050GYR988T00425-001-00', 'DPA soluciones - Pacientes Nuevos 2026 (por bolsa)',        152.89),
  ('050GYR988T02124-001-00', 'DPA soluciones - Pacientes Prevalentes 2026 (por bolsa)',   203.86),
  ('050GYR032N10125-109-00', 'DPA soluciones - Pacientes Prevalentes 2026 (por bolsa)',   203.86),
  ('050GYR988T02024-001-00', 'DPCA soluciones - Pacientes Prevalentes 2026 (por bolsa)',   54.90),
  ('050GYR988T00525-020-00', 'DPCA soluciones - Pacientes Nuevos 2026 (por bolsa)',        49.24),
  ('050GYR988T01924-001-00', 'Soluciones diálisis peritoneal - Prevalentes 2026 (por bolsa)', 156.82),
  ('050GYR988N00125-001-00', 'Mezcla / Nutrición Parenteral 2026 (por unidad)',           823.34),
  ('988T00323-010',          'Hemodiálisis intramuros (por sesión)',                      460.52)
) as v(num, servicio, precio)
join contratos ct on ct.numero_interno = v.num
where not exists (
  select 1 from contrato_servicios cs
  where cs.contrato_id = ct.id and cs.nombre_servicio = v.servicio
);

commit;
