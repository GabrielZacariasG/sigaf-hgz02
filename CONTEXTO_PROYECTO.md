# CONTEXTO COMPLETO — SIGAF (HGZ No. 02)

Este documento resume TODO lo decidido hasta ahora sobre este proyecto,
en una conversación aparte con Claude (no en esta sesión de Claude Code).
Léelo completo antes de escribir o modificar cualquier código. Si algo
del código actual del repo contradice lo que dice aquí, dilo explícitamente
en vez de asumir — puede que el repo esté desactualizado o que este
documento necesite corrección.

---

## 1. Qué es SIGAF y para quién

**SIGAF = Sistema Integral de Gestión y Avance de Facturación.**

Lo construye Gabriel Zacarias, Jefe de la Oficina de Presupuesto,
Departamento de Finanzas, **Hospital General de Zona No. 02 (HGZ 02)**,
una unidad del **IMSS**. Es institucional, no un producto comercial —
el diseño debe sentirse formal y oficial (colores del IMSS, tono serio).

**Reemplaza un proceso manual en Excel** ("cédula de gasto") que hoy
tiene: cientos de errores #REF!, más de 37 valores de estatus en texto
libre sin estandarizar, rangos de SUMA fijos que excluyen filas nuevas
silenciosamente, y dependencias de múltiples libros externos.

**SIGAF NO reemplaza FINAT** (el sistema institucional del IMSS, basado
en PeopleSoft, a nivel OOAD). SIGAF alimenta información hacia FINAT,
son sistemas complementarios, no competidores.

### Roles y quién lo usa
- **AUO** (Auxiliar Universal de Oficina) — 2 o 3 personas. Reciben la
  factura en ventanilla, la sellan, y hacen la captura inicial. Rol en
  el sistema: `auo`.
- **Gabriel** (Jefe de Oficina de Presupuesto) — revisa, da seguimiento,
  visibilidad total. Rol: `jefe_presupuesto`.
- **Jefa del Departamento de Finanzas** — supervisión, reportes,
  autoridad para confirmar conciliaciones junto con Gabriel. Rol:
  `jefa_finanzas`.
- Analista — a futuro, dueño del seguimiento del circuito de firmas
  (no implementado aún).

---

## 2. El proceso real (as-is) que SIGAF digitaliza

1. El proveedor trae la factura física a **ventanilla**.
2. El **AUO** la recibe y le sella al proveedor.
3. El AUO captura folio de factura, importe y proveedor en su control
   (hoy Excel, a futuro SIGAF).
4. Pasa a Gabriel para revisión, y se manda al servicio a **recolectar
   firmas**.
5. **Bifurcación institucional** (importante, aunque el piloto actual
   solo usa una rama):
   - **PREI I**: se verifica presupuesto y se manda directo a trámite
     de pago.
   - **PREI II / módulo de compras**: se solicita **pedido y
     recepción**, que no se dan al instante — las facturas quedan en
     espera de respuesta por correo, sin SLA fijo.
6. Se envía a la **OOAD** (Organismo de Operación Administrativa
   Desconcentrada), que trabaja con PeopleSoft. SIGAF **no controla**
   el pago en sí, solo da seguimiento hasta que el gasto se refleja.
7. OOAD emite un **contra-recibo** (número de comprobante), valida
   presupuestalmente, y el gasto se refleja en el hospital. Ahí
   termina el proceso para SIGAF.

**Regla de negocio crítica**: el gasto se reconoce presupuestalmente en
la etapa de pedido/recepción, **no en el pago** — el presupuesto ya
cuenta la factura antes de que salga del hospital hacia OOAD. Esto debe
preservarse en cualquier reporte o cálculo.

---

## 3. Alcance del piloto actual

**Capítulo: Servicios Integrales exclusivamente.**
- 18 contratos, 9 proveedores, 15 partidas (cuentas contables).
- Este capítulo **usa únicamente el módulo de compras (PREI II)** — es
  decir, para Integrales **no hay bifurcación** de rutas. Todas las
  facturas de este capítulo pasan por pedido y recepción.
