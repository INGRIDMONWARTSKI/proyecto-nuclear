# Requisitos del Proyecto

Este documento alinea los requisitos funcionales con el estado real del repositorio.

## Tabla de requisitos funcionales

| ID | Nombre del requisito | Descripcion | Estado | Prioridad | Modulo relacionado |
| --- | --- | --- | --- | --- | --- |
| RF-01 | Iniciar sesion | Permitir al usuario autenticarse con correo y contrasena para acceder segun su rol. | Implementado | Alta | Auth |
| RF-02 | Cerrar sesion | Permitir al usuario cerrar sesion e invalidar su token activo. | Implementado | Alta | Auth |
| RF-03 | Consultar perfil autenticado | Permitir al usuario consultar su perfil autenticado mediante endpoint seguro. | Implementado | Alta | Auth / Usuarios |
| RF-04 | Registrar usuario | Permitir registrar usuarios con datos basicos y rol permitido por reglas del backend. | Implementado | Alta | Usuarios |
| RF-05 | Consultar usuarios | Permitir consultar el listado de usuarios y su detalle segun permisos. | Implementado | Alta | Usuarios |
| RF-06 | Registrar grupo academico | Permitir registrar un grupo academico con nombre, descripcion y profesor asociado. | Implementado | Alta | Grupos |
| RF-07 | Consultar grupos segun rol | Permitir consultar grupos filtrados por rol (admin, profesor, estudiante). | Implementado | Alta | Grupos |
| RF-08 | Actualizar grupo academico | Permitir actualizar datos del grupo segun permisos del rol. | Implementado | Media | Grupos |
| RF-09 | Desactivar grupo academico | Permitir desactivar un grupo para evitar operaciones academicas sobre grupos inactivos. | Implementado | Media | Grupos |
| RF-10 | Asignar estudiantes a un grupo | Permitir asignar estudiantes activos a un grupo academico. | Implementado | Alta | Grupos |
| RF-11 | Remover estudiantes de un grupo | Permitir remover estudiantes asignados de un grupo academico. | Implementado | Media | Grupos |
| RF-12 | Visualizar salon interactivo | Permitir visualizar un salon interactivo para representar la distribucion de estudiantes del grupo. | Implementado | Media | Salon interactivo |
| RF-13 | Consultar caso psicologico | Permitir consultar la informacion de un caso psicologico para iniciar simulacion. | Implementado | Alta | Simulacion |
| RF-14 | Visualizar escenario del caso | Permitir visualizar un escenario o situacion del caso psicologico. | Implementado | Alta | Simulacion |
| RF-15 | Seleccionar decision u opcion | Permitir seleccionar una decision u opcion de respuesta dentro del escenario. | Implementado | Alta | Simulacion |
| RF-16 | Recibir retroalimentacion | Permitir recibir retroalimentacion inmediata segun la decision seleccionada. | Implementado | Alta | Simulacion |
| RF-17 | Consultar resultado de simulacion | Permitir consultar el resultado o cierre de la simulacion realizada. | Implementado | Alta | Simulacion |
| RF-18 | Registrar sesion de simulacion | Permitir almacenar la sesion de simulacion con trazabilidad de decisiones y resultado. | Implementado | Media | Simulacion |

## Observaciones de alcance

- Los requisitos RF-01 a RF-12 se encuentran evidenciados en el repositorio actual.
- Los requisitos RF-13 a RF-18 ya se encuentran implementados para el flujo estudiante en backend y frontend basico.
- Se mantiene pendiente la capa de edicion visual docente y las pruebas E2E de punta a punta del simulador completo.
- El verbo principal de cada requisito usa acciones especificas (iniciar, cerrar, registrar, consultar, actualizar, desactivar, asignar, remover, visualizar, seleccionar, recibir, almacenar).
