export interface EscenarioRecord {
  id: string;
  caso_id: string;
  orden: number;
  titulo: string;
  situacion_texto: string;
  fondo_codigo: string;
  is_final: boolean;
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
  createdAt: string;
  updatedAt: string;
}
