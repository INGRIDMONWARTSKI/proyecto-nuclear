export interface EscenarioRecord {
  id: string;
  caso_id: string;
  orden: number;
  titulo: string;
  situacion_texto: string;
  fondo_codigo: string;
  is_final: boolean;
  layout_version: number | null;
  layout_data: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface Escenario {
  id: string;
  casoId: string;
  orden: number;
  titulo: string;
  situacionTexto: string;
  fondoCodigo: string;
  isFinal: boolean;
  layoutVersion: number | null;
  layoutData: unknown | null;
  createdAt: string;
  updatedAt: string;
}
