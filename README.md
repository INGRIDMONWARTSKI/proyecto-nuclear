# Simulador Interactivo de Casos Psicologicos

Proyecto academico interdisciplinario orientado a construir un simulador interactivo de casos psicologicos para apoyo academico.

## Objetivo del proyecto

Construir un software que permita analizar un caso psicologico, recorrer escenarios, seleccionar decisiones y recibir retroalimentacion para apoyar procesos de aprendizaje.

## Estructura

```text
simulador-psicologia/
├── frontend/
├── backend/
├── database/
└── docs/
```

## Estado actual del proyecto

El repositorio usa arquitectura de monolito modular y actualmente implementa:

- Autenticacion.
- Usuarios.
- Roles.
- Grupos academicos.
- Salon interactivo (visualizacion de aula y asignacion de estudiantes).

El modulo de simulacion de casos psicologicos todavia no esta implementado en su flujo completo.

## MVP pendiente

Para cumplir el MVP del simulador todavia falta implementar:

- Visualizacion de un caso psicologico.
- Visualizacion de escenario del caso.
- Seleccion de decision u opcion.
- Retroalimentacion inmediata segun la decision.
- Resultado o cierre de sesion de simulacion.

Nota: los modulos de grupos y salon interactivo son de apoyo academico, pero no reemplazan el simulador.

## Proximos pasos tecnicos

1. Documentar requisitos funcionales y no funcionales alineados al estado real.
2. Definir el modelo de datos del modulo de simulacion sin romper los modulos existentes.
3. Implementar rutas, servicios y pantallas del flujo caso -> escenario -> decision -> retroalimentacion -> resultado.
4. Actualizar pruebas QA y scripts E2E segun la interfaz vigente.
5. Endurecer seguridad en una fase posterior (registro publico, exposicion de PostgREST y manejo de credenciales demo).

## Ejecutar en local

Requisitos: Docker Desktop en ejecucion, Node.js 20+.

```bash
# Primera vez (dependencias backend y frontend)
npm run install:all

# Infraestructura (PostgreSQL + PostgREST) + backend + frontend
npm run up
```

- API: `http://localhost:3000/api`
- PostgREST: `http://localhost:3001`
- Frontend: `http://localhost:4200`

Solo infraestructura: `npm run up:infra`. Solo apps (con Docker ya levantado): `npm run up:apps`. Detener contenedores: `npm run down`.

Antes del primer uso, aplicar los SQL de `database/` (persona-1, persona-2, persona-3) y en `backend/` ejecutar `npm run db:seed`.

## Referencias

- Arquitectura: [docs/arquitectura.md](docs/arquitectura.md)
- Flujo Git: [docs/git-workflow.md](docs/git-workflow.md)
- Base de datos: [database/README.md](database/README.md)
- Requisitos: [docs/requisitos.md](docs/requisitos.md)
- MVP: [docs/mvp.md](docs/mvp.md)
- QA Plan: [docs/qa-plan.md](docs/qa-plan.md)
