export interface SesionInicioResponse {
  sesionId: string;
  caso: {
    id: string;
    titulo: string;
    descripcion: string | null;
    objetivoAprendizaje: string | null;
  };
  primerEscenario: {
    id: string;
    orden: number;
    titulo: string;
    situacionTexto: string;
    fondoCodigo: string;
    isFinal: boolean;
  };
}

export interface FinalizarSesionResponse {
  id: string;
  caso_id: string;
  estudiante_id: string;
  estado: 'in_progress' | 'completed' | 'abandoned';
  puntaje_total: number;
  total_preguntas: number;
  respondidas: number;
  started_at: string;
  finished_at: string | null;
}