- A futuro se planea expandir a los capítulos "Área médica" y
  "Servicios subrogados", que sí podrían necesitar la bifurcación
  PREI I / PREI II. El modelo de datos ya contempla esto (campo
  `tipo_ruta` a nivel contrato), pero el piloto no lo ejercita.

---

## 4. Flujo de estatus confirmado (Servicios Integrales)

```
capturada → en_revision → en_firmas → pedido_generado →
en_espera_recepcion → recepcionado → enviada_ooad →
en_tramite_ooad → gasto_reflejado
```

Cada cambio de estatus debe quedar registrado con fecha automática en
`factura_estatus_historial` (ya implementado vía trigger en la base de
datos — ver sección 6).

**Alertas de estancamiento**: umbral **fijo en días por estatus** (no
promedio dinámico, al menos por ahora), configurable en la tabla
`alertas_config`, editable sin tocar código.

---

## 5. Reglas de negocio confirmadas (no negociables sin decisión explícita)

- **Clasificación heredada, no capturada dos veces**: la meta de largo
  plazo es que el AUO **solo identifique el contrato**, y el sistema
  derive automáticamente capítulo, cuenta, proveedor, IVA, jefatura
  validadora, administrador de contrato, si requiere pedido/recepción,
  etc. El formulario actual (capítulo fijo → partida → contrato →
  proveedor en cascada) es un paso intermedio válido para el piloto,
  pero el destino final es simplificar aún más: elegir contrato y que
  todo lo demás se autocomplete.
- **La fecha de sello controla los plazos**, no la fecha de captura en
  el sistema.
- **Un solo mes por factura**, nunca reparto entre periodos. Regla:
  mayoría de días dentro del periodo capturado. En caso de empate
  50/50, se asigna al mes de la fecha de término (supuesto declarado,
  no verificado con caso real todavía).
- **Nunca hay facturas trimestrales** — el periodo de una factura toca
  como máximo dos meses calendario.
- **IVA es un selector por factura**: 16% o "No aplica" — nunca por
  línea de detalle.
- **Tolerancia de validación de importe: $1.00 MXN.** La validación es:
  `Σ(cantidad × precio_unitario del catálogo del contrato) × (1 + tasa_iva)`
  debe coincidir con el importe capturado de la factura, dentro de esa
  tolerancia.
- **Número de contrato**: existen dos campos, `numero_interno` (como lo
  captura hoy el hospital, puede tener errores) y `numero_ooad` (el
  formato real de PeopleSoft, fuente de verdad). El campo `numero_ooad`
  se llena progresivamente vía conciliación con los reportes de OOAD,
  no se fuerza a corregir manualmente los 18 contratos de golpe.
- **Vigencia de contrato**: debe generar alerta automática (no solo
  nota de texto) cuando el periodo capturado de una factura cae fuera
  de la vigencia del contrato, o cuando la vigencia está por vencer
  (umbral: 30 días).
