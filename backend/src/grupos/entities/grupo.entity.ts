export interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  profesorId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
