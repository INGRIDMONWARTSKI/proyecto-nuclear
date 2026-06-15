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
