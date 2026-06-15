export interface RubricaCriterioRecord {
  id: string;
  caso_id: string;
  criterio: string;
  descripcion: string;
  nivel_esperado: string | null;
  peso: number | null;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface RubricaCriterio {
  id: string;
  casoId: string;
  criterio: string;
  descripcion: string;
  nivelEsperado: string | null;
  peso: number | null;
  orden: number;
  createdAt: string;
  updatedAt: string;
}
