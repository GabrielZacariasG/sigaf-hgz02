-- =====================================================================
-- SIGAF · Fase 1 · 008 · Criterio de Pasivo / Devengado por cuenta (igual que la cédula)
-- Fecha: 29/10/2026
--
-- La hoja "resumen" de la cédula calcula PASIVO y DEVENGADO 2026 de tres formas:
--   facturas : de las facturas registradas (cb, am, ss, integrales)           → SIGAF: facturas + ajustes de devengo
--   sistema  : pasivo 0 y devengado = gasto del sistema (Serv. generales, Conservación) → SIGAF igual
--   vacio    : sin control (bloque Otros)                                       → SIGAF lo deja en blanco
-- Se toma de las fórmulas de la propia cédula (29/10/2026). No toca otros datos.
-- =====================================================================
alter table cedula_bloques add column if not exists modo text not null default 'facturas';
alter table cedula_bloques drop constraint if exists cedula_bloques_modo_check;
alter table cedula_bloques add constraint cedula_bloques_modo_check check (modo in ('facturas', 'sistema', 'vacio'));
update cedula_bloques set modo = 'sistema' where orden in (47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 87, 91, 92, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111);
update cedula_bloques set modo = 'vacio'   where orden in (90, 93, 94, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158);
update cedula_bloques set modo = 'facturas' where orden in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 79, 80, 81, 82, 83, 84, 85, 86, 88, 89);
select modo, count(*) from cedula_bloques group by modo order by modo;