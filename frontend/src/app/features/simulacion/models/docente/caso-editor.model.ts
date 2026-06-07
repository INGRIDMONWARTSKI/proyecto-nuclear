import { CasoDocente } from './caso-docente.model';
import { EscenarioLayout } from './editor-layout.model';

export interface CasoEditorConnection {
  opcionId: string;
  opcionTexto: string;
  origenEscenarioId: string;
  origenOrden: number;
  destinoEscenarioId: string | null;
  destinoOrden: number | null;
  tipo: 'explicito' | 'orden' | 'fin';
}

export interface CasoEditorOpcion {
  id: string;
  texto: string;
  orden: number;
  puntaje: number;
  isCorrecta: boolean;
  escenarioDestinoId: string | null;
  retroalimentacion: {
    id: string;
    mensaje: string;
    tipo: 'pedagogica' | 'correctiva' | 'refuerzo';
    referenciaTeorica: string | null;
  } | null;
}

export interface CasoEditorPregunta {
  id: string;
  enunciado: string;
  tipo: 'single_choice';
  puntajeMaximo: number;
  opciones: CasoEditorOpcion[];
}

export interface CasoEditorEscenario {
  id: string;
  orden: number;
  titulo: string;
  situacionTexto: string;
  fondoCodigo: string;
  isFinal: boolean;
  layout: EscenarioLayout;
  pregunta: CasoEditorPregunta | null;
}

export interface CasoEditor extends CasoDocente {
  escenarios: CasoEditorEscenario[];
  conexiones: CasoEditorConnection[];
  catalogos: {
    backgrounds: string[];
    elementTypes: string[];
  };
  validationErrors: string[];
}
