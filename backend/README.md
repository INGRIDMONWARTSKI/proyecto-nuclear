# Backend con PostgREST

Este backend NestJS usa `PostgREST` como capa de acceso a datos. La API Nest expone endpoints HTTP y delega persistencia hacia PostgreSQL mediante PostgREST.

## Variables de entorno

Configura al menos estas variables:

```env
PORT=3000
JWT_SECRET=tu-secreto
JWT_EXPIRES_IN=1d
POSTGREST_URL=http://localhost:3001
POSTGREST_SCHEMA=public
GEMINI_API_KEY=tu-api-key
GEMINI_MODEL=gemini-2.5-flash
# GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models
# POSTGREST_API_KEY=
ADMIN_EMAIL=admin@nuclear.local
ADMIN_PASSWORD=Admin123*
ADMIN_FULL_NAME=Administrador General
```

## Esquema de PostgreSQL

El SQL base actual esta en:

- `../database/persona-1-auth.sql` (usuarios, roles).
- `../database/persona-2-grupos.sql` (grupos, estudiante_grupo; requiere persona-1).

Ejecutalos en PostgreSQL antes de levantar PostgREST.

## Seed inicial

Para crear el usuario administrador usando PostgREST:

```bash
npm install
npm run db:seed
```

## Ejecutar el backend

```bash
npm run start:dev
```

## Notas

- El backend espera que PostgREST ya esté levantado y accesible en `POSTGREST_URL`.
- Si tu instancia de PostgREST requiere credenciales tipo Supabase service key o JWT estático, colócalas en `POSTGREST_API_KEY`.
- El alcance implementado hoy cubre `auth`, `usuarios`, `roles`, `grupos` y backend de `simulacion` hasta fase 2.4 (configuracion docente + ejecucion de sesiones por estudiante + resultado final + evidencias basicas).

## Modulos implementados

- `auth`
- `usuarios`
- `roles`
- `grupos`
- `simulacion` (fase 2.4 parcial)

## Endpoints actuales identificados

Los endpoints existentes en el codigo son:

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Usuarios

- `GET /api/usuarios`
- `GET /api/usuarios/:id`
- `POST /api/usuarios`

### Grupos

- `POST /api/grupos`
- `GET /api/grupos`
- `GET /api/grupos/:id`
- `PATCH /api/grupos/:id`
- `DELETE /api/grupos/:id`
- `GET /api/grupos/:id/estudiantes`
- `POST /api/grupos/:id/estudiantes`
- `DELETE /api/grupos/:id/estudiantes/:estudianteId`

### Simulacion (fase 2.4)

- `POST /api/simulacion/docente/casos`
- `POST /api/simulacion/docente/casos/generar`
- `GET /api/simulacion/docente/casos`
- `GET /api/simulacion/docente/casos/:casoId`
- `PATCH /api/simulacion/docente/casos/:casoId`
- `POST /api/simulacion/docente/casos/:casoId/escenarios`
- `PATCH /api/simulacion/docente/escenarios/:escenarioId`
- `GET /api/simulacion/docente/casos/:casoId/escenarios`
- `POST /api/simulacion/docente/escenarios/:escenarioId/pregunta`
- `POST /api/simulacion/docente/preguntas/:preguntaId/opciones`
- `PATCH /api/simulacion/docente/opciones/:opcionId`
- `DELETE /api/simulacion/docente/opciones/:opcionId`
- `POST /api/simulacion/docente/opciones/:opcionId/retroalimentacion`
- `PATCH /api/simulacion/docente/retroalimentaciones/:retroalimentacionId`
- `DELETE /api/simulacion/docente/retroalimentaciones/:retroalimentacionId`
- `GET /api/simulacion/docente/casos/:casoId/preview`
- `POST /api/simulacion/docente/casos/:casoId/publicar`
- `GET /api/simulacion/docente/casos/:casoId/sesiones`
- `GET /api/simulacion/estudiante/casos`
- `POST /api/simulacion/estudiante/sesiones`
- `GET /api/simulacion/estudiante/sesiones/:sesionId/escenario-actual`
- `POST /api/simulacion/estudiante/sesiones/:sesionId/respuestas`
- `POST /api/simulacion/estudiante/sesiones/:sesionId/finalizar`
- `GET /api/simulacion/estudiante/sesiones/:sesionId/resultado`

## Alcance pendiente

Los endpoints frontend del modulo de simulacion, editor visual y pruebas E2E integrales todavia no estan implementados.

## Generacion de casos con IA

El backend expone `POST /api/simulacion/docente/casos/generar` para crear un borrador completo en estado `draft` usando Gemini.

Payload de ejemplo:

```json
{
  "instruccion": "Enfocar el caso en entrevista inicial y contencion emocional.",
  "casosReferenciaTexto": [
    "Caso 1: Adolescente con sintomas de ansiedad tras conflicto escolar.",
    "Caso 2: Madre cuidadora con sobrecarga emocional."
  ],
  "casosReferenciaIds": ["uuid-caso-1"],
  "cantidadEscenarios": 3
}
```

Respuesta de ejemplo:

```json
{
  "casoId": "uuid-generado",
  "titulo": "Caso generado por IA",
  "totalEscenarios": 3,
  "modelo": "gemini-2.5-flash"
}
```

Notas:

- Se requiere `GEMINI_API_KEY` en entorno; no se debe versionar ni dejar hardcodeada.
- El endpoint acepta texto libre, casos existentes del sistema o ambos como referencia.
- El caso se persiste usando la misma estructura actual de `casos`, `escenarios`, `preguntas_decision`, `opciones_respuesta` y `retroalimentaciones`.
