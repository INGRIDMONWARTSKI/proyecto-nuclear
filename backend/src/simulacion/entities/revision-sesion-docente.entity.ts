import { ResultadoSimulacion } from './resultado-simulacion.entity';

export interface RevisionSesionDocente extends ResultadoSimulacion {
  estudiante: {
    id: string;
    nombre: string;
    email: string;
  };
  fechaInicio: string;
  fechaFinalizacion: string | null;
}
