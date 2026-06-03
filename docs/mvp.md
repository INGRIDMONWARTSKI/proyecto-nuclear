# MVP del Proyecto

## Objetivo del MVP

Entregar un simulador interactivo academico que permita a un estudiante iniciar sesion, recorrer un caso psicologico, analizar un escenario, seleccionar una decision, recibir retroalimentacion y obtener un resultado final.

## Funcionalidades obligatorias

El MVP obligatorio debe incluir:

- Login por rol.
- Acceso del estudiante.
- Visualizacion de un caso psicologico.
- Visualizacion de un escenario.
- Seleccion de una decision.
- Retroalimentacion inmediata.
- Resultado o cierre de la simulacion.

## Funcionalidades ya implementadas

Actualmente el repositorio ya implementa:

- Autenticacion (login, logout, perfil autenticado).
- Usuarios (registro y consulta con permisos).
- Roles (control de acceso por rol).
- Grupos academicos (crear, consultar, actualizar, desactivar).
- Asignacion y remocion de estudiantes por grupo.
- Salon interactivo asociado al detalle de grupo.
- Backend de simulacion para casos y escenarios.
- Backend de configuracion pedagogica: preguntas, opciones, retroalimentaciones.
- Endpoint de preview docente y publicacion de caso con validaciones de completitud.
- Backend de ejecucion de simulacion: iniciar sesion, escenario actual, responder, finalizar y consultar resultado.
- Endpoint docente para consultar evidencias basicas de sesiones por caso.
- Frontend estudiante basico: listado de casos publicados, player, retroalimentacion inmediata y pantalla de resultado.
- Frontend docente basico: gestion de casos, escenarios, decisiones, retroalimentacion, preview y publicacion.

## Funcionalidades pendientes

Para cumplir el MVP del simulador, aun falta construir:

- Editor visual docente (elementos de escena, assets prediseñados, sin drag and drop avanzado en esta fase).
- Pruebas E2E completas del flujo docente/estudiante.

## Funcionalidades fuera del alcance actual

En esta fase no se considera:

- Motor de simulacion multi-caso con editor avanzado.
- Analitica avanzada por docente.
- Reporteria compleja o dashboards de desempeno.
- Cambios arquitectonicos mayores del monolito modular.

## Riesgos si no se implementa el modulo de simulacion

- El producto se percibira como gestor de grupos y no como simulador psicologico.
- El objetivo academico principal quedara incompleto.
- Se debilita la trazabilidad entre problema, requisitos y resultado.
- Se incrementa el riesgo de observaciones criticas en evaluacion docente.

## Nota de alineacion

Los modulos de grupos y salon interactivo son de apoyo academico, pero no reemplazan el simulador de casos psicologicos.
