# Database

Este directorio centraliza la estructura de PostgreSQL del proyecto.

- `persona-1-auth.sql`: esquema operativo actual para autenticación, usuarios y roles.
- `persona-2-grupos.sql`: tablas `grupos` y `estudiante_grupo` (requiere `persona-1-auth.sql`).
- `persona-3-simulacion.sql`: modelo SQL base del módulo de simulación (casos, escenarios, decisiones, sesiones y respuestas).
- `modelo-general.md`: inventario mínimo de entidades del proyecto completo.

PostgREST debe exponerse sobre estas tablas para que el backend NestJS funcione correctamente.

Nota: en esta fase se definió solo el modelo de datos de simulación. La lógica funcional de backend/frontend del módulo de simulación se implementa en fases posteriores.
