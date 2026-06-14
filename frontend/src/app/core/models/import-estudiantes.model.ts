export interface ImportEstudianteItem {
  fullName: string;
  email: string;
  estado: string;
  observacion: string;
  temporaryPassword?: string;
  correoEnviado?: boolean;
}

export interface ImportCredencialItem {
  fullName: string;
  email: string;
  temporaryPassword: string;
  estado: string;
  correoEnviado?: boolean;
}

export interface ImportarEstudiantesResponse {
  totalFilas: number;
  creados: ImportEstudianteItem[];
  existentesAsignados: ImportEstudianteItem[];
  duplicados: ImportEstudianteItem[];
  errores: ImportEstudianteItem[];
  reporteCredenciales: ImportCredencialItem[];
}

export type ImportResultRow = ImportEstudianteItem & {
  categoria: 'creado' | 'existente_asignado' | 'duplicado' | 'error';
};

export function flattenImportResults(
  response: ImportarEstudiantesResponse,
): ImportResultRow[] {
  return [
    ...response.creados.map((item) => ({ ...item, categoria: 'creado' as const })),
    ...response.existentesAsignados.map((item) => ({
      ...item,
      categoria: 'existente_asignado' as const,
    })),
    ...response.duplicados.map((item) => ({ ...item, categoria: 'duplicado' as const })),
    ...response.errores.map((item) => ({ ...item, categoria: 'error' as const })),
  ];
}

export function buildPlantillaCsv(): string {
  return [
    'fullName,email',
    'Ana Martínez,ana.martinez@mentora.edu',
    'Carlos Rojas,carlos.rojas@mentora.edu',
  ].join('\n');
}

export function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildReporteCredencialesCsv(
  response: ImportarEstudiantesResponse,
): string {
  const lines = ['fullName,email,temporaryPassword,estado,correoEnviado'];
  for (const item of response.reporteCredenciales) {
    lines.push(
      `"${item.fullName.replace(/"/g, '""')}","${item.email}","${item.temporaryPassword}","${item.estado}","${item.correoEnviado ? 'si' : 'no'}"`,
    );
  }
  return lines.join('\n');
}
