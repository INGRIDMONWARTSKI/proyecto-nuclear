import { CasoDocente } from './caso-docente.model';

export interface RetroalimentacionPreview {
  id: string;
  mensaje: string;
  tipo: 'pedagogica' | 'correctiva' | 'refuerzo';
  referenciaTeorica: string | null;
}

export interface OpcionPreview {
  id: string;
  texto: string;
  orden: number;
  puntaje: number;
  isCorrecta: boolean;
  escenarioDestinoId: string | null;
  retroalimentacion: RetroalimentacionPreview | null;
}

export interface PreguntaPreview {
  id: string;
  enunciado: string;
  tipo: string;
  puntajeMaximo: number;
  opciones: OpcionPreview[];
}

export interface EscenarioPreview {
  id: string;
  orden: number;
  titulo: string;
  situacionTexto: string;
  fondoCodigo: string;
  isFinal: boolean;
  elementos: unknown[];
  pregunta: PreguntaPreview | null;
}

export interface CasoPreview extends CasoDocente {
  escenarios: EscenarioPreview[];
}
