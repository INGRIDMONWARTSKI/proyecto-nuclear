# Backend con PostgREST

Este backend NestJS ahora usa `PostgREST` como capa de acceso a datos. La API de Nest mantiene sus endpoints actuales, pero las operaciones sobre usuarios se hacen por HTTP contra un servicio PostgREST conectado a PostgreSQL.

## Variables de entorno

Configura al menos estas variables:

```env
PORT=3000
JWT_SECRET=tu-secreto
JWT_EXPIRES_IN=1d
POSTGREST_URL=http://localhost:3001
POSTGREST_SCHEMA=public
# POSTGREST_API_KEY=
ADMIN_EMAIL=admin@nuclear.local
ADMIN_PASSWORD=Admin123*
ADMIN_FULL_NAME=Administrador General
```

## Esquema de PostgreSQL

El SQL base está en `../database/persona-1-auth.sql`. Ejecútalo sobre tu base PostgreSQL antes de levantar PostgREST.

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
- El alcance implementado hoy corresponde solo a `auth`, `usuarios` y `roles`.
