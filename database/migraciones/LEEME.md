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
| 000 | `000_inventario_esquema.sql` | Lista el esquema real (columnas, llaves, políticas, enums, triggers) para versionarlo | No (solo lectura) | 29/10/2026 |
| 001 | `001_candado_ooad_en_tramite.sql` | El candado de envío a pago también aplica al oficio EP ("En trámite OOAD"); deja pasar lo que el sistema ya registró con CR. Al final lista las facturas que hoy están en OOAD sin cumplir el candado | No | 29/10/2026 · 183 facturas en OOAD sin firmas/P&R registradas ni CR |
| 002 | `002_folios_consecutivos.sql` | Contador por serie y año para folios OF-CUM, OF-INC, ACU-DEV y EF-CE (formato `OF-CUM-0001/2026`) | No | 29/10/2026 |
| 003 | `003_permisos_rls.sql` | Solo Finanzas emite oficios y carga la dispo; solo admin edita jefes/administradores; validaciones: el jefe/Subdirector o Finanzas | No | 29/10/2026 · Finanzas: Ventanilla 1-3 (auo), Gabriel (jefe_presupuesto), Nayeli Alonso (jefa_finanzas) |
| 004 | `004_cerrar_huecos_permisos.sql` | Quita la política abierta de `ajustes_devengo` (escritura para cualquiera) y protege `stg_51251013` | No | 29/10/2026 |
| 005 | `005_exportar_facturas_en_ooad.sql` | Exporta las facturas en OOAD sin CR para cruzarlas con los comprobantes | No (solo lectura) | 29/10/2026 · 238 facturas |
| 006 | `006_puesta_al_dia_cr_29oct.sql` | Puesta al día aprobada por Gabriel: CR a 187 facturas (120 pagadas con fecha, 67 en trámite), firmas y P&R. Solo toca las que siguen en OOAD sin CR | **Sí** (187 facturas) | 29/10/2026 · 187 de 187 (120 pagadas, 67 en trámite) |

## Lo que mostró el inventario (000) y no estaba en el repo
- Tablas que existen en Supabase sin su CREATE en el repo: `contra_recibos`, `entregas`, `factura_paradas`, `jefaturas`, `oficios_devolucion`, `oficio_devolucion_facturas`, `ooad_cortes`, `ooad_corte_filas`, `pedidos_recepcion`, `stg_51251013` (usan la función `es_usuario_activo()`).
- `ajustes_devengo` tenía la política `ajustes_devengo_auth` abierta (se corrige en la 004).
- `facturas.comprobante_ooad` es único; `alertas_config.estatus` es texto y `circuito` es el enum `tipo_circuito`.

## Orden para la Fase 0
`000` (guardar resultado) → `001` → `002` → `003` → publicar la versión de la app de la rama `fase0-cimientos`.
La app nueva necesita la `002` para los folios de validación; si se publica antes, el botón de guardar oficio de validación avisará que falta la migración.
| 007 | `007_cedula_dispo_resumen.sql` | Fase 1: tablas de dispo completa (cortes, historia por cuenta y mes, detalle vigente), bloques de la hoja resumen (158) y presupuesto inicial 2026 (105, de la hoja pto) | No (crea tablas y catálogos nuevos) | 29/10/2026 · 158 bloques, 105 cuentas, $392,399,569 |
| 008 | `008_cedula_modo_devengado.sql` | Criterio de Pasivo/Devengado por cuenta igual que la cédula (56 facturas, 52 sistema, 50 vacío) | No (solo catálogo) | 29/10/2026 |
| 009 | `009_hemodialisis_mty_a_51331014.sql` | Corrección: contratos de hemodiálisis intramuros de Reactivos y Químicos (y sus 12 facturas, $12,816,271.60) de la 51331002 a la 51331014; cuadra con el gasto del sistema | **Sí** (3 contratos, 12 facturas) | 29/10/2026 · 51331014 = 14 facturas $14,851,309.48 (= sistema) |
| 010 | `010_alta_igsa_fvr00923.sql` | Alta de IGSA FVR-00923 (julio, $2,207,720.93, CR 00471175 pagado) que faltaba; 51331013 queda igual al sistema | **Sí** (1 factura nueva) | — |
