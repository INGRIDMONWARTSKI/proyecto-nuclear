# Demo en vivo — MENTORA

## Objetivo de la demo

Mostrar cómo **MENTORA** permite que un estudiante practique la toma de decisiones en situaciones psicosociales mediante una simulación interactiva, y cómo el profesor puede revisar posteriormente la trazabilidad del proceso.

El recorrido de la exposición tiene dos partes:

1. **Flujo estudiante:** login, casos asignados, simulación (escena, decisión, feedback), resultado e historial.
2. **Flujo docente:** login como profesor, evidencias y revisión del intento realizado.

---

## Credenciales

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Estudiante | [estudiante1@nuclear.local](mailto:estudiante1@nuclear.local) | `Estudiante123*` |
| Profesor | [profesor@nuclear.local](mailto:profesor@nuclear.local) | `Profesor123*` |

**Entorno local:** frontend en `http://localhost:4200` · API en `http://localhost:3000/api`

**Preparación previa:** ejecutar `npm run up` y confirmar que el entorno responde sin errores.

**Caso demo:** *Acompañamiento psicosocial en contexto escolar*

---

## Flujo rápido de demo

```
Login estudiante
  → Dashboard
  → Casos
  → Iniciar simulación
  → Escena
  → Decisión
  → Feedback
  → Resultado
  → Historial
  → Login profesor
  → Evidencias
  → Revisión
```

**Duración estimada:** 12–15 minutos.

---

## Guion por pantalla

### 1. Login

| | |
|---|---|
| **Ruta** | `/login` |
| **Qué mostrar** | Pantalla de acceso MENTORA con accesos rápidos por rol. |
| **Qué decir** | «MENTORA cuenta con acceso por roles. En esta demo vamos a ingresar primero como estudiante para vivir la simulación, y luego como profesor para revisar la trazabilidad.» |
| **Acción** | Ingresar como estudiante con las credenciales indicadas, o usar el chip **Estudiante** y pulsar **Entrar al simulador**. |

---

### 2. Dashboard estudiante

| | |
|---|---|
| **Ruta** | `/estudiante/dashboard` |
| **Qué mostrar** | Panel del estudiante con acceso a casos, historial y navegación principal. |
| **Qué decir** | «Este panel orienta al estudiante hacia sus casos asignados, su historial y sus resultados. La interfaz mantiene una línea visual natural y formativa, no de examen tradicional.» |
| **Acción** | Ir a **Mis casos** / **Casos asignados**. |

---

### 3. Casos asignados

| | |
|---|---|
| **Ruta** | `/estudiante/casos` |
| **Qué mostrar** | Listado de casos asignados por el profesor. |
| **Qué decir** | «Aquí el estudiante visualiza los casos que el profesor le asignó. Cada caso representa una experiencia de entrenamiento psicosocial.» |
| **Acción** | En la tarjeta **Acompañamiento psicosocial en contexto escolar**, pulsar **Iniciar simulación**. |

---

### 4. Simulador — escena y decisión

| | |
|---|---|
| **Ruta** | `/estudiante/sesiones/:sesionId` |
| **Qué mostrar** | Escena narrativa con bosque simbólico, avatar del practicante, situación del caso y tarjetas de acción (*Elige tu intervención*). |
| **Qué decir — escena** | «En lugar de mostrar una pregunta plana tipo examen, MENTORA presenta una escena narrativa. El bosque funciona como metáfora del recorrido de aprendizaje y el avatar representa al practicante durante la intervención.» |
| **Qué decir — decisiones** | «Las respuestas no se presentan como A, B o C. Se muestran como acciones o intervenciones posibles dentro de la situación. El estudiante debe elegir con criterio.» |
| **Qué decir — feedback** | «Después de tomar una decisión, el sistema muestra una reflexión formativa. Además, el avatar se mueve simbólicamente: puede avanzar, detenerse o retroceder según la calidad de la decisión.» |
| **Acción** | 1. Señalar la escena (situación, bosque, avatar).<br>2. Elegir una tarjeta de acción (ver tabla de recomendaciones).<br>3. Pulsar **Confirmar decisión**.<br>4. Mostrar el panel **Reflexión MENTORA** y el movimiento del avatar (~1 s).<br>5. Pulsar **Continuar recorrido**.<br>6. Pulsar **Ver resultado del recorrido**. |

> **Nota para el expositor:** En el caso demo actual, tras la primera decisión la sesión se cierra al continuar (escenario final sin nueva pregunta). La demo muestra una decisión, reflexión y cierre; no es necesario mencionarlo salvo que el público lo pregunte.

