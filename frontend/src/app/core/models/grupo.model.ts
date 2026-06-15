export interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  semestre: string | null;
  profesorId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrearGrupoPayload {
  nombre: string;
  descripcion?: string;
  semestre: string;
  profesorId?: string;
}

export interface ActualizarGrupoPayload {
  nombre?: string;
  descripcion?: string;
  semestre?: string;
  profesorId?: string;
  isActive?: boolean;
}

export interface AsignarEstudiantesPayload {
  estudianteIds: string[];
}

export interface DesactivarGrupoResponse {
  message: string;
  grupo: Grupo;
}
