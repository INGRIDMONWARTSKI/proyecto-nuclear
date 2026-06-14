export interface ImportEstudianteItem {
  fullName: string;
  email: string;
  estado: string;
  observacion: string;
  temporaryPassword?: string;
  correoEnviado?: boolean;
}

export interface ImportCredencialItem {
  fullName: string;
  email: string;
  temporaryPassword: string;
  estado: string;
  correoEnviado?: boolean;
}

export interface ImportarEstudiantesResponse {
  totalFilas: number;
  creados: ImportEstudianteItem[];
  existentesAsignados: ImportEstudianteItem[];
  duplicados: ImportEstudianteItem[];
  errores: ImportEstudianteItem[];
  reporteCredenciales: ImportCredencialItem[];
}
