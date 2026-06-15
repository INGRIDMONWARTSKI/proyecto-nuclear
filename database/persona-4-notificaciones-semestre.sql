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
