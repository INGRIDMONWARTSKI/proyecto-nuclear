export const BACKGROUND_OPTIONS = [
  { code: 'aula', label: 'Aula' },
  { code: 'oficina_psicologica', label: 'Oficina psicológica' },
  { code: 'casa', label: 'Casa' },
  { code: 'comisaria_familia', label: 'Comisaría de familia' },
  { code: 'sala_espera', label: 'Sala de espera' },
] as const;

export type BackgroundCode = (typeof BACKGROUND_OPTIONS)[number]['code'];
