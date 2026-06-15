export interface PreguntaDecisionRecord {
  id: string;
  escenario_id: string;
  orden: number;
  enunciado: string;
  tipo: 'single_choice';
  puntaje_maximo: number;
  created_at: string;
  updated_at: string;
}

export interface PreguntaDecision {
  id: string;
  escenarioId: string;
  orden: number;
  enunciado: string;
  tipo: 'single_choice';
  puntajeMaximo: number;
  createdAt: string;
  updatedAt: string;
}
