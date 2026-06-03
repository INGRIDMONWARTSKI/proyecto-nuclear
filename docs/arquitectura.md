# Arquitectura

## Nombre

Simulador Interactivo de Casos Psicologicos

## Estilo arquitectonico

Monolito modular.

## Stack tecnico

- Frontend: Angular.
- Backend: NestJS (Node.js).
- Capa de datos: PostgreSQL + PostgREST.
- Versionado: Git + GitHub.

## Modulos implementados actualmente

### 1) Auth

- Inicio y cierre de sesion con JWT.
- Endpoint de perfil del usuario autenticado.
- Registro de usuarios (con restricciones de rol desde backend).

### 2) Usuarios

- Registro de usuarios desde rol administrador.
- Consulta de usuarios y detalle de usuario para roles autorizados.

### 3) Grupos

- Registro de grupo academico.
- Consulta de grupos segun rol.
- Actualizacion de grupo.
- Desactivacion de grupo.
- Asignacion y remocion de estudiantes por grupo.

### 4) Salon interactivo (frontend)

- Visualizacion de aula por grupo.
- Consulta de estudiantes del grupo.
- Interaccion para asignar/remover estudiantes desde la vista del salon.

## Modulo futuro: Simulacion

El siguiente modulo pendiente es la simulacion de casos psicologicos. Debe incluir al menos:

- Caso.
- Escenario.
- Pregunta o decision.
- Opcion de respuesta.
- Retroalimentacion.
- Resultado.
- Sesion de simulacion.

Actualmente estas capacidades no estan implementadas de punta a punta en SQL, backend ni frontend.

## Estructura raiz

```text
simulador-psicologia/
├── frontend/
├── backend/
├── database/
└── docs/
```
