export type AiAssetType = 'FONDO' | 'PERSONAJE' | 'OBJETO' | 'ESCENA_COMPLETA';

export type AiAssetStyle = 'editorial_sereno' | 'acuarela_suave' | 'minimal_calido';

export interface AiAsset {
  id: string;
  casoId: string;
  escenarioId: string | null;
  docenteId: string;
  tipo: AiAssetType;
  nombre: string;
  promptOriginal: string;
  promptFinal: string;
  urlExterna: string;
  rutaArchivo: string;
  publicUrl: string;
  ancho: number | null;
  alto: number | null;
  estilo: AiAssetStyle;
  proveedor: string;
  createdAt: string;
}
