-- =====================================================================
-- SIGAF - Sistema Integral de Gestión y Avance de Facturación
-- HGZ No. 02 - Departamento de Finanzas
-- DDL piloto: capítulo Servicios Integrales
-- Motor: PostgreSQL (Supabase)
-- =====================================================================
-- Decisiones de diseño registradas aquí porque afectan lectura futura
-- del esquema:
--  - numero_interno de contrato NO es único por sí solo (se repite en
--    renovaciones sin convención consistente de sufijo). Llave real:
--    (numero_interno, vigencia_inicio).
--  - numero_interno puede tener errores de captura; se corrige con uso
--    real via la cola de conciliación (ver ooad_import_filas.matched_factura_id).
--  - numero_ooad (formato PeopleSoft) se contempló en el diseño original
--    pero NO se implementó en el esquema desplegado: la columna no existe.
--  - Un mes por factura (regla de mayoría de días), NO reparto entre
--    periodos. No existe tabla factura_periodos.
--  - IVA es un selector a nivel factura (16% | 0%), no por línea.
--  - Tolerancia de validación de importe: $1.00 MXN (ver CHECK más abajo
--    y constante replicada en la app).
--  - Confirmar matches de conciliación: solo roles jefe_presupuesto y
--    jefa_finanzas (ver RLS al final).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. CATÁLOGOS BASE
-- ---------------------------------------------------------------------

create table capitulos (
    id          uuid primary key default gen_random_uuid(),
    nombre      text not null unique
);

create table partidas (
    id              uuid primary key default gen_random_uuid(),
    capitulo_id     uuid not null references capitulos(id),
    cuenta_prei     text,
    nombre          text not null,
    unique (capitulo_id, cuenta_prei)
);

create table proveedores (
    id              uuid primary key default gen_random_uuid(),
    no_proveedor    text unique,          -- No. de proveedor OOAD/PeopleSoft
    razon_social    text not null
);

-- ---------------------------------------------------------------------
-- 2. CONTRATOS Y VIGENCIAS
-- ---------------------------------------------------------------------

create table contratos (
    id                      uuid primary key default gen_random_uuid(),
    numero_interno          text not null,      -- como lo captura el hospital hoy
    proveedor_id            uuid not null references proveedores(id),
    partida_id              uuid not null references partidas(id),
    administrador_contrato  text,
    adquisicion_servicio    text,
    vigencia_inicio         date not null,
    vigencia_fin            date not null,
    monto_minimo            numeric(14,2),
    monto_maximo            numeric(14,2),
    comentarios             text,
    created_at              timestamptz not null default now(),
    unique (numero_interno, vigencia_inicio),
    check (vigencia_fin >= vigencia_inicio)
);

create index idx_contratos_vigencia on contratos (vigencia_inicio, vigencia_fin);

-- Catálogo de servicios y precios por contrato (ej. laboratorio IGSA)
create table contrato_servicios (
    id                  uuid primary key default gen_random_uuid(),
    contrato_id         uuid not null references contratos(id),
    nombre_servicio     text not null,
    precio_unitario     numeric(14,4) not null,
    unique (contrato_id, nombre_servicio)
);

-- ---------------------------------------------------------------------
-- 3. USUARIOS Y ROLES
-- ---------------------------------------------------------------------

create type rol_usuario as enum ('auo', 'jefe_presupuesto', 'jefa_finanzas');

create table usuarios (
    id          uuid primary key default gen_random_uuid(),
    auth_id     uuid unique,             -- referencia a auth.users de Supabase
    nombre      text not null,
    rol         rol_usuario not null,
    activo      boolean not null default true
);

-- ---------------------------------------------------------------------
-- 4. ESTATUS DE FACTURA (flujo confirmado para Servicios Integrales,
--    exclusivamente módulo de compras / PREI II - sin bifurcación)
-- ---------------------------------------------------------------------

create type estatus_factura as enum (
    'capturada',
    'en_revision',
    'en_firmas',
    'pedido_generado',
    'en_espera_recepcion',
    'recepcionado',
    'enviada_ooad',
    'en_tramite_ooad',
    'gasto_reflejado'
);

-- Umbral fijo de días por estatus, editable sin tocar código
create table alertas_config (
    estatus         estatus_factura primary key,
    dias_umbral     integer not null
);

insert into alertas_config (estatus, dias_umbral) values
    ('capturada', 2),
    ('en_revision', 2),
    ('en_firmas', 5),
    ('pedido_generado', 5),
    ('en_espera_recepcion', 15),
    ('recepcionado', 3),
    ('enviada_ooad', 10),
    ('en_tramite_ooad', 20);
-- 'gasto_reflejado' es estatus final, no necesita umbral

-- ---------------------------------------------------------------------
-- 5. FACTURAS
-- ---------------------------------------------------------------------

create sequence folio_ingreso_seq;

create table facturas (
    id                      uuid primary key default gen_random_uuid(),
    folio_ingreso           text not null unique,   -- ej. HGZ2-INT-2026-000123
    folio_proveedor         text not null,          -- folio de la factura del proveedor

    capitulo_id             uuid not null references capitulos(id),
    partida_id              uuid not null references partidas(id),
    contrato_id             uuid not null references contratos(id),
    proveedor_id            uuid not null references proveedores(id),

    periodo_inicio          date not null,
    periodo_fin             date not null,
    mes_asignado            integer not null check (mes_asignado between 1 and 12),
    anio_asignado           integer not null,

    tasa_iva                numeric(5,4) not null default 0.16,  -- 0.16 o 0
    importe_factura         numeric(14,2) not null,              -- capturado, el que trae la factura
    subtotal_calculado      numeric(14,2),                        -- suma de factura_detalle
    iva_calculado            numeric(14,2),
    total_calculado          numeric(14,2),
    diferencia_importe       numeric(14,2) generated always as (total_calculado - importe_factura) stored,
    validacion_ok             boolean,                             -- true si |diferencia| <= 1.00

    estatus_actual           estatus_factura not null default 'capturada',
    comprobante_ooad          text unique,          -- se llena en conciliación, fase 1 o 2

    vigencia_alerta          text,                  -- 'sin_vigencia' | 'por_vencer' | null

    created_by                uuid references usuarios(id),
    created_at                 timestamptz not null default now(),

    check (periodo_fin >= periodo_inicio)
);

