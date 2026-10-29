-- =====================================================================
-- SIGAF · Fase 3 · 048 · Tope de ampliación de contratos al 20% (definido por Gabriel, 30/10/2026)
-- Antes quedaba en 10% (como venía en "linea am"). Ej.: D6M0032 tiene ampliación de $715,026.07 = 20% de su máximo.
-- Cómo: SQL Editor → Run. Muestra cuántos contratos quedaron con 20%.
-- =====================================================================
alter table contratos alter column tope_ampliacion_pct set default 20;
update contratos set tope_ampliacion_pct = 20 where tope_ampliacion_pct = 10;
select tope_ampliacion_pct, count(*) from contratos group by 1;
