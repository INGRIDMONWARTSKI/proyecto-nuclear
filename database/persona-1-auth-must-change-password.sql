-- Requiere persona-1-auth.sql (tabla public.usuarios).
-- Usuarios existentes conservan mustChangePassword = false.

alter table public.usuarios
  add column if not exists "mustChangePassword" boolean not null default false;
