# Plantilla QA — MVP SIEP/PsychoSim

**Versión:** MVP manual · **Entorno:** `http://localhost:4200` · API `http://localhost:3000/api`  
**Estado inicial:** Pendiente en todas las filas hasta ejecutar la prueba.

**Leyenda Estado:** `Pendiente` | `Aprobado` | `Fallido`

---

## Credenciales de referencia

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@nuclear.local | Admin123* |
| Profesor | profesor@nuclear.local | Profesor123* |
| Estudiante A | estudiante1@nuclear.local | Estudiante123* |
| Estudiante B | estudiante2@nuclear.local | Estudiante123* |

**Preparación:** `npm run up` · Seed: `npm run db:seed` en `backend/` · Capturas en `docs/evidencias-qa/`

---

## 1. Preparación

| ID | Módulo | Rol | Prueba | Pasos | Resultado esperado | Estado | Evidencia / captura | Observaciones |
|----|--------|-----|--------|-------|-------------------|--------|---------------------|---------------|
| PRE-01 | Entorno | — | Servicios levantados | 1. Ejecutar `npm run up`<br>2. Verificar sin errores en terminal | Backend, PostgREST y frontend activos | Pendiente | | |
| PRE-02 | Base de datos | — | Seed de usuarios demo | 1. Confirmar SQL de `database/` aplicados<br>2. `npm run db:seed` en `backend/` | Usuarios demo creados o ya existentes | Pendiente | | |
| PRE-03 | Login | — | Página de login accesible | 1. Abrir `/login` | Carga correcta; estética verde/natural (hojas, tarjeta, botón verde) | Pendiente | CAP-01 | |
| PRE-04 | Login | — | Accesos rápidos por rol | 1. Clic chip Admin, Profesor, Estudiante | Formulario se rellena con credenciales demo | Pendiente | | |

---

## 2. Administrador

| ID | Módulo | Rol | Prueba | Pasos | Resultado esperado | Estado | Evidencia / captura | Observaciones |
|----|--------|-----|--------|-------|-------------------|--------|---------------------|---------------|
| ADM-01 | Auth | Administrador | Login exitoso | 1. `/login` con `admin@nuclear.local` / `Admin123*`<br>2. Entrar | Redirección a `/admin/dashboard` tras animación de bienvenida | Pendiente | | |
| ADM-02 | Auth | Administrador | Restricción rutas profesor | 1. Con sesión admin, abrir `/profesor/casos` | Redirección al dashboard admin (sin acceso cruzado) | Pendiente | | |
| ADM-03 | Auth | Administrador | Restricción rutas estudiante | 1. Abrir `/estudiante/casos` | Redirección al dashboard admin | Pendiente | | |
| ADM-04 | Auth | Administrador | Ruta protegida sin sesión | 1. Cerrar sesión o ventana privada<br>2. Abrir `/admin/usuarios` | Redirección a `/login` | Pendiente | | |
| ADM-05 | RF-03 Usuarios | Administrador | Crear profesor | 1. `/admin/usuarios` → Nuevo usuario<br>2. Rol Profesor, datos válidos → Crear | Usuario en lista con badge Profesor | Pendiente | CAP-02 | |
| ADM-06 | RF-03 Usuarios | Administrador | Crear estudiante | 1. Nuevo usuario → Rol Estudiante → Crear | Usuario en lista con badge Estudiante | Pendiente | | |
| ADM-07 | RF-03 Usuarios | Administrador | Editar nombre | 1. Editar usuario de prueba<br>2. Cambiar nombre → Guardar | Nombre actualizado en lista | Pendiente | | |
| ADM-08 | RF-03 Usuarios | Administrador | Cambiar rol | 1. Editar estudiante de prueba<br>2. Cambiar rol (ej. a Profesor) → Guardar | Badge de rol actualizado | Pendiente | | |
| ADM-09 | RF-03 Usuarios | Administrador | Desactivar usuario | 1. Desactivar usuario que no sea admin actual | Estado Inactivo; login de esa cuenta falla | Pendiente | | |
| ADM-10 | RF-03 Usuarios | Administrador | Reactivar usuario | 1. Reactivar usuario desactivado<br>2. Login con esa cuenta | Estado Activo; login OK | Pendiente | | |
| ADM-11 | RF-03 Usuarios | Administrador | No degradar rol propio | 1. Editar `admin@nuclear.local` | Hint: no cambiar rol ADMIN; select bloqueado o sin efecto | Pendiente | CAP-03 | |
| ADM-12 | RF-03 Usuarios | Administrador | No auto-desactivar (UI) | 1. En fila del admin actual | Botón Desactivar deshabilitado + tooltip | Pendiente | CAP-03 | |
| ADM-13 | RF-03 Usuarios | Administrador | No auto-desactivar (API, opcional) | 1. PATCH desactivar propio admin vía API | 400: administrador no puede desactivarse | Pendiente | CAP-15 | Opcional |
| ADM-14 | Diseño | Administrador | Identidad SIEP en usuarios | 1. Revisar `/admin/usuarios` | Page header, tarjetas, botones verdes, badges, empty/loading | Pendiente | | |

