export interface GenerarCasoIaPayload {
  instruccion?: string;
  casosReferenciaTexto?: string[];
  casosReferenciaIds?: string[];
  cantidadEscenarios?: number;
}

export interface GenerarCasoIaResponse {
  casoId: string;
  titulo: string;
  totalEscenarios: number;
  modelo: string;
  proveedor: string;
  borradorParcial?: boolean;
  advertencia?: string;
}
