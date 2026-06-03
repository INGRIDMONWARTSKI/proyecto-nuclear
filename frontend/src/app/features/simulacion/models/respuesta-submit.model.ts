export interface RespuestaSubmitPayload {
  preguntaId: string;
  opcionId: string;
}

export interface RespuestaSubmitResponse {
  respuestaId: string;
  puntajeObtenido: number;
  retroalimentacion: {
    mensaje: string;
    tipo: 'pedagogica' | 'correctiva' | 'refuerzo';
    referenciaTeorica: string | null;
  } | null;
  completed: boolean;
  nextEscenarioId?: string;
  resultadoUrl?: string;
}
