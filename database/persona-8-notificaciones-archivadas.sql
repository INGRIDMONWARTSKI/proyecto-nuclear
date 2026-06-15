-- Migracion segura: archivado de notificaciones internas.

alter table public.notificaciones
  add column if not exists archived_at timestamptz;

create index if not exists notificaciones_usuario_archived_idx
  on public.notificaciones (usuario_id_destino, archived_at);

create index if not exists notificaciones_usuario_leida_archived_idx
  on public.notificaciones (usuario_id_destino, leida, archived_at);
