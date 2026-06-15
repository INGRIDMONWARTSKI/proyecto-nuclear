import { EscenarioLayout } from './docente/editor-layout.model';

export interface EscenarioElemento {
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
}

export interface OpcionEscenario {
  id: string;
  texto: string;
  orden: number;
}

export interface PreguntaEscenario {
  id: string;
  orden: number;
  enunciado: string;
  tipo: 'single_choice';
  opcionSeleccionadaId: string | null;
  opciones: OpcionEscenario[];
}

export interface PreguntaNavegacion {
  preguntaId: string;
  escenarioId: string;
  escenarioOrden: number;
  escenarioTitulo: string;
  preguntaOrden: number;
  enunciado: string;
  respondida: boolean;
  opcionSeleccionadaId: string | null;
}

export interface EscenarioActual {
  id: string;
  orden: number;
  titulo: string;
  situacionTexto: string;
  fondoCodigo: string;
  layout: EscenarioLayout;
  elementos: EscenarioElemento[];
  pregunta: PreguntaEscenario;
}

export interface EscenarioActualResponse {
  sesionId: string;
  casoId: string;
  startedAt: string;
  tiempoMaximoMinutos: number;
  remainingSeconds: number;
  finalizacionTipo: 'manual' | 'timeout' | null;
  navegacion: PreguntaNavegacion[];
  escenario?: EscenarioActual;
  progreso: {
    totalPreguntas: number;
    respondidas: number;
  };
  completed?: boolean;
}
