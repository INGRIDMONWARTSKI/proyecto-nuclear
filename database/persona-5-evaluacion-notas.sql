-- Ajuste institucional de evaluacion: las respuestas se califican en escala 0.0 a 5.0.
-- Se conserva el nombre tecnico puntaje para compatibilidad con backend/frontend existentes.

alter table public.preguntas_decision
  drop constraint if exists preguntas_decision_puntaje_maximo_check;

alter table public.preguntas_decision
  alter column puntaje_maximo set default 5,
  alter column puntaje_maximo type numeric(3,1)
    using case
      when puntaje_maximo > 5 then least(puntaje_maximo / 20.0, 5)
      else puntaje_maximo
    end;

alter table public.preguntas_decision
  add constraint preguntas_decision_puntaje_maximo_check
  check (puntaje_maximo >= 0 and puntaje_maximo <= 5);

alter table public.opciones_respuesta
  drop constraint if exists opciones_respuesta_puntaje_check;

alter table public.opciones_respuesta
  alter column puntaje set default 0,
  alter column puntaje type numeric(3,1)
    using case
      when puntaje > 5 then least(puntaje / 20.0, 5)
      else puntaje
    end;

alter table public.opciones_respuesta
  add constraint opciones_respuesta_puntaje_check
  check (puntaje >= 0 and puntaje <= 5);

alter table public.respuestas_estudiante
  drop constraint if exists respuestas_estudiante_puntaje_obtenido_check;

alter table public.respuestas_estudiante
  alter column puntaje_obtenido set default 0,
  alter column puntaje_obtenido type numeric(3,1)
    using case
      when puntaje_obtenido > 5 then least(puntaje_obtenido / 20.0, 5)
      else puntaje_obtenido
    end;

alter table public.respuestas_estudiante
  add constraint respuestas_estudiante_puntaje_obtenido_check
  check (puntaje_obtenido >= 0 and puntaje_obtenido <= 5);

alter table public.sesiones_simulacion
  drop constraint if exists sesiones_simulacion_puntaje_total_check;

alter table public.sesiones_simulacion
  alter column puntaje_total set default 0,
  alter column puntaje_total type numeric(6,1)
    using case
      when puntaje_total > 5 then puntaje_total / 20.0
      else puntaje_total
    end;

alter table public.sesiones_simulacion
  add constraint sesiones_simulacion_puntaje_total_check
  check (puntaje_total >= 0);

comment on column public.opciones_respuesta.puntaje is
  'Nota configurable por el docente en escala institucional 0.0 a 5.0.';

comment on column public.respuestas_estudiante.puntaje_obtenido is
  'Nota obtenida por respuesta en escala institucional 0.0 a 5.0.';

comment on column public.sesiones_simulacion.puntaje_total is
  'Suma interna de notas de respuestas; la nota final se calcula como promedio 0.0 a 5.0.';
