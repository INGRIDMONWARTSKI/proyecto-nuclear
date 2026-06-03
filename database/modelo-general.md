# Modelo General

Inventario de entidades del proyecto academico.

## Entidades implementadas actualmente

- `Usuario`
- `Rol`
- `Grupo`
- `EstudianteGrupo`

Estas entidades tienen soporte operativo en el estado actual del repositorio (SQL + backend + frontend para los modulos existentes).

## Modelo SQL de simulacion

- `Caso`
- `Escenario`
- `ElementoEscena`
- `PreguntaDecision`
- `OpcionRespuesta`
- `Retroalimentacion`
- `SesionSimulacion`
- `RespuestaEstudiante`

Estas entidades quedaron preparadas en `database/persona-3-simulacion.sql` para soportar el flujo de simulacion:

Caso -> Escenario -> Elementos visuales -> Pregunta de decision -> Opciones -> Retroalimentacion -> Sesion -> Respuestas.

## Nota de alcance actual

- El modelo de datos SQL de simulacion ya esta definido.
- El modulo funcional de simulacion todavia no esta implementado en backend ni frontend.
