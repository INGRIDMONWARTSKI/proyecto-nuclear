# Database

Este directorio centraliza la estructura de PostgreSQL del proyecto.

- `persona-1-auth.sql`: esquema operativo actual para autenticación, usuarios y roles.
- `persona-2-grupos.sql`: tablas `grupos` y `estudiante_grupo` (requiere `persona-1-auth.sql`).
- `modelo-general.md`: inventario mínimo de entidades del proyecto completo.

PostgREST debe exponerse sobre estas tablas para que el backend NestJS funcione correctamente.