create index idx_facturas_estatus on facturas (estatus_actual);
create index idx_facturas_comprobante on facturas (comprobante_ooad);
create index idx_facturas_contrato on facturas (contrato_id);

-- Detalle de servicios capturados por factura (valida cantidad x precio)
create table factura_detalle (
    id                      uuid primary key default gen_random_uuid(),
    factura_id              uuid not null references facturas(id) on delete cascade,
    contrato_servicio_id    uuid not null references contrato_servicios(id),
    cantidad                numeric(12,2) not null check (cantidad >= 0),
    importe_calculado       numeric(14,2) generated always as (cantidad * 0) stored
    -- nota: el importe real se calcula en la aplicación (cantidad * precio_unitario
    -- del contrato_servicio referenciado) y se escribe explícitamente, porque
    -- una columna generada no puede hacer join contra otra tabla. Ajustar en
    -- capa de aplicación o via trigger before insert/update si se prefiere
    -- forzarlo a nivel de base de datos.
);

-- Historial de estatus: aquí viven las fechas automáticas por etapa
create table factura_estatus_historial (
    id              uuid primary key default gen_random_uuid(),
    factura_id      uuid not null references facturas(id) on delete cascade,
    estatus         estatus_factura not null,
    usuario_id      uuid references usuarios(id),
    fecha           timestamptz not null default now(),
    comentario      text
);

create index idx_hist_factura on factura_estatus_historial (factura_id, fecha);

-- ---------------------------------------------------------------------
-- 6. CONCILIACIÓN CON REPORTES OOAD
-- ---------------------------------------------------------------------

create type tipo_reporte_ooad as enum ('pagado', 'en_tramite');

create table ooad_import_lotes (
    id                  uuid primary key default gen_random_uuid(),
    archivo_origen      text not null,
    tipo_reporte        tipo_reporte_ooad not null,
    fecha_carga         timestamptz not null default now(),
    cargado_por         uuid references usuarios(id),
    filas_totales       integer,
    filas_conciliadas   integer default 0
);

-- Staging de cada fila del reporte. Se mapea por NOMBRE de columna al
-- cargar, nunca por posición (los reportes "pagado" y "en_tramite"
-- no comparten el mismo layout: 92 vs 84 columnas, orden distinto).
create table ooad_import_filas (
    id                  uuid primary key default gen_random_uuid(),
    lote_id             uuid not null references ooad_import_lotes(id) on delete cascade,
    comprobante         text not null,
    no_proveedor        text,
    nombre_proveedor    text,
    contrato_ooad       text,
    factura_texto       text,         -- campo "Factura" crudo, no confiable para parseo directo
    importe             numeric(14,2),
    estado_pago         text,         -- 'P' pagado | 'N' en trámite
    fecha_pago          date,
    matched_factura_id  uuid references facturas(id),
    matched_at          timestamptz,
    matched_by          uuid references usuarios(id)
);

create index idx_ooad_comprobante on ooad_import_filas (comprobante);
create unique index idx_ooad_comprobante_activo on ooad_import_filas (comprobante)
    where matched_factura_id is not null;

-- ---------------------------------------------------------------------
-- 7. RLS - permisos por rol
-- ---------------------------------------------------------------------

alter table facturas enable row level security;
alter table ooad_import_filas enable row level security;
alter table factura_detalle enable row level security;

-- Lectura: todos los roles autenticados ven las facturas de su capítulo
create policy facturas_select on facturas
    for select using (auth.uid() is not null);

-- Captura: AUO puede insertar.
-- NOTA: sigaf_rls_completo.sql reescribe esta política para usar
-- public.mi_rol() (fix de recursión infinita) y agrega facturas_update_auo.
create policy facturas_insert_auo on facturas
    for insert with check (
        exists (
            select 1 from usuarios u
            where u.auth_id = auth.uid() and u.rol in ('auo', 'jefe_presupuesto', 'jefa_finanzas')
        )
    );

-- Confirmar conciliación: SOLO jefe_presupuesto y jefa_finanzas
create policy ooad_confirmar_match on ooad_import_filas
    for update using (
        exists (
            select 1 from usuarios u
            where u.auth_id = auth.uid() and u.rol in ('jefe_presupuesto', 'jefa_finanzas')
        )
    );

create policy ooad_select on ooad_import_filas
    for select using (auth.uid() is not null);

-- =====================================================================
-- PENDIENTE ANTES DE MIGRAR DATOS REALES:
--   1. Cargar catálogo de capitulos/partidas (ya extraído de
--      Copia_de_CATALOGO_CAPITULOS.xlsx).
--   2. Cargar los 18 contratos de Servicios Integrales
--      (CONTRATOS_SERVICIOS_INTEGRALES.xlsx).
--   3. Cargar los 217 servicios de IGSA con precio_unitario
--      (PRUEBA_CONTRATO_IGSA.xlsx) como caso de prueba real, incluyendo
--      la factura FVR-0203124 para validar el flujo completo.
--   4. Definir el trigger o lógica de aplicación que calcula
--      subtotal_calculado / iva_calculado / total_calculado /
--      validacion_ok en factura_detalle -> facturas.
-- =====================================================================
