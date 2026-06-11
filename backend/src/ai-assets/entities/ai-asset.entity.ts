export type AiAssetType = 'FONDO' | 'PERSONAJE' | 'OBJETO' | 'ESCENA_COMPLETA';

export interface AiAssetRecord {
  id: string;
  caso_id: string;
  escenario_id: string | null;
  docente_id: string;
  tipo: AiAssetType;
  nombre: string;
  prompt_original: string;
  prompt_final: string;
  url_externa: string;
  ruta_archivo: string;
  ancho: number | null;
  alto: number | null;
  estilo: string;
  proveedor: string;
  created_at: string;
}

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
  estilo: string;
  proveedor: string;
  createdAt: string;
}