- **Conciliación con OOAD**: se hace por lotes, subiendo el reporte
  descargable que existe en dos variantes (facturas "en trámite de
  pago" y "ya pagadas"), ambas con la columna `Comprobante` como llave
  persistente. Primera aparición de un comprobante = match manual
  asistido (por proveedor + importe + folio); apariciones siguientes =
  automático por comprobante ya guardado. **Confirmar un match está
  restringido a los roles `jefe_presupuesto` y `jefa_finanzas`
  únicamente** (regla de RLS, no solo de UI).
- **Refacturación y devoluciones**: facturas refacturadas deben
  enlazarse a su predecesora; devoluciones se rastrean vía oficio (que
  puede cubrir varias facturas). Necesario para métricas de tiempo de
  ciclo reales. **No implementado todavía.**

---

## 6. Estado real de la infraestructura y base de datos

- **GitHub**: repo privado `GabrielZacariasG/sigaf-hgz02`.
- **Vercel**: proyecto `sigaf-hgz02`, conectado al repo, con las
  variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` ya configuradas correctamente
  (verificado, el login y la inserción de pruebas ya funcionaron en
  producción).
- **Supabase**: proyecto "SIGAF HGZ02". El esquema completo, los datos
  semilla reales (18 contratos, 215 servicios del contrato IGSA, 157
  partidas de los 10 capítulos), los triggers de cálculo automático, y
  las políticas RLS **ya están corridos y verificados en la base de
  datos real**. Los 4 scripts SQL que los crearon (nombrados
  `sigaf_schema_piloto.sql`, `sigaf_seed_piloto.sql`,
  `sigaf_triggers_calculo.sql`, `sigaf_rls_completo.sql`) **viven en la
  conversación de Claude que diseñó esto, no están en este repo
  todavía**. Deberían copiarse a una carpeta como `/database` o `/sql`
  dentro del repo para que cualquier sesión de Claude Code pueda
  consultarlos directo, en vez de que el usuario tenga que pegar el
  resultado de una consulta cada vez.
- Ya existe un usuario real (`gabriel.zacariasg@imss.gob.mx`) con rol
  `jefe_presupuesto` en la tabla `usuarios`, vinculado a su `auth_id`
  de Supabase Auth.
- Ya se insertaron facturas de prueba reales vía el formulario
  (`HGZ2-INT-2026-000001` y `000002`), confirmando que el flujo
  login → captura → inserción con RLS funciona de extremo a extremo.

**Esquema de tablas relevantes (confirmado por consulta directa a
information_schema):**
- `capitulos(id, nombre)` — el capítulo del piloto se llama exactamente
  `Integrales` (con mayúscula inicial solamente, sin la palabra
  "Servicios").
- `partidas(id, capitulo_id, cuenta_fiat, cuenta_prei, nombre)`
- `proveedores(id, no_proveedor, razon_social)`
- `contratos(id, numero_interno, numero_ooad, proveedor_id, partida_id,
  adquisicion_servicio, vigencia_inicio, vigencia_fin, monto_minimo,
  monto_maximo)`
- `contrato_servicios(id, contrato_id, nombre_servicio, precio_unitario)`
  — catálogo de servicios y precios por contrato, usado para la
  validación de detalle (ver mockup 3, sección 8).
- `facturas(id, folio_ingreso, folio_proveedor, capitulo_id,
  partida_id, contrato_id, proveedor_id, periodo_inicio, periodo_fin,
  mes_asignado, anio_asignado, tasa_iva, importe_factura,
  subtotal_calculado, iva_calculado, total_calculado, validacion_ok,
  estatus_actual [enum], comprobante_ooad, vigencia_alerta,
  created_by, created_at)`
- `factura_detalle(id, factura_id, contrato_servicio_id, cantidad,
  importe_calculado)`
- `factura_estatus_historial(id, factura_id, estatus, usuario_id,
  fecha, comentario)`
- `usuarios(id, auth_id, nombre, rol [auo|jefe_presupuesto|
  jefa_finanzas], activo)`
- `alertas_config(estatus, dias_umbral)`
- `ooad_import_lotes` / `ooad_import_filas` — staging de conciliación.

**IMPORTANTE**: el folio de factura del proveedor (`folio_proveedor`)
puede repetirse entre proveedores distintos — no es único globalmente.

---

## 7. Identidad visual (ya decidida, no rediseñar)

- Nombre del sistema: **SIGAF**, subtítulo "HGZ No. 02 · Departamento
  de Finanzas" (o "Hospital General de Zona No. 02 · Oficina de
  Presupuesto", como aparece en la captura de producción actual).
- Color primario: **verde institucional IMSS PMS 561** → `#00594C`.
- Ámbar para alertas/advertencias (vigencia por vencer, etc.):
  `#B45309`.
- Rojo para errores/discrepancias: `#B91C1C`.
- Fondo claro, texto gris oscuro (nunca negro puro).
- Tono visual: sobrio, oficial, sin elementos decorativos — se diseñó
  explícitamente para no sentirse como producto comercial.

---

## 8. Visión completa de las pantallas (5 mockups ya validados con el usuario)

Estas 5 pantallas representan el recorrido completo que SIGAF debe
cubrir. El piloto actual solo tiene construida una versión parcial de
la #2. Aquí está la visión completa para dar dirección al resto del
desarrollo:

1. **Login** — ya construido y funcionando (correo + contraseña,
   maneja también el flujo de invitación/recuperación de Supabase con
   `#type=invite` / `#type=recovery`).

2. **Captura de factura por el AUO** — parcialmente construida en
   `/facturas/nueva`. Lo ya construido: folio de ingreso automático,
   selects en cascada capítulo(fijo)→partida→contrato→proveedor
   (autocompletado), folio de factura del proveedor, periodo (inicio/
   fin), importe capturado. **Lo que falta de la visión original**:
   - Cálculo automático del `mes_asignado` visible en pantalla (regla
     de mayoría de días) — hoy no está confirmado si el formulario lo
     muestra o solo lo calcula en base de datos.
   - Alerta visual de vigencia del contrato (banner ámbar/rojo) al
     seleccionar contrato y periodo — mockeado pero no confirmado como
     implementado.

3. **Detalle de servicios y validación** — **no construida todavía**.
   Debe mostrar, tras capturar los datos básicos: tabla de servicios
   del contrato seleccionado (de `contrato_servicios`), con cantidad
   editable por el AUO, cálculo automático de importe por línea
   (cantidad × precio_unitario), subtotal, selector de IVA (16% / No
   aplica), total calculado, y comparación contra el importe capturado
   de la factura con tolerancia de $1.00 — mostrando visualmente si
   coincide (verde) o hay discrepancia (rojo).

4. **Seguimiento de estatus** — **no construida todavía**. Vista tipo
   línea de tiempo/stepper por factura, mostrando cada etapa del flujo
   de estatus (sección 4) con su fecha (de `factura_estatus_historial`)
   y alerta visual si lleva más días de los permitidos en
   `alertas_config` para esa etapa.

5. **Conciliación con OOAD** — **no construida todavía**. Pantalla para
   subir el reporte de OOAD (Excel/.xls), que se parsea a
   `ooad_import_filas`, y muestra una cola de conciliación con
   candidatos de match (por proveedor + importe + folio) para
   confirmar o descartar. **El botón de confirmar match debe estar
   restringido a roles `jefe_presupuesto` y `jefa_finanzas`** —ya
   existe la política RLS para esto en la base de datos.

**Nota sobre lo visto en producción hoy**: el usuario reporta que
`sigaf-hgz02.vercel.app` muestra actualmente un panel principal con 6
tarjetas ("Paso 1 Ingreso de facturas", "Paso 2 Circuito de firmas",
"Paso 3 Pedido y recepción", "Paso 4 Envío a OOAD", "Paso 5
Conciliación", "Consulta Catálogos"), todas marcadas "En construcción",
con la tarjeta de "Envío a OOAD" mostrando "2 facturas capturadas"
(coincide con las 2 facturas de prueba insertadas). **Esto no coincide
exactamente con lo que se reportó haber construido en la sesión previa
de Claude Code** (que describía `page.js` como una pantalla simple de
"Bienvenido a SIGAF"). Antes de continuar con cualquier tarea nueva,
haz un inventario real de:
- Qué páginas/rutas existen hoy en el repo (`app/**/page.js`).
- Cuál es el contenido real de la página de inicio actual.
- Si la tarjeta "Ingreso de facturas" del panel ya enlaza a
  `/facturas/nueva` (el usuario reporta que no, que "ni siquiera tiene
  habilitado para capturar").

Reporta lo que encuentres antes de asumir que coincide con este
documento o con lo reportado en sesiones anteriores.

---

## 9. Principio general de trabajo con el usuario

Gabriel **no es una persona de sistemas**. Prefiere:
- Explicaciones directas, sin jerga sin explicar.
- Trabajar por partes, confirmando cada paso antes de avanzar.
- Que se le señale con claridad cuándo algo no está resuelto de verdad
  (por ejemplo, no dar por bueno un build solo porque "no marca error"
  sin verificar el resultado real).
- Decisiones de diseño explicadas con su razón práctica, no solo
  aplicadas en silencio.

Cuando algo quede ambiguo entre este documento y el estado real del
código, o cuando haga falta un dato de negocio que no esté aquí (por
ejemplo, el nombre exacto de una columna nueva, o una regla no
cubierta), pregúntalo explícitamente en vez de asumir.