---

## 3. Profesor

| ID | Módulo | Rol | Prueba | Pasos | Resultado esperado | Estado | Evidencia / captura | Observaciones |
|----|--------|-----|--------|-------|-------------------|--------|---------------------|---------------|
| PRO-01 | Auth | Profesor | Login exitoso | 1. Acceso rápido Profesor o `profesor@nuclear.local` / `Profesor123*` | Redirección a `/profesor/dashboard` | Pendiente | | |
| PRO-02 | Auth | Profesor | Restricción rutas admin | 1. Abrir `/admin/usuarios` con sesión profesor | Redirección a ruta profesor | Pendiente | | |
| PRO-03 | Grupos | Profesor | Crear grupo | 1. `/profesor/grupos/nuevo`<br>2. Nombre ej. `Grupo Psico 2026-A` → Guardar | Grupo en listado | Pendiente | CAP-04 | |
| PRO-04 | Grupos | Profesor | Editar grupo | 1. Editar grupo → cambiar nombre → Guardar | Cambio reflejado | Pendiente | | |
| PRO-05 | Grupos | Profesor | Ver detalle grupo | 1. Abrir detalle `/profesor/grupos/:id` | Datos y sección de estudiantes visibles | Pendiente | CAP-04 | |
| PRO-06 | Grupos | Profesor | Asociar estudiantes | 1. Agregar `estudiante1` y estudiante de prueba al grupo | Estudiantes listados en detalle | Pendiente | | |
| PRO-07 | Grupos | Profesor | Remover estudiante | 1. Quitar un estudiante del grupo | Ya no aparece en el grupo | Pendiente | | |
| PRO-08 | Casos | Profesor | Crear caso borrador | 1. `/profesor/casos/nuevo`<br>2. Título, descripción, objetivo → Guardar | Caso en estado Borrador; detalle del caso | Pendiente | | |
| PRO-09 | Casos | Profesor | Caso lineal — escenarios | 1. Crear 3 escenarios (2 intermedios + 1 final)<br>2. Fondos válidos, situación ≥10 caracteres | Escenarios listados en detalle | Pendiente | | Caso: `Caso Lineal MVP` |
| PRO-10 | Casos | Profesor | Configurar decisión lineal | 1. Por escenario no final: Configurar decisión<br>2. Enunciado, ≥2 opciones, puntaje, retroalimentación cada una<br>3. Sin escenario destino | Opciones guardadas; flujo por orden | Pendiente | | |
| PRO-11 | Casos | Profesor | Escenario final lineal | 1. Marcar escenario 3 como final<br>2. Decisión/opciones de cierre | Badge Escenario final | Pendiente | | |
| PRO-12 | Casos | Profesor | Caso ramificado — estructura | 1. Crear ≥4 escenarios<br>2. Ramas con `escenario destino` en al menos una opción | Estructura ramificada configurada | Pendiente | | Caso: `Caso Ramificado MVP` |
| PRO-13 | Casos | Profesor | Destino explícito vs orden | 1. En config: opción A con destino explícito<br>2. Opción B sin destino | Badges Destino explícito / siguiente por orden | Pendiente | CAP-05 | |
| PRO-14 | Publicación | Profesor | Publicación caso inválido — sin escenarios | 1. Caso `Caso QA Inválido` sin escenarios<br>2. Publicar caso | Lista "Pendientes para publicar"; no publica | Pendiente | CAP-06 | |
| PRO-15 | Publicación | Profesor | Publicación — escenario huérfano | 1. Escenario no alcanzable desde inicio<br>2. Publicar | Error: escenario no alcanzable desde el inicio | Pendiente | | |
| PRO-16 | Publicación | Profesor | Publicación — ruta incompleta | 1. Escenario sin 2 opciones o sin retroalimentación<br>2. Publicar | Errores claros (opciones/retroalimentación) | Pendiente | | |
| PRO-17 | Publicación | Profesor | Publicación — ciclo sin salida | 1. Ciclo E1↔E2 sin salida a final<br>2. Publicar | Error: ciclo sin salida o sin finalización válida | Pendiente | | |
| PRO-18 | Publicación | Profesor | Publicación caso lineal OK | 1. Corregir `Caso Lineal MVP`<br>2. Publicar caso | Estado Publicado; sin lista de errores | Pendiente | CAP-07 | |
| PRO-19 | Publicación | Profesor | Publicación caso ramificado OK | 1. Publicar `Caso Ramificado MVP` | Estado Publicado | Pendiente | | |
| PRO-20 | Publicación | Profesor | Caso publicado no editable | 1. Abrir caso publicado | Sin botones editar escenarios/decisión en borrador | Pendiente | | |
| PRO-21 | Canvas | Profesor | Abrir canvas read-only | 1. `/profesor/casos/:casoId/canvas` | Título "Flujo visual del caso"; aviso solo lectura | Pendiente | CAP-08 | |
| PRO-22 | Canvas | Profesor | Nodos y opciones en canvas | 1. Revisar nodos y opciones | Orden, título, pregunta, badges Final / Destino / Orden / Fin | Pendiente | CAP-08 | |
| PRO-23 | Canvas | Profesor | Mapa de conexiones | 1. Revisar sección Mapa de conexiones | Filas origen → destino; sin edición | Pendiente | CAP-08 | |
| PRO-24 | Canvas | Profesor | Canvas no editable | 1. Buscar controles de edición / drag | No hay edición ni guardado de posiciones | Pendiente | | |
| PRO-25 | RF-13 Asignaciones | Profesor | Asignar caso a grupo | 1. `/profesor/asignaciones`<br>2. Seleccionar caso publicado<br>3. Marcar grupo → Guardar | Badge Asignado | Pendiente | CAP-09 | |
| PRO-26 | RF-13 Asignaciones | Profesor | Asignar segundo caso | 1. Asignar también caso ramificado al mismo grupo | Ambos casos asignados | Pendiente | | |
| PRO-27 | RF-13 Asignaciones | Profesor | Quitar asignación | 1. Desmarcar un caso → Guardar | Asignación removida (validar con estudiante) | Pendiente | | |
| PRO-28 | RF-12 Evidencias | Profesor | Listar evidencias | 1. Tras intentos estudiante: `/profesor/evidencias` o Ver evidencias en caso | Sesiones/intentos visibles | Pendiente | | |
| PRO-29 | RF-12 Evidencias | Profesor | Revisión solo lectura | 1. Abrir `/profesor/evidencias/:sesionId` | "Modo revisión · solo lectura"; sin editar respuestas | Pendiente | CAP-14 | |

