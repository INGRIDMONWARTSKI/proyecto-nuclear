import { Caso } from '../entities/caso.entity';
import { EscenarioLayout } from './editor-layout.types';

export interface EditorScenarioConnection {
  opcionId: string;
  opcionTexto: string;
  origenEscenarioId: string;
  origenOrden: number;
  destinoEscenarioId: string | null;
  destinoOrden: number | null;
  tipo: 'explicito' | 'orden' | 'fin';
}

export interface CasoEditorScenario {
  id: string;
  orden: number;
  titulo: string;
  situacionTexto: string;
  fondoCodigo: string;
  isFinal: boolean;
  layout: EscenarioLayout;
  pregunta: {
    id: string;
    enunciado: string;
    tipo: 'single_choice';
    puntajeMaximo: number;
    opciones: Array<{
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
    }>;
  } | null;
}

export interface CasoEditor extends Caso {
  escenarios: CasoEditorScenario[];
  conexiones: EditorScenarioConnection[];
  catalogos: {
    backgrounds: string[];
    elementTypes: string[];
  };
  validationErrors: string[];
}
