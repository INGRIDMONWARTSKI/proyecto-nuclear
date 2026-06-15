export type NotificacionTipo =
  | 'GRUPO_CREADO'
  | 'CASO_PUBLICADO'
  | 'ESTUDIANTE_CREADO'
  | 'ESTUDIANTES_IMPORTADOS'
  | 'CASO_ASIGNADO'
  | 'NOTA_DISPONIBLE'
  | 'CASO_ASIGNADO_GRUPO'
  | 'REINTENTO_AUTORIZADO'
  | 'FEEDBACK_DOCENTE';

export type NotificacionEntidadTipo = 'GRUPO' | 'CASO' | 'USUARIO' | 'SESION';

export interface NotificacionRecord {
  id: string;
  usuario_id_destino: string;
  tipo: NotificacionTipo;
  titulo: string;
  mensaje: string;
  entidad_tipo: NotificacionEntidadTipo | null;
  entidad_id: string | null;
  leida: boolean;
  created_at: string;
  archived_at: string | null;
}

export interface Notificacion {
  id: string;
  usuarioIdDestino: string;
  tipo: NotificacionTipo;
  titulo: string;
  mensaje: string;
  entidadTipo: NotificacionEntidadTipo | null;
  entidadId: string | null;
  leida: boolean;
  createdAt: string;
  archivedAt: string | null;
}

export type CrearNotificacionPayload = Pick<
  NotificacionRecord,
  'tipo' | 'titulo' | 'mensaje' | 'entidad_tipo' | 'entidad_id'
>;
