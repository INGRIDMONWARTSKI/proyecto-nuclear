-- MENTORA / Proyecto Nuclear
-- Archivo de inicializacion manual para Railway PostgreSQL.
-- Este archivo concatena las migraciones SQL existentes del proyecto
-- en orden de aplicacion. No reemplaza los archivos originales.

-- ============================================================================
-- persona-1-auth.sql
-- ============================================================================
create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'user_role'
  ) then
    create type user_role as enum ('ADMIN', 'PROFESOR', 'ESTUDIANTE');
  end if;
end
$$;

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  "fullName" text not null,
  email text not null unique,
  "passwordHash" text not null,
  role user_role not null,
  "tokenVersion" integer not null default 0,
  "isActive" boolean not null default true,
  "mustChangePassword" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists usuarios_set_updated_at on public.usuarios;

create trigger usuarios_set_updated_at
before update on public.usuarios
for each row
execute function public.set_updated_at();

-- ============================================================================
-- persona-1-auth-recovery.sql
-- ============================================================================
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.usuarios (id) on delete cascade,
  "tokenHash" text not null,
  "expiresAt" timestamptz not null,
  "consumedAt" timestamptz null,
  "createdAt" timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_id_idx
  on public.password_reset_tokens ("userId");

create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens ("expiresAt");

-- ============================================================================
-- persona-1-auth-must-change-password.sql
-- ============================================================================
-- Requiere persona-1-auth.sql (tabla public.usuarios).
-- Usuarios existentes conservan mustChangePassword = false.

alter table public.usuarios
  add column if not exists "mustChangePassword" boolean not null default false;

-- ============================================================================
-- persona-2-grupos.sql
-- ============================================================================
-- Requiere persona-1-auth.sql (tabla public.usuarios, funcion set_updated_at).
-- Roles: enum user_role en columna usuarios.role (ADMIN, PROFESOR, ESTUDIANTE).
-- Convencion de columnas: camelCase entre comillas, igual que public.usuarios.

create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  semestre text,
  "profesorId" uuid not null references public.usuarios (id),
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists grupos_profesor_id_idx
  on public.grupos ("profesorId");

create index if not exists grupos_is_active_idx
  on public.grupos ("isActive");

drop trigger if exists grupos_set_updated_at on public.grupos;

create trigger grupos_set_updated_at
before update on public.grupos
for each row
execute function public.set_updated_at();

create table if not exists public.estudiante_grupo (
  id uuid primary key default gen_random_uuid(),
  "grupoId" uuid not null references public.grupos (id) on delete cascade,
  "estudianteId" uuid not null references public.usuarios (id),
  "createdAt" timestamptz not null default now(),
  unique ("grupoId", "estudianteId")
);

create index if not exists estudiante_grupo_grupo_id_idx
  on public.estudiante_grupo ("grupoId");

create index if not exists estudiante_grupo_estudiante_id_idx
  on public.estudiante_grupo ("estudianteId");

-- ============================================================================
-- persona-3-simulacion.sql
-- ============================================================================
-- Requiere persona-1-auth.sql (tabla public.usuarios).
-- Modelo SQL minimo del modulo de simulacion.

create extension if not exists pgcrypto;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Casos psicologicos creados por docentes.
create table if not exists public.casos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  objetivo_aprendizaje text,
  autor_docente_id uuid not null references public.usuarios (id),
  estado text not null default 'draft'
    check (estado in ('draft', 'published', 'archived')),
  is_active boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.casos is 'Casos psicologicos para simulacion academica.';

create index if not exists casos_autor_docente_id_idx
  on public.casos (autor_docente_id);

create index if not exists casos_estado_idx
  on public.casos (estado);

drop trigger if exists casos_set_updated_at on public.casos;
create trigger casos_set_updated_at
before update on public.casos
for each row
execute function public.update_updated_at_column();

-- Escenarios visuales asociados a cada caso.
create table if not exists public.escenarios (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  orden integer not null check (orden > 0),
  titulo text not null,
  situacion_texto text not null,
  fondo_codigo text not null,
  is_final boolean not null default false,
  layout_version integer,
  layout_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (caso_id, orden)
);

