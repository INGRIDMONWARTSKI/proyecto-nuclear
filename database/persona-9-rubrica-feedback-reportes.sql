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
