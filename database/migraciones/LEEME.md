# Migraciones de SIGAF (desde el 28/10/2026)

A partir de la Fase 0, todo cambio a la base de datos va aquí, **numerado y en orden**.
Los ~96 scripts sueltos de `database/` quedan como historia; no se vuelven a correr.

## Cómo se corre una migración
1. Abrir Supabase → SQL Editor.
2. Copiar el archivo completo y dar **Run**.
3. Revisar el resultado de las consultas de verificación del final del archivo.
4. Anotar aquí la fecha en que se corrió.

## Lista

| # | Archivo | Qué hace | Toca datos | Corrida |
|---|---|---|---|---|
| 000 | `000_inventario_esquema.sql` | Lista el esquema real (columnas, llaves, políticas, enums, triggers) para versionarlo | No (solo lectura) | — |
| 001 | `001_candado_ooad_en_tramite.sql` | El candado de envío a pago también aplica al oficio EP ("En trámite OOAD"); deja pasar lo que el sistema ya registró con CR. Al final lista las facturas que hoy están en OOAD sin cumplir el candado | No | — |
| 002 | `002_folios_consecutivos.sql` | Contador por serie y año para folios OF-CUM, OF-INC, ACU-DEV y EF-CE (formato `OF-CUM-0001/2026`) | No | — |
| 003 | `003_permisos_rls.sql` | Solo Finanzas emite oficios y carga la dispo; solo admin edita jefes/administradores; validaciones: el jefe/Subdirector o Finanzas | No | — |

## Orden para la Fase 0
`000` (guardar resultado) → `001` → `002` → `003` → publicar la versión de la app de la rama `fase0-cimientos`.
La app nueva necesita la `002` para los folios de validación; si se publica antes, el botón de guardar oficio de validación avisará que falta la migración.