---

## 4. Estudiante

| ID | Módulo | Rol | Prueba | Pasos | Resultado esperado | Estado | Evidencia / captura | Observaciones |
|----|--------|-----|--------|-------|-------------------|--------|---------------------|---------------|
| EST-01 | Auth | Estudiante | Login exitoso | 1. Acceso rápido o `estudiante1@nuclear.local` / `Estudiante123*` | Redirección a `/estudiante/dashboard` | Pendiente | | |
| EST-02 | Auth | Estudiante | Restricción rutas profesor | 1. Abrir `/profesor/casos` | Redirección estudiante | Pendiente | | |
| EST-03 | Casos | Estudiante | Solo casos asignados | 1. `/estudiante/casos` con asignaciones activas | Solo casos asignados al grupo del estudiante | Pendiente | CAP-10 | |
| EST-04 | Casos | Estudiante | Sin caso desasignado | 1. Profesor quita asignación<br>2. Refrescar lista estudiante | Caso desaparece de la lista | Pendiente | | |
| EST-05 | Simulación | Estudiante | Flujo lineal completo | 1. Iniciar `Caso Lineal MVP`<br>2. Responder escenarios 1→2→3<br>3. Ver retroalimentación cada vez<br>4. Completar en final | Sesión completada; resultado accesible | Pendiente | CAP-11, CAP-12 | |
| EST-06 | Simulación | Estudiante | Flujo ramificado | 1. Nueva sesión `Caso Ramificado MVP`<br>2. Opción destino explícito → escenario correcto<br>3. Otra opción → ruta alternativa<br>4. Finalizar | Ramificación coherente con configuración | Pendiente | CAP-11 | |
| EST-07 | Resultado | Estudiante | Pantalla de resultado | 1. Abrir `/estudiante/resultados/:sesionId` | Puntaje, porcentaje/nivel, resumen coherente | Pendiente | CAP-12 | |
| EST-08 | RF-12 Historial | Estudiante | Historial de intentos | 1. `/estudiante/historial` | Ambos intentos finalizados con fechas y puntaje | Pendiente | CAP-13 | |
| EST-09 | RF-12 Historial | Estudiante | Resultado desde historial | 1. Ver resultado desde historial | Misma vista resultado; sin re-responder | Pendiente | | |
| EST-10 | RF-12 Historial | Estudiante | Sesión terminada no editable | 1. Intentar reabrir player de sesión completada | Bloqueo o mensaje; no edición de respuestas | Pendiente | | |

