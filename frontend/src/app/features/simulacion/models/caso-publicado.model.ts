export interface CasoPublicado {
  id: string;
  titulo: string;
  descripcion: string | null;
  objetivoAprendizaje: string | null;
  totalEscenarios: number;
  publishedAt: string | null;
  tieneReintentoAutorizado: boolean;
}
