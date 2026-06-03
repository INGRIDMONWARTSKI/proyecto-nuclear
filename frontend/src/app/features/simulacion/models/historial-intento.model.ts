export interface HistorialIntento {
  sesionId: string;
  casoId: string;
  casoTitulo: string;
  estado: 'completed';
  puntajeTotal: number;
  fechaInicio: string;
  fechaFinalizacion: string | null;
}
