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
  enunciado: string;
  tipo: 'single_choice';
  opciones: OpcionEscenario[];
}

export interface EscenarioActual {
  id: string;
  orden: number;
  titulo: string;
  situacionTexto: string;
  fondoCodigo: string;
  elementos: EscenarioElemento[];
  pregunta: PreguntaEscenario;
}

export interface EscenarioActualResponse {
  sesionId: string;
  casoId: string;
  escenario?: EscenarioActual;
  progreso: {
    totalPreguntas: number;
    respondidas: number;
  };
  completed?: boolean;
}
