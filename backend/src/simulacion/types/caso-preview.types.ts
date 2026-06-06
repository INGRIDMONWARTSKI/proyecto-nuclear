import { AllowedBackgroundCode } from '../constants/backgrounds.constant';
import { Caso } from '../entities/caso.entity';

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
  tipo: 'single_choice';
  puntajeMaximo: number;
  opciones: OpcionPreview[];
}

export interface ElementoEscenaPreview {
  id: string;
  tipo: 'personaje' | 'objeto' | 'texto';
  assetCodigo: string | null;
  textoContenido: string | null;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  rotacion: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface EscenarioPreview {
  id: string;
  orden: number;
  titulo: string;
  situacionTexto: string;
  fondoCodigo: AllowedBackgroundCode;
  isFinal: boolean;
  elementos: ElementoEscenaPreview[];
  pregunta: PreguntaPreview | null;
}

export interface CasoPreviewTree extends Caso {
  escenarios: EscenarioPreview[];
}
