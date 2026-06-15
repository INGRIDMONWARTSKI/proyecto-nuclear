export interface SesionSimulacionRecord {
  id: string;
  caso_id: string;
  estudiante_id: string;
  estado: 'in_progress' | 'completed' | 'abandoned';
  puntaje_total: number;
  total_preguntas: number;
  respondidas: number;
  started_at: string;
  finished_at: string | null;
  finalizacion_tipo: 'manual' | 'timeout' | null;
  created_at: string;
  updated_at: string;
}

export interface SesionSimulacion {
  id: string;
  casoId: string;
  estudianteId: string;
  estado: 'in_progress' | 'completed' | 'abandoned';
  puntajeTotal: number;
  totalPreguntas: number;
  respondidas: number;
  startedAt: string;
  finishedAt: string | null;
  finalizacionTipo: 'manual' | 'timeout' | null;
  createdAt: string;
  updatedAt: string;
}