---

### 5. Resultado del recorrido

| | |
|---|---|
| **Ruta** | `/estudiante/resultados/:sesionId` |
| **Qué mostrar** | Puntaje total, porcentaje, resumen y detalle de respuestas con retroalimentación. |
| **Qué decir** | «Al finalizar, el estudiante puede consultar su resultado y revisar las decisiones tomadas durante la simulación.» |
| **Acción** | Recorrer puntaje y retroalimentación de la decisión registrada. |

---

### 6. Historial

| | |
|---|---|
| **Ruta** | `/estudiante/historial` |
| **Qué mostrar** | Listado de intentos finalizados del estudiante. |
| **Qué decir** | «El historial permite que el estudiante consulte sus intentos finalizados y vuelva a revisar su desempeño.» |
| **Acción** | Localizar el intento de *Acompañamiento psicosocial en contexto escolar* y, si conviene, pulsar **Ver resultado**. |

---

### 7. Login profesor

| | |
|---|---|
| **Ruta** | `/login` |
| **Qué mostrar** | Pantalla de acceso MENTORA. |
| **Qué decir** | «Ahora ingresamos como profesor para revisar la trazabilidad del proceso realizado por el estudiante.» |
| **Acción** | **Cerrar sesión** del estudiante → login con credenciales de profesor → **Entrar al simulador**. |

---

### 8. Evidencias y trazabilidad

| | |
|---|---|
| **Ruta** | `/profesor/evidencias` |
| **Qué mostrar** | Listado de intentos finalizados de estudiantes asignados a los grupos del profesor. |
| **Qué decir** | «El profesor puede ver los intentos realizados por sus estudiantes, revisar las decisiones, puntajes y retroalimentaciones en modo solo lectura. Esto permite hacer seguimiento académico del proceso.» |
| **Acción** | Buscar el intento del estudiante demo → abrir la revisión del caso. |

---

### 9. Revisión docente

| | |
|---|---|
| **Ruta** | `/profesor/evidencias/:sesionId` |
| **Qué mostrar** | Detalle del recorrido: decisiones, puntajes y retroalimentaciones (solo lectura). |
| **Qué decir** | «Aquí el profesor valida el proceso completo del estudiante: qué intervención eligió, qué puntaje obtuvo y qué reflexión recibió. Es la trazabilidad académica del simulador.» |
| **Acción** | Recorrer las respuestas y retroalimentaciones del intento mostrado en la demo. |

---

## Recomendación para la decisión en la simulación

Caso: **Acompañamiento psicosocial en contexto escolar**

| Opción de intervención | Efecto en el avatar | Uso recomendado en demo |
|------------------------|---------------------|-------------------------|
| Escuchar y contener emocionalmente. | Avance del avatar | Opción principal para mostrar reflexión positiva y avance simbólico. |
| Minimizar la situación para evitar alarma. | Retroceso del avatar | Ideal para contrastar una decisión poco adecuada y el retroceso del practicante. |
| Pedir apoyo al docente orientador y seguir el protocolo institucional. | Avance del avatar | Alternativa válida; también muestra avance (decisión acertada). |

**Sugerencia:** Usar la primera opción en la demo principal y, si hay tiempo, repetir con la segunda en otra sesión para contrastar movimiento del avatar.

---

## Plan B si algo falla

| Problema | Qué hacer |
|----------|-----------|
| **No hay casos asignados** | Verificar que el estudiante pertenece a un grupo con el caso publicado y asignado. Confirmar asignación desde el panel del profesor. |
| **Login falla** | Ejecutar `npm run db:seed` en `backend/` para restaurar usuarios demo. Comprobar credenciales exactas (mayúsculas y asterisco final). |
| **Backend caído** | Reiniciar el entorno con `npm run up`. Esperar a que backend y frontend respondan antes de continuar. |
| **Sin evidencias** | Completar la simulación como estudiante hasta **Ver resultado del recorrido**; las evidencias docentes requieren sesiones finalizadas. |
| **Avatar poco visible** | Elegir la opción de retroceso (*Minimizar la situación…*) para un contraste más claro; señalar el avatar con el cursor y esperar ~1 s tras el feedback. |

---

## Cierre sugerido

«Con este flujo, MENTORA no solo evalúa una respuesta, sino que acompaña el proceso de toma de decisiones del estudiante mediante una experiencia visual, narrativa e interactiva. El profesor cierra el ciclo con trazabilidad del recorrido.»

---

*Documento de apoyo para exposición académica · MENTORA*