---

## 5. Seguridad

| ID | Módulo | Rol | Prueba | Pasos | Resultado esperado | Estado | Evidencia / captura | Observaciones |
|----|--------|-----|--------|-------|-------------------|--------|---------------------|---------------|
| SEG-01 | Casos | Estudiante | No ver casos no asignados | 1. Login `estudiante2` sin grupo/asignación<br>2. `/estudiante/casos` | Lista vacía o sin casos del profesor | Pendiente | | |
| SEG-02 | Sesiones | Estudiante | Sesión de otro estudiante | 1. Copiar URL `/estudiante/sesiones/:sesionId` de estudiante1<br>2. Abrir con estudiante2 | 403 / mensaje: no acceder a sesiones ajenas | Pendiente | CAP-15 | |
| SEG-03 | Resultados | Estudiante | Resultado de otro estudiante | 1. Copiar `/estudiante/resultados/:sesionId` ajeno | Acceso denegado | Pendiente | | |
| SEG-04 | Roles | Estudiante | Bloqueo admin | 1. Estudiante → `/admin/usuarios` | Redirect a ruta estudiante | Pendiente | | |
| SEG-05 | Roles | Profesor | Bloqueo admin | 1. Profesor → `/admin/usuarios` | Redirect a ruta profesor | Pendiente | | |
| SEG-06 | API | — | Sin JWT (opcional) | 1. Request a endpoint protegido sin token | 401 Unauthorized | Pendiente | CAP-15 | Opcional |
| SEG-07 | Evidencias | Profesor | Aislamiento evidencias (opcional) | 1. Profesor2 intenta revisión de sesión de Profesor1 | 403/404 según ownership | Pendiente | | Opcional si hay 2 profesores |

