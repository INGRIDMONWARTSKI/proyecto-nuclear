-- Requiere persona-1-auth.sql (tabla public.usuarios, funcion set_updated_at).
-- Roles: enum user_role en columna usuarios.role (ADMIN, PROFESOR, ESTUDIANTE).
-- Convencion de columnas: camelCase entre comillas, igual que public.usuarios.

create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
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
