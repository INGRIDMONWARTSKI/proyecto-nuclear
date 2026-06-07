export type EditorElementType =
  | 'background'
  | 'character'
  | 'text'
  | 'image'
  | 'object'
  | 'audio'
  | 'question'
  | 'instruction'
  | 'feedback';

export interface EditorElementBase {
  id: string;
  type: EditorElementType;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  rotation: number;
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  style: Record<string, string | number | boolean | null>;
  content: Record<string, unknown>;
  bindings: {
    preguntaId?: string | null;
    opcionId?: string | null;
    retroalimentacionId?: string | null;
    escenarioDestinoId?: string | null;
  };
}

export interface EditorCharacterContent {
  nombre: string;
  rol: string;
  avatar: string | null;
  expresion: string;
  estadoEmocional: string;
  dialogo: string;
}

export interface EditorQuestionBinding {
  preguntaId: string | null;
  optionIds: string[];
}

export interface EscenarioLayout {
  version: number;
  elements: EditorElementBase[];
}