---

## 6. Diseño visual

| ID | Módulo | Rol | Prueba | Pasos | Resultado esperado | Estado | Evidencia / captura | Observaciones |
|----|--------|-----|--------|-------|-------------------|--------|---------------------|---------------|
| UI-01 | Login | — | Identidad login intacta | 1. Revisar `/login` post UI-5B | Fondo verdoso, hojas, tarjeta, botón verde, chips rol | Pendiente | CAP-01 | |
| UI-02 | Layout | Administrador | Shell admin SIEP | 1. Navegar admin | Topbar verde, tipografía y tarjetas coherentes | Pendiente | CAP-02 | |
| UI-03 | Layout | Profesor | Shell profesor SIEP | 1. Grupos, casos, asignaciones, evidencias, canvas | Botones `siep-btn-primary`, cards, badges | Pendiente | CAP-04 a CAP-09 | |
| UI-04 | Layout | Estudiante | Shell estudiante SIEP | 1. Casos, player, historial, resultado | Player y listas con skin SIEP | Pendiente | CAP-10 a CAP-13 | |
| UI-05 | Componentes | Todos | Estados vacíos y carga | 1. Provocar listas vacías (sin grupos/casos/historial) | `app-empty-state` y `app-loading-state` claros | Pendiente | | |
| UI-06 | Componentes | Todos | Alertas y errores | 1. Provocar error de formulario o API | `app-alert-message` legible | Pendiente | | |

---

## 7. Capturas recomendadas

| ID captura | Pantalla | Rol | Vincular pruebas | Archivo sugerido | Estado | Observaciones |
|------------|----------|-----|------------------|------------------|--------|---------------|
| CAP-01 | Login completo (hero + tarjeta) | — | PRE-03, UI-01 | `01-login.png` | Pendiente | URL visible |
| CAP-02 | Lista usuarios + panel crear | Admin | ADM-05, UI-02 | `02-admin-usuarios.png` | Pendiente | RF-03 |
| CAP-03 | Admin actual: desactivar deshabilitado | Admin | ADM-11, ADM-12 | `03-admin-proteccion.png` | Pendiente | |
| CAP-04 | Detalle grupo con estudiantes | Profesor | PRO-05, PRO-06, UI-03 | `04-grupo-detalle.png` | Pendiente | |
| CAP-05 | Configurar decisión + destino | Profesor | PRO-13 | `05-decision-destino.png` | Pendiente | |
| CAP-06 | Pendientes para publicar | Profesor | PRO-14 a PRO-17 | `06-publicacion-errores.png` | Pendiente | |
| CAP-07 | Caso publicado | Profesor | PRO-18 | `07-caso-publicado.png` | Pendiente | |
| CAP-08 | Canvas solo lectura + mapa | Profesor | PRO-21 a PRO-24 | `08-canvas.png` | Pendiente | |
| CAP-09 | Asignaciones con checkboxes | Profesor | PRO-25, PRO-26 | `09-asignaciones.png` | Pendiente | RF-13 |
| CAP-10 | Lista casos estudiante | Estudiante | EST-03, UI-04 | `10-estudiante-casos.png` | Pendiente | |
| CAP-11 | Player + retroalimentación | Estudiante | EST-05, EST-06 | `11-player-feedback.png` | Pendiente | |
| CAP-12 | Resultado final | Estudiante | EST-07 | `12-resultado.png` | Pendiente | |
| CAP-13 | Historial intentos | Estudiante | EST-08 | `13-historial.png` | Pendiente | RF-12 |
| CAP-14 | Revisión docente solo lectura | Profesor | PRO-29 | `14-revision-docente.png` | Pendiente | RF-12 |
| CAP-15 | Network 403 / 401 (opcional) | Estudiante / API | SEG-02, SEG-06, ADM-13 | `15-seguridad-network.png` | Pendiente | DevTools |

