export interface EvidenciaDocente {
  sesionId: string;
  casoId: string;
  casoTitulo: string;
  estudianteId: string;
  estudianteNombre: string;
  estudianteEmail: string;
  estado: 'completed';
  puntajeTotal: number;
  fechaInicio: string;
  fechaFinalizacion: string | null;
}
