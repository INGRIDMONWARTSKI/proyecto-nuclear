export interface RetroalimentacionRecord {
  id: string;
  opcion_id: string;
  mensaje: string;
  tipo: 'pedagogica' | 'correctiva' | 'refuerzo';
  referencia_teorica: string | null;
  created_at: string;
  updated_at: string;
}

export interface Retroalimentacion {
  id: string;
  opcionId: string;
  mensaje: string;
  tipo: 'pedagogica' | 'correctiva' | 'refuerzo';
  referenciaTeorica: string | null;
  createdAt: string;
  updatedAt: string;
}
