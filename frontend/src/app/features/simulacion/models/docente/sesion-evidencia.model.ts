export interface SesionEvidencia {
  sesionId: string;
  estudianteId: string;
  estado: 'in_progress' | 'completed' | 'abandoned';
  puntajeTotal: number;
  totalPreguntas: number;
  respondidas: number;
  startedAt: string;
  finishedAt: string | null;
}
