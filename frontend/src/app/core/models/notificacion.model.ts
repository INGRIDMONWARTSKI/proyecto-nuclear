export type NotificacionEntidadTipo = 'GRUPO' | 'CASO' | 'USUARIO';

export interface Notificacion {
  id: string;
  usuarioIdDestino: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  entidadTipo: NotificacionEntidadTipo | null;
  entidadId: string | null;
  leida: boolean;
  createdAt: string;
}

export interface NotificacionesCount {
  count: number;
}
