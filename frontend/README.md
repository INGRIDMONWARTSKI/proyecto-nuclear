# Frontend

Aplicación Angular del Simulador de Psicología Social.

## Modulos implementados

- **Grupos académicos** (`src/app/grupos/`)
- Base de autenticación JWT (`src/app/core/`, `src/app/auth/`)
- **Simulacion estudiante (fase 2.5)** (`src/app/simulacion/`)
  - Listado de casos publicados.
  - Inicio de sesion de simulacion.
  - Player basico de escenarios con respuesta y retroalimentacion inmediata.
  - Pantalla de resultado final.
- **Simulacion docente (fase 2.6)** (`src/app/simulacion/`)
  - CRUD basico de casos (borrador).
  - Gestion de escenarios (texto, fondo, orden).
  - Configuracion de pregunta, opciones y retroalimentacion.
  - Vista previa y publicacion con validaciones.
  - Consulta de evidencias basicas de sesiones.

Nota: el editor visual tipo Canva (elementos de escena, drag and drop) sigue pendiente.

## Ejecutar

```bash
npm install
npm start
```

Abre `http://localhost:4200`. El backend debe estar en `http://localhost:3000/api` (ver `src/environments/environment.ts`).

## Credenciales de prueba

Usa el admin del seed del backend (`admin@nuclear.local` / `Admin123*`).
