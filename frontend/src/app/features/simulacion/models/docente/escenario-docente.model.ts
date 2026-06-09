export interface EscenarioDocente {
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
