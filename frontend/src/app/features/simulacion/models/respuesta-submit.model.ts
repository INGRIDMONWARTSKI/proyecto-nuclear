export interface RespuestaSubmitPayload {
  preguntaId: string;
  opcionId: string;
}

export interface RespuestaSubmitResponse {
  respuestaId: string;
  puntajeObtenido: number;
  completed: boolean;
  respondidas: number;
  totalPreguntas: number;
  mensaje: string;
  resultadoUrl?: string;
}
