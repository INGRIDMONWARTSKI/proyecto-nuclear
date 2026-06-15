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
