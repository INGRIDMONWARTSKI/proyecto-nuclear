export const ALLOWED_BACKGROUND_CODES = [
  'aula',
  'oficina_psicologica',
  'casa',
  'comisaria_familia',
  'sala_espera',
] as const;

export type AllowedBackgroundCode = (typeof ALLOWED_BACKGROUND_CODES)[number];
