export interface OpcionRespuestaRecord {
  id: string;
  pregunta_id: string;
  texto: string;
  orden: number;
  puntaje: number;
  is_correcta: boolean;
  escenario_destino_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpcionRespuesta {
  id: string;
  preguntaId: string;
  texto: string;
  orden: number;
  puntaje: number;
  isCorrecta: boolean;
  escenarioDestinoId: string | null;
  createdAt: string;
  updatedAt: string;
}