comment on table public.escenarios is 'Escenas ordenadas de un caso psicologico.';

create index if not exists escenarios_caso_id_idx
  on public.escenarios (caso_id);

alter table public.escenarios
  add column if not exists layout_version integer;

alter table public.escenarios
  add column if not exists layout_data jsonb;

drop trigger if exists escenarios_set_updated_at on public.escenarios;
create trigger escenarios_set_updated_at
before update on public.escenarios
for each row
execute function public.update_updated_at_column();

-- Elementos visuales del lienzo de cada escenario.
create table if not exists public.elementos_escena (
  id uuid primary key default gen_random_uuid(),
  escenario_id uuid not null references public.escenarios (id) on delete cascade,
  tipo text not null check (tipo in ('personaje', 'objeto', 'texto')),
  asset_codigo text,
  texto_contenido text,
  pos_x numeric(6,2) not null,
  pos_y numeric(6,2) not null,
  ancho numeric(6,2) not null check (ancho > 0),
  alto numeric(6,2) not null check (alto > 0),
  rotacion numeric(5,2) not null default 0,
  z_index integer not null default 1 check (z_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (tipo = 'texto' and texto_contenido is not null and length(trim(texto_contenido)) > 0)
    or
    (tipo in ('personaje', 'objeto') and asset_codigo is not null and length(trim(asset_codigo)) > 0)
  )
);

comment on table public.elementos_escena is 'Elementos visuales predisenados por escenario.';

create index if not exists elementos_escena_escenario_id_idx
  on public.elementos_escena (escenario_id);

drop trigger if exists elementos_escena_set_updated_at on public.elementos_escena;
create trigger elementos_escena_set_updated_at
before update on public.elementos_escena
for each row
execute function public.update_updated_at_column();

