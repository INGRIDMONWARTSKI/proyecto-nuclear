export interface CasoRecord {
  id: string;
  titulo: string;
  descripcion: string | null;
  objetivo_aprendizaje: string | null;
  autor_docente_id: string;
  estado: 'draft' | 'published' | 'archived';
  is_active: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Caso {
  id: string;
  titulo: string;
  descripcion: string | null;
  objetivoAprendizaje: string | null;
  autorDocenteId: string;
  estado: 'draft' | 'published' | 'archived';
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
