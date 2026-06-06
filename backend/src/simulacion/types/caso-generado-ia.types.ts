import { AllowedBackgroundCode } from '../constants/backgrounds.constant';

export interface RetroalimentacionGeneradaIa {
  mensaje: string;
  tipo?: 'pedagogica' | 'correctiva' | 'refuerzo';
  referenciaTeorica?: string | null;
}

export interface OpcionGeneradaIa {
  texto: string;
  orden: number;
  puntaje: number;
  isCorrecta?: boolean;
  escenarioDestinoOrden?: number | null;
  retroalimentacion: RetroalimentacionGeneradaIa;
}

export interface PreguntaGeneradaIa {
  enunciado: string;
  tipo?: 'single_choice';
  puntajeMaximo?: number;
  opciones: OpcionGeneradaIa[];
}

export interface EscenarioGeneradoIa {
  orden: number;
  titulo: string;
  situacionTexto: string;
  fondoCodigo: AllowedBackgroundCode;
  isFinal: boolean;
  pregunta: PreguntaGeneradaIa | null;
}

export interface CasoGeneradoIa {
  titulo: string;
  descripcion?: string | null;
  objetivoAprendizaje?: string | null;
  escenarios: EscenarioGeneradoIa[];
}
