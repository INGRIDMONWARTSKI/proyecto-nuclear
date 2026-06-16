# Despliegue MENTORA en Railway

Guia para desplegar la arquitectura:

- Angular SPA + NestJS en un servicio `App MENTORA`
- PostgREST en un servicio separado
- PostgreSQL managed de Railway

## 1) Servicios requeridos

Crear tres servicios en Railway:

1. `mentora-app` (Dockerfile en `backend/Dockerfile`)
2. `mentora-postgrest` (imagen oficial `postgrest/postgrest:v12.2.3`)
3. `mentora-postgres` (PostgreSQL managed de Railway)

## 2) Servicio App MENTORA (NestJS + Angular)

### Build/Start

- Railway debe usar `backend/Dockerfile`
- Contexto de build: raiz del repositorio

### Variables recomendadas

- `NODE_ENV=production`
- `PORT=3000`
- `JWT_SECRET=<tu-secreto>`
- `JWT_EXPIRES_IN=1d`
- `POSTGREST_URL=<URL interna del servicio postgrest>`
- `POSTGREST_SCHEMA=public`
- `POSTGREST_API_KEY=`
- `FRONTEND_URL=<URL publica de mentora-app>`
- `SMTP_HOST=...`
- `SMTP_PORT=...`
- `SMTP_SECURE=...`
- `SMTP_USER=...`
- `SMTP_PASS=...`
- `SMTP_FROM=...`
- `ADMIN_EMAIL=...`
- `ADMIN_PASSWORD=...`
- `ADMIN_FULL_NAME=...`
- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-2.5-flash`
- `HF_TOKEN=...`
- `HF_IMAGE_MODEL=black-forest-labs/FLUX.1-schnell`
- `HF_IMAGE_PROVIDER=auto`

Notas:

- `POSTGREST_URL` no debe apuntar a localhost en Railway.
- `FRONTEND_URL` debe ser la URL publica de `mentora-app` para CORS.

## 3) Servicio PostgREST

Crear un servicio usando imagen:

- `postgrest/postgrest:v12.2.3`

Variables:

- `PGRST_DB_URI=postgres://<user>:<password>@<host>:<port>/<database>`
- `PGRST_DB_SCHEMAS=public`
- `PGRST_DB_ANON_ROLE=postgres`
- `PGRST_SERVER_PORT=3000`

Notas:

- El valor de `PGRST_DB_URI` debe usar las credenciales del PostgreSQL managed de Railway.
- El servicio App debe consumir la URL interna de este servicio en `POSTGREST_URL`.

## 4) Base de datos (migraciones)

El archivo consolidado para inicializar esquema es:

- `database/all-migrations.sql`

Aplicar manualmente contra la DB de Railway (no Docker local):

```bash
psql "<RAILWAY_POSTGRES_CONNECTION_STRING>" -f database/all-migrations.sql
```

No se ejecutan migraciones automaticamente en este ticket para evitar riesgos.

## 5) Uploads y persistencia

La app guarda archivos en `backend/uploads`.

En Railway, el filesystem del contenedor no es persistente entre redeploys.
Si necesitas conservar archivos subidos:

- Opcion A: montar Railway Volume y apuntar uploads a una ruta persistente
- Opcion B: migrar a almacenamiento externo (S3/Cloudinary)

Este ticket no implementa migracion de almacenamiento; solo deja la advertencia.

### Configuracion recomendada de Railway Volume (antes de deploy)

1. En el servicio `mentora-app`, crear un **Volume**.
2. Montar el volumen en la ruta:
   - `/app/backend/uploads`
3. Mantener esa ruta porque el backend actual escribe y sirve archivos desde:
   - `process.cwd()/uploads` (con `WORKDIR /app/backend` en Docker)
4. Redeploy del servicio `mentora-app`.

Con esta configuracion, `/uploads/*` queda persistente entre despliegues.

## 6) Verificacion post-deploy

1. Abrir URL publica de `mentora-app`
2. Probar login
3. Verificar API: `GET /api/health`
4. Verificar acceso a PostgREST desde App (acciones que lean/escriban datos)
5. Abrir una ruta Angular directa, por ejemplo:
   - `/admin/usuarios`
   - `/profesor/casos`
   Debe cargar correctamente (fallback a `index.html` activo)

## 7) Desarrollo local (sin cambios)

El flujo local actual con `docker-compose.yml` y scripts existentes se mantiene.

## 8) Nota sobre Docker build local

Durante la preparacion de despliegue, el build local de Docker puede fallar por
conectividad DNS/red del entorno al descargar dependencias nativas
(`onnxruntime-node`, por ejemplo resolviendo `api.nuget.org` y `auth.docker.io`).

Este tipo de error es de red/infra local y no implica un fallo funcional del
codigo de la aplicacion.
