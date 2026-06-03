export interface RespuestaEstudianteRecord {
  id: string;
  sesion_id: string;
  pregunta_id: string;
  opcion_id: string;
  escenario_id: string;
  puntaje_obtenido: number;
  respondida_at: string;
}

export interface RespuestaEstudiante {
  id: string;
  sesionId: string;
  preguntaId: string;
  opcionId: string;
  escenarioId: string;
  puntajeObtenido: number;
  respondidaAt: string;
}
