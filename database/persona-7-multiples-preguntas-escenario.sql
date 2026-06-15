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