-- Pregunta de decision asociada a un escenario.
create table if not exists public.preguntas_decision (
  id uuid primary key default gen_random_uuid(),
  escenario_id uuid not null unique references public.escenarios (id) on delete cascade,
  enunciado text not null,
  tipo text not null default 'single_choice'
    check (tipo in ('single_choice')),
  puntaje_maximo integer not null default 100 check (puntaje_maximo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.preguntas_decision is 'Pregunta unica de decision por escenario.';

create index if not exists preguntas_decision_escenario_id_idx
  on public.preguntas_decision (escenario_id);

drop trigger if exists preguntas_decision_set_updated_at on public.preguntas_decision;
create trigger preguntas_decision_set_updated_at
before update on public.preguntas_decision
for each row
execute function public.update_updated_at_column();

-- Opciones de respuesta para cada pregunta.
create table if not exists public.opciones_respuesta (
  id uuid primary key default gen_random_uuid(),
  pregunta_id uuid not null references public.preguntas_decision (id) on delete cascade,
  texto text not null,
  orden integer not null check (orden > 0),
  puntaje integer not null default 0 check (puntaje >= 0),
  is_correcta boolean not null default false,
  escenario_destino_id uuid references public.escenarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pregunta_id, orden)
);

comment on table public.opciones_respuesta is 'Opciones disponibles para responder una decision.';

create index if not exists opciones_respuesta_pregunta_id_idx
  on public.opciones_respuesta (pregunta_id);

alter table public.opciones_respuesta
  add column if not exists escenario_destino_id uuid references public.escenarios (id) on delete set null;

create index if not exists idx_opciones_respuesta_escenario_destino_id
  on public.opciones_respuesta (escenario_destino_id);

drop trigger if exists opciones_respuesta_set_updated_at on public.opciones_respuesta;
create trigger opciones_respuesta_set_updated_at
before update on public.opciones_respuesta
for each row
execute function public.update_updated_at_column();

-- Retroalimentacion pedagogica por opcion elegida.
create table if not exists public.retroalimentaciones (
  id uuid primary key default gen_random_uuid(),
  opcion_id uuid not null unique references public.opciones_respuesta (id) on delete cascade,
  mensaje text not null,
  tipo text not null default 'pedagogica'
    check (tipo in ('pedagogica', 'correctiva', 'refuerzo')),
  referencia_teorica text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.retroalimentaciones is 'Retroalimentacion asociada a cada opcion.';

drop trigger if exists retroalimentaciones_set_updated_at on public.retroalimentaciones;
create trigger retroalimentaciones_set_updated_at
before update on public.retroalimentaciones
for each row
execute function public.update_updated_at_column();

-- Intentos de simulacion ejecutados por estudiantes.
create table if not exists public.sesiones_simulacion (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id),
  estudiante_id uuid not null references public.usuarios (id),
  estado text not null default 'in_progress'
    check (estado in ('in_progress', 'completed', 'abandoned')),
  puntaje_total integer not null default 0 check (puntaje_total >= 0),
  total_preguntas integer not null default 0 check (total_preguntas >= 0),
  respondidas integer not null default 0 check (respondidas >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (respondidas <= total_preguntas)
);

comment on table public.sesiones_simulacion is 'Sesiones de simulacion iniciadas por estudiantes.';

create index if not exists sesiones_simulacion_estudiante_id_idx
  on public.sesiones_simulacion (estudiante_id);

create index if not exists sesiones_simulacion_caso_id_idx
  on public.sesiones_simulacion (caso_id);

drop trigger if exists sesiones_simulacion_set_updated_at on public.sesiones_simulacion;
create trigger sesiones_simulacion_set_updated_at
before update on public.sesiones_simulacion
for each row
execute function public.update_updated_at_column();

-- Respuestas registradas por pregunta durante una sesion.
create table if not exists public.respuestas_estudiante (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.sesiones_simulacion (id) on delete cascade,
  pregunta_id uuid not null references public.preguntas_decision (id),
  opcion_id uuid not null references public.opciones_respuesta (id),
  escenario_id uuid not null references public.escenarios (id),
  puntaje_obtenido integer not null default 0 check (puntaje_obtenido >= 0),
  respondida_at timestamptz not null default now(),
  unique (sesion_id, pregunta_id)
);

comment on table public.respuestas_estudiante is 'Respuestas de estudiante por sesion y pregunta.';

create index if not exists respuestas_estudiante_sesion_id_idx
  on public.respuestas_estudiante (sesion_id);

create table if not exists public.recursos_visuales (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  escenario_id uuid references public.escenarios (id) on delete set null,
  docente_id uuid not null references public.usuarios (id),
  tipo text not null
    check (tipo in ('FONDO', 'PERSONAJE', 'OBJETO', 'ESCENA_COMPLETA')),
  nombre text not null,
  prompt_original text not null,
  prompt_final text not null,
  url_externa text not null,
  ruta_archivo text not null,
  ancho integer,
  alto integer,
  estilo text not null,
  proveedor text not null,
  created_at timestamptz not null default now()
);

comment on table public.recursos_visuales is 'Catalogo e historial de recursos visuales generados con IA.';

create index if not exists recursos_visuales_caso_id_idx
  on public.recursos_visuales (caso_id);

create index if not exists recursos_visuales_escenario_id_idx
  on public.recursos_visuales (escenario_id);

create index if not exists recursos_visuales_docente_id_idx
  on public.recursos_visuales (docente_id);

-- RF-13: asignacion de casos publicados a grupos academicos.
-- Convencion camelCase (igual que public.grupos y public.estudiante_grupo).
create table if not exists public.caso_grupo (
  id uuid primary key default gen_random_uuid(),
  "casoId" uuid not null references public.casos (id) on delete cascade,
  "grupoId" uuid not null references public.grupos (id) on delete cascade,
  "asignadoPor" uuid not null references public.usuarios (id),
  "createdAt" timestamptz not null default now(),
  unique ("casoId", "grupoId")
);

comment on table public.caso_grupo is 'Asignacion de casos publicados a grupos academicos (RF-13).';

create index if not exists caso_grupo_caso_id_idx
  on public.caso_grupo ("casoId");

create index if not exists caso_grupo_grupo_id_idx
  on public.caso_grupo ("grupoId");

-- ============================================================================
-- persona-4-notificaciones-semestre.sql
-- ============================================================================
-- Migracion segura: semestre en grupos y notificaciones internas.

alter table public.grupos
  add column if not exists semestre text;

create index if not exists grupos_semestre_idx
  on public.grupos (semestre);

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id_destino uuid not null references public.usuarios (id) on delete cascade,
  tipo varchar not null,
  titulo varchar not null,
  mensaje text not null,
  entidad_tipo varchar,
  entidad_id uuid,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notificaciones_usuario_destino_idx
  on public.notificaciones (usuario_id_destino);

create index if not exists notificaciones_usuario_leida_idx
  on public.notificaciones (usuario_id_destino, leida);

create index if not exists notificaciones_created_at_idx
  on public.notificaciones (created_at desc);

-- ============================================================================
-- persona-5-evaluacion-notas.sql
-- ============================================================================
-- Ajuste institucional de evaluacion: las respuestas se califican en escala 0.0 a 5.0.
-- Se conserva el nombre tecnico puntaje para compatibilidad con backend/frontend existentes.

alter table public.preguntas_decision
  drop constraint if exists preguntas_decision_puntaje_maximo_check;

alter table public.preguntas_decision
  alter column puntaje_maximo set default 5,
  alter column puntaje_maximo type numeric(3,1)
    using case
      when puntaje_maximo > 5 then least(puntaje_maximo / 20.0, 5)
      else puntaje_maximo
    end;

alter table public.preguntas_decision
  add constraint preguntas_decision_puntaje_maximo_check
  check (puntaje_maximo >= 0 and puntaje_maximo <= 5);

alter table public.opciones_respuesta
  drop constraint if exists opciones_respuesta_puntaje_check;

alter table public.opciones_respuesta
  alter column puntaje set default 0,
  alter column puntaje type numeric(3,1)
    using case
      when puntaje > 5 then least(puntaje / 20.0, 5)
      else puntaje
    end;

alter table public.opciones_respuesta
  add constraint opciones_respuesta_puntaje_check
  check (puntaje >= 0 and puntaje <= 5);

alter table public.respuestas_estudiante
  drop constraint if exists respuestas_estudiante_puntaje_obtenido_check;

alter table public.respuestas_estudiante
  alter column puntaje_obtenido set default 0,
  alter column puntaje_obtenido type numeric(3,1)
    using case
      when puntaje_obtenido > 5 then least(puntaje_obtenido / 20.0, 5)
      else puntaje_obtenido
    end;

alter table public.respuestas_estudiante
  add constraint respuestas_estudiante_puntaje_obtenido_check
  check (puntaje_obtenido >= 0 and puntaje_obtenido <= 5);

alter table public.sesiones_simulacion
  drop constraint if exists sesiones_simulacion_puntaje_total_check;

alter table public.sesiones_simulacion
  alter column puntaje_total set default 0,
  alter column puntaje_total type numeric(6,1)
    using case
      when puntaje_total > 5 then puntaje_total / 20.0
      else puntaje_total
    end;

alter table public.sesiones_simulacion
  add constraint sesiones_simulacion_puntaje_total_check
  check (puntaje_total >= 0);

comment on column public.opciones_respuesta.puntaje is
  'Nota configurable por el docente en escala institucional 0.0 a 5.0.';

comment on column public.respuestas_estudiante.puntaje_obtenido is
  'Nota obtenida por respuesta en escala institucional 0.0 a 5.0.';

comment on column public.sesiones_simulacion.puntaje_total is
  'Suma interna de notas de respuestas; la nota final se calcula como promedio 0.0 a 5.0.';

-- ============================================================================
-- persona-5-tiempo-maximo-simulacion.sql
-- ============================================================================
-- Migracion segura: tiempo maximo por caso y tipo de finalizacion de sesion.

alter table public.casos
  add column if not exists tiempo_maximo_minutos integer not null default 60;

alter table public.casos
  drop constraint if exists casos_tiempo_maximo_minutos_check;

alter table public.casos
  add constraint casos_tiempo_maximo_minutos_check
  check (tiempo_maximo_minutos >= 5 and tiempo_maximo_minutos <= 240);

create index if not exists casos_tiempo_maximo_minutos_idx
  on public.casos (tiempo_maximo_minutos);

alter table public.sesiones_simulacion
  add column if not exists finalizacion_tipo text;

alter table public.sesiones_simulacion
  drop constraint if exists sesiones_simulacion_finalizacion_tipo_check;

alter table public.sesiones_simulacion
  add constraint sesiones_simulacion_finalizacion_tipo_check
  check (finalizacion_tipo is null or finalizacion_tipo in ('manual', 'timeout'));

-- ============================================================================
-- persona-6-reintentos-autorizados.sql
-- ============================================================================
-- Autorizaciones puntuales para que un estudiante pueda realizar un nuevo intento.

create table if not exists public.reintentos_autorizados (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  estudiante_id uuid not null references public.usuarios (id) on delete cascade,
  docente_id uuid not null references public.usuarios (id),
  autorizado_por uuid not null references public.usuarios (id),
  motivo text,
  usado boolean not null default false,
  usado_en_sesion_id uuid references public.sesiones_simulacion (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists reintentos_autorizados_caso_estudiante_idx
  on public.reintentos_autorizados (caso_id, estudiante_id);

create unique index if not exists reintentos_autorizados_unico_pendiente_idx
  on public.reintentos_autorizados (caso_id, estudiante_id)
  where usado = false;

comment on table public.reintentos_autorizados is
  'Autorizaciones docentes de un solo uso para nuevos intentos de casos completados.';

-- ============================================================================
-- persona-7-multiples-preguntas-escenario.sql
-- ============================================================================
-- Permite múltiples preguntas de decisión por escenario.

alter table public.preguntas_decision
  drop constraint if exists preguntas_decision_escenario_id_key;

alter table public.preguntas_decision
  add column if not exists orden integer not null default 1;

alter table public.preguntas_decision
  drop constraint if exists preguntas_decision_orden_check;

alter table public.preguntas_decision
  add constraint preguntas_decision_orden_check check (orden > 0);

create unique index if not exists preguntas_decision_escenario_orden_idx
  on public.preguntas_decision (escenario_id, orden);

drop index if exists preguntas_decision_escenario_id_idx;

create index if not exists preguntas_decision_escenario_id_idx
  on public.preguntas_decision (escenario_id);

comment on table public.preguntas_decision is
  'Preguntas de decisión asociadas a escenarios. Un escenario puede tener una o varias preguntas.';

comment on column public.preguntas_decision.orden is
  'Orden pedagógico de la pregunta dentro del escenario.';

-- ============================================================================
-- persona-8-notificaciones-archivadas.sql
-- ============================================================================
-- Migracion segura: archivado de notificaciones internas.

alter table public.notificaciones
  add column if not exists archived_at timestamptz;

create index if not exists notificaciones_usuario_archived_idx
  on public.notificaciones (usuario_id_destino, archived_at);

create index if not exists notificaciones_usuario_leida_archived_idx
  on public.notificaciones (usuario_id_destino, leida, archived_at);

-- ============================================================================
-- persona-9-permisos-docente-casos.sql
-- ============================================================================
alter table if exists public.usuarios
  add column if not exists "puedeCrearCasos" boolean not null default false;

update public.usuarios
set "puedeCrearCasos" = true
where role in ('ADMIN', 'PROFESOR')
  and "puedeCrearCasos" = false;

-- ============================================================================
-- persona-9-rubrica-feedback-reportes.sql
-- ============================================================================
-- Migracion segura: rubrica formal, retroalimentacion general docente y soporte de reportes.

create table if not exists public.rubrica_criterios (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  criterio text not null,
  descripcion text not null,
  nivel_esperado text,
  peso numeric(5,2),
  orden integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rubrica_criterios_orden_check check (orden > 0),
  constraint rubrica_criterios_peso_check check (peso is null or peso >= 0)
);

create index if not exists rubrica_criterios_caso_idx
  on public.rubrica_criterios (caso_id);

create unique index if not exists rubrica_criterios_caso_orden_idx
  on public.rubrica_criterios (caso_id, orden);

alter table public.sesiones_simulacion
  add column if not exists retroalimentacion_docente_general text,
  add column if not exists retroalimentacion_docente_at timestamptz,
  add column if not exists retroalimentacion_docente_by uuid references public.usuarios (id) on delete set null;

create index if not exists sesiones_simulacion_feedback_docente_idx
  on public.sesiones_simulacion (retroalimentacion_docente_by);
