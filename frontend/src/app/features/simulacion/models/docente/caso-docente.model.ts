import { EscenarioDocente } from './escenario-docente.model';

export type CasoEstado = 'draft' | 'published' | 'archived';

export interface CasoDocente {
  id: string;
  titulo: string;
  descripcion: string | null;
  objetivoAprendizaje: string | null;
  tiempoMaximoMinutos: number;
  autorDocenteId: string;
  autorDocenteNombre?: string | null;
  estado: CasoEstado;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalEscenarios?: number;
  totalPreguntas?: number;
}

export interface CasoDocenteDetalle extends CasoDocente {
  escenarios: EscenarioDocente[];
}

export interface PublicarCasoResponse extends CasoDocente {}

export interface PublicarCasoError {
  message: string;
  errors?: string[];
}