**Carpeta de evidencias:** `docs/evidencias-qa/`

---

## 8. Pendientes posteriores (fuera de alcance MVP QA)

| ID | Área | Descripción | Prioridad sugerida | Observaciones |
|----|------|-------------|-------------------|---------------|
| PEN-01 | Login | Rediseño inmersivo (referencia futura) | Media | UI-5B solo tokens |
| PEN-02 | Canvas | Edición visual, D&D, canvas_nodes/edges | Baja | |
| PEN-03 | IA | Tutor / IA en simulación | Baja | |
| PEN-04 | Seguridad | Registro público, endurecer PostgREST, rotar credenciales demo | Alta (prod) | |
| PEN-05 | QA automático | E2E Playwright/Cypress flujo completo | Media | |
| PEN-06 | Legacy | Limpieza rutas/componentes antiguos | Baja | |
| PEN-07 | Producto | Analytics, export PDF evidencias, dashboard estudiante | Baja | |
| PEN-08 | Backend | Editar caso publicado, versionado | Media | |
| PEN-09 | Documentación | Actualizar README raíz (estado simulación) | Baja | |

---

## Resumen de ejecución

| Sección | Total ítems | Aprobados | Fallidos | Pendientes |
|---------|-------------|-----------|----------|------------|
| 1. Preparación | 4 | | | 4 |
| 2. Administrador | 14 | | | 14 |
| 3. Profesor | 29 | | | 29 |
| 4. Estudiante | 10 | | | 10 |
| 5. Seguridad | 7 | | | 7 |
| 6. Diseño visual | 6 | | | 6 |
| **Pruebas funcionales** | **70** | | | |
| 7. Capturas | 15 | | | 15 |
| 8. Pendientes | 9 | — | — | — |

**Criterio de cierre MVP:** Todas las filas de secciones 1–6 en **Aprobado**, sin **Fallido** bloqueante en SEG-01 a SEG-05; capturas CAP-01 a CAP-14 completadas.

---

## Flujo ideal de prueba (orden sugerido)

1. Admin: usuarios y restricciones sobre sí mismo.
2. Profesor: grupo con estudiantes.
3. Profesor: caso lineal → publicar → canvas.
4. Profesor: caso ramificado → publicar → asignaciones.
5. Profesor: caso inválido → validación de publicación.
6. Estudiante1: simular ambos casos → historial.
7. Profesor: evidencias y revisión.
8. Estudiante2: seguridad (casos no asignados, sesión ajena).
9. Revisión visual: tres roles + login.

---

## Errores esperados (referencia rápida)

| Síntoma | Posible causa |
|---------|---------------|
| Login falla para todos | Seed no ejecutado / PostgREST caído |
| Estudiante no ve casos | Sin asignación o sin grupo |
| Publicar sin detalle | Revisar 422 y lista "Pendientes para publicar" |
| 403 en sesión ajena | Comportamiento correcto de seguridad |
| Admin se desactiva | Debe estar bloqueado en UI y API |

**Mensajes de publicación (backend):**

- El escenario N no es alcanzable desde el inicio.
- Se detecto un ciclo sin salida hacia un escenario final.
- El flujo del caso no tiene una ruta de finalizacion.
- La opcion N del escenario M no tiene retroalimentacion.
- El caso ya se encuentra publicado.

---

## Fondos válidos para escenarios

`aula` · `oficina_psicologica` · `casa` · `comisaria_familia` · `sala_espera`