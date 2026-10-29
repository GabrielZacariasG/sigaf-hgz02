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
| 010 | `010_alta_igsa_fvr00923.sql` | Alta de IGSA FVR-00923 (julio, $2,207,720.93, CR 00471175 pagado) que faltaba; 51331013 queda igual al sistema | **Sí** (1 factura nueva) | 29/10/2026 · 51331013 = 13 facturas $24,773,494.50 (= sistema) |
| 011 | `011_alta_ucn_311_313.sql` | Alta de UCN 311 y 313 (Unidad de Cuidados Nefrológicos, pasivo 2025, $11,715,976.80, CR 00452689 y 00452692 pagados); 51331002 queda igual al sistema | (no aplicó nada: ya existían) | 29/10/2026 · 0 filas; ver 011b y 011c |
| 011b | `011b_diagnostico_ucn.sql` | Diagnóstico: UCN311/313 ya existían como "devuelta_proveedor" | No (solo lectura) | 29/10/2026 |
| 011c | `011c_ucn_311_313_pagadas.sql` | UCN 311 y 313 de "devuelta" a pagadas (CR 00452689 y 00452692), pasivo 2025; 51331002 = sistema | **Sí** (2 facturas) | 29/10/2026 · 51331002 = 2 facturas $11,715,976.80 (= sistema) |
| 012 | `012_exportar_devueltas.sql` | Exporta las facturas devueltas (23) para cruzarlas con el sistema | No (solo lectura) | 29/10/2026 |
| 012b | `012b_devueltas_que_si_se_pagaron.sql` | 4 "devueltas" de la migración que el sistema tiene pagadas (Labopath 1216 y 1249 con importe corregido; ISSEA IS524 y SPHM110) | **Sí** (4 facturas) | 29/10/2026 · 4 de 4 |
| 013 | `013_buscar_importe_igual_folio.sql` | Busca facturas con el folio guardado como importe (error de migración) | No (solo lectura) | 29/10/2026 · solo 1, ya anulada |
| 014 | `014_intermet_mins9422_y_9306.sql` | Alta de Intermet MINS9422 (julio, $422,759.68, CR 00476345) y CR 00476309 a MINS9306; 51331015 = sistema | **Sí** (1 nueva + 1 actualizada) | 29/10/2026 · 51331015 = 23 facturas $6,880,853.20 (= sistema), 0 sin CR |

- **015** exportar consumo de bienes (solo lectura) · corrida 29/10, CSV pegado.
- **016** consumo de bienes vs sistema: 8 cambios de cuenta, folios Ibarra A22/B3050, 3 importes, CR, 12 en revisión ya pagadas, 2 duplicadas anuladas, 3 altas (CE-001039 Los Socios S113, 001040 Galomaya 02398, 001041 Repr. B02370). Corrida 29/10: 36 filas, todo como se esperaba.

- **017** exportar traslados (solo lectura) · corrida 29/10.
- **018** traslados: partida 52411024 + contrato PERNOCTA-REEMB, 13 altas (5 Autobuses, 8 fondo fijo), 40511 duplicada anulada, CR 00475172, Cruz Roja a la parte HGZ 2, centavos. Corrida 29/10: 52411011 = 73 fact. 2,363,189.69 (4 en trámite); 52411024 = 8 fact. 36,492.70. Tal como se esperaba. T JUN 04 (CR 00465766, cuenta 51371004) pendiente de decisión.

- **019** T JUN 04 (CR 00465766) → 51371004 Mensajería (partida + contrato FF-MENSAJERIA). Corrida 29/10: 52411011 = 72 fact. 2,360,139.63 = sistema; 51371004 = 1 fact. 3,050.06.

- **020** exportar Romo Alba (solo lectura).
- **021** Romo Alba EP-0109: 14 facturas con CR 00475194/00475201/00475204, pagadas 20/10. Corrida 29/10: 14 filas. Nota: CR 00475201 trae 4 centavos menos que SIGAF (75,660.40 vs .44).

- **022** PISA 63874122: sin doble pago (00476524 era falso positivo del cruce por folio parcial). CR 00470455, pagada 07/09. Corrida 29/10: 1 fila.

- **023** revisión candidatos (solo lectura).
- **024** PISA 640857022→64085702 CR 00471190 pagada 14/09; Prod. Hosp. 4601567994 CR 00475355 (en trámite). Corrida 29/10: 2 filas. Quedan 28 en OOAD sin comprobante al 28/10 (Baxter 4, Reliable 2, ISSEA 3, Biodist, SIE 14, PISA 2, Prod. Hosp. 4601587649, Médica San Juan 3979, Saldívar 366, P&P 8154, Abastecedora AI-104962 con CR eliminado).

- **025** export en trámite con CR (solo lectura): los 56 CR válidos siguen sin pagar al 29/10.
- **026** Biodist 51251019 CR 'SI' → CR reales pagados (56 en trámite; importes 8579 y 9240 corregidos a 68,672), Derma A1703 → 00473323 pagada, Ana Karen 4398 → 00476312. Corrido 29/10.
- **027** Biodist 'SI' restantes (solo lectura): 28 en gasto reflejado.
- **028** esas 28 con su CR real (pagados 27/10). Corrida 29/10: 28 filas.

- **029** CR no numéricos (solo lectura): solo 4, con 'DEV'.
- **030** Biodist 8258/8607 e ISSEA SP1671/SP1673 → devueltas (no tienen comprobante; ya no suman $33,782 de gasto). Corrida 29/10: 4 filas.
