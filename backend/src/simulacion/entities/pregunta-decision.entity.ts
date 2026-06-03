export interface PreguntaDecisionRecord {
  id: string;
  escenario_id: string;
  enunciado: string;
  tipo: 'single_choice';
  puntaje_maximo: number;
  created_at: string;
  updated_at: string;
}

export interface PreguntaDecision {
  id: string;
  escenarioId: string;
  enunciado: string;
  tipo: 'single_choice';
  puntajeMaximo: number;
  createdAt: string;
  updatedAt: string;
}
