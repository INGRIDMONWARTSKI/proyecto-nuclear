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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (caso_id, orden)
);

comment on table public.escenarios is 'Escenas ordenadas de un caso psicologico.';

create index if not exists escenarios_caso_id_idx
  on public.escenarios (caso_id);

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
