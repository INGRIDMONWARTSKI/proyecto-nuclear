alter table if exists public.usuarios
  add column if not exists "puedeCrearCasos" boolean not null default false;

update public.usuarios
set "puedeCrearCasos" = true
where role in ('ADMIN', 'PROFESOR')
  and "puedeCrearCasos" = false;
