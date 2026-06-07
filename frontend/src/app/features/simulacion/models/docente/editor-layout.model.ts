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

export interface EditorElementBindings {
  preguntaId?: string | null;
  opcionId?: string | null;
  retroalimentacionId?: string | null;
  escenarioDestinoId?: string | null;
}

export interface EditorElement {
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
  bindings: EditorElementBindings;
}

export interface EscenarioLayout {
  version: number;
  elements: EditorElement[];
}
