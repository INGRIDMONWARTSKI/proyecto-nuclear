-- Migracion segura: tiempo maximo por caso y tipo de finalizacion de sesion.

alter table public.casos
  add column if not exists tiempo_maximo_minutos integer not null default 60;

alter table public.casos
  drop constraint if exists casos_tiempo_maximo_minutos_check;

alter table public.casos
  add constraint casos_tiempo_maximo_minutos_check
  check (tiempo_maximo_minutos >= 5 and tiempo_maximo_minutos <= 240);

create index if not exists casos_tiempo_maximo_minutos_idx
  on public.casos (tiempo_maximo_minutos);

alter table public.sesiones_simulacion
  add column if not exists finalizacion_tipo text;

alter table public.sesiones_simulacion
  drop constraint if exists sesiones_simulacion_finalizacion_tipo_check;

alter table public.sesiones_simulacion
  add constraint sesiones_simulacion_finalizacion_tipo_check
  check (finalizacion_tipo is null or finalizacion_tipo in ('manual', 'timeout'));
