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
