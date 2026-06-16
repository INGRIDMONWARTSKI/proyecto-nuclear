/**
 * Catálogo de recursos visuales reales para la biblioteca del editor MENTORA.
 *
 * Los archivos residen en:  assets/mentora/editor/{categoría}/
 * Nombres de archivo cortos, estables y compatibles con Git en Windows.
 *
 * Estructura de carpetas:
 *   frontend/src/assets/mentora/editor/fondos/
 *   frontend/src/assets/mentora/editor/personajes/
 *   frontend/src/assets/mentora/editor/objetos/
 *   frontend/src/assets/mentora/editor/tarjetas/
 *   frontend/src/assets/mentora/editor/personalizadas/
 */

export type EditorAssetFolder =
  | 'fondos'
  | 'personajes'
  | 'objetos'
  | 'tarjetas'
  | 'personalizadas';

/** Genera la URL pública del asset dentro de assets/mentora/editor/ */
export function assetUrl(folder: EditorAssetFolder, filename: string): string {
  return `assets/mentora/editor/${folder}/${encodeURIComponent(filename)}`;
}

/** Entrada del catálogo de recursos visuales */
export interface EditorAssetEntry {
  id: string;
  titulo: string;
  descripcion: string;
  tag: string;
  previewUrl: string;
  backgroundCode?: string;
}

// ─────────────────────────────────────────────
//  F O N D O S  —  6 fondos
// ─────────────────────────────────────────────
export const FONDOS_CATALOG: EditorAssetEntry[] = [
  {
    id: 'consultorio_psicosocial',
    titulo: 'Consultorio psicosocial',
    descripcion: 'Espacio profesional y sereno para entrevistas clínicas.',
    tag: 'Clínico',
    backgroundCode: 'oficina_psicologica',
    previewUrl: assetUrl('fondos', 'consultorio-psicosocial-01.png'),
  },
  {
    id: 'aula_academica',
    titulo: 'Aula académica',
    descripcion: 'Contexto educativo para convivencia, observación y apoyo.',
    tag: 'Académico',
    backgroundCode: 'aula',
    previewUrl: assetUrl('fondos', 'aula-academica-01.png'),
  },
  {
    id: 'hospital_urgencias',
    titulo: 'Hospital de urgencias',
    descripcion: 'Sala de urgencias para intervenciones en crisis.',
    tag: 'Médico',
    backgroundCode: 'hospital_urgencias',
    previewUrl: assetUrl('fondos', 'hospital-urgencias-01.png'),
  },
  {
    id: 'comisaria_familia',
    titulo: 'Comisaría de familia',
    descripcion: 'Espacio institucional para protección y orientación familiar.',
    tag: 'Institucional',
    backgroundCode: 'comisaria_familia',
    previewUrl: assetUrl('fondos', 'comisaria-familia-01.png'),
  },
  {
    id: 'hogar_familiar',
    titulo: 'Hogar familiar',
    descripcion: 'Entorno doméstico para casos de dinámica familiar.',
    tag: 'Entorno',
    backgroundCode: 'hogar_familiar',
    previewUrl: assetUrl('fondos', 'hogar-familiar-01.png'),
  },
  {
    id: 'sala_entrevista',
    titulo: 'Sala de entrevista',
    descripcion: 'Sala neutra y confidencial para entrevistas formales.',
    tag: 'Neutral',
    backgroundCode: 'sala_entrevista',
    previewUrl: assetUrl('fondos', 'sala-entrevista-01.png'),
  },
];

// ─────────────────────────────────────────────────────────────
//  P E R S O N A J E S  —  15 personajes curados
// ─────────────────────────────────────────────────────────────
export const PERSONAJES_CATALOG: EditorAssetEntry[] = [
  {
    id: 'paciente_mujer',
    titulo: 'Paciente mujer',
    descripcion: 'Paciente mujer adulta para simulación psicosocial.',
    tag: 'Consultante',
    previewUrl: assetUrl('personajes', 'paciente-mujer-01.jpg'),
  },
  {
    id: 'paciente_hombre',
    titulo: 'Paciente hombre',
    descripcion: 'Consultante masculino en postura reflexiva o conversacional.',
    tag: 'Consultante',
    previewUrl: assetUrl('personajes', 'paciente-hombre-01.jpg'),
  },
  {
    id: 'psicologo_profesional',
    titulo: 'Psicóloga profesional',
    descripcion: 'Psicóloga de pie en postura amable y profesional.',
    tag: 'Profesional',
    previewUrl: assetUrl('personajes', 'profesional-psicologia-mujer-01.jpg'),
  },
  {
    id: 'psicologo_hombre',
    titulo: 'Psicólogo hombre',
    descripcion: 'Profesional masculino con vestimenta sobria y postura segura.',
    tag: 'Profesional',
    previewUrl: assetUrl('personajes', 'profesional-psicologia-hombre-01.jpg'),
  },
  {
    id: 'trabajador_social',
    titulo: 'Trabajador social',
    descripcion: 'Profesional de apoyo con postura empática y accesible.',
    tag: 'Profesional',
    previewUrl: assetUrl('personajes', 'trabajador-social-01.jpg'),
  },
  {
    id: 'medico_profesional',
    titulo: 'Médico',
    descripcion: 'Médico o profesional de salud en postura profesional.',
    tag: 'Médico',
    previewUrl: assetUrl('personajes', 'medico-01.jpg'),
  },
  {
    id: 'estudiante_psicologia',
    titulo: 'Estudiante de psicología',
    descripcion: 'Estudiante universitario con vestimenta casual académica.',
    tag: 'Estudiante',
    previewUrl: assetUrl('personajes', 'estudiante-psicologia-01.jpg'),
  },
  {
    id: 'familia_grupo',
    titulo: 'Familia o grupo familiar',
    descripcion: 'Grupo familiar en postura cercana y amigable.',
    tag: 'Familia',
    previewUrl: assetUrl('personajes', 'familia-01.jpg'),
  },
  {
    id: 'personaje_a',
    titulo: 'Personaje A',
    descripcion: 'Personaje de contexto para escena psicosocial.',
    tag: 'Personaje',
    previewUrl: assetUrl('personajes', 'personaje-contexto-01.png'),
  },
  {
    id: 'personaje_b',
    titulo: 'Personaje B',
    descripcion: 'Personaje de contexto para escena psicosocial.',
    tag: 'Personaje',
    previewUrl: assetUrl('personajes', 'personaje-contexto-02.png'),
  },
  {
    id: 'personaje_c',
    titulo: 'Personaje C',
    descripcion: 'Personaje de apoyo institucional.',
    tag: 'Personaje',
    previewUrl: assetUrl('personajes', 'personaje-contexto-03.png'),
  },
  {
    id: 'personaje_d',
    titulo: 'Personaje D',
    descripcion: 'Personaje adicional de acompañamiento.',
    tag: 'Personaje',
    previewUrl: assetUrl('personajes', 'personaje-contexto-04.png'),
  },
  {
    id: 'personaje_e',
    titulo: 'Personaje E',
    descripcion: 'Personaje adicional para contexto escolar.',
    tag: 'Personaje',
    previewUrl: assetUrl('personajes', 'docente-mujer-01.png'),
  },
  {
    id: 'personaje_f',
    titulo: 'Personaje F',
    descripcion: 'Personaje institucional adicional.',
    tag: 'Personaje',
    previewUrl: assetUrl('personajes', 'funcionario-institucional-01.png'),
  },
  {
    id: 'personaje_g',
    titulo: 'Personaje G',
    descripcion: 'Personaje de contexto adicional.',
    tag: 'Personaje',
    previewUrl: assetUrl('personajes', 'funcionario-institucional-02.png'),
  },
];

// ─────────────────────────────────────────────────────────────
//  O B J E T O S  —  16 objetos curados
// ─────────────────────────────────────────────────────────────
export const OBJETOS_CATALOG: EditorAssetEntry[] = [
  {
    id: 'boligrafo',
    titulo: 'Bolígrafo',
    descripcion: 'Bolígrafo o pluma de escritura sobre superficie.',
    tag: 'Escritura',
    previewUrl: assetUrl('objetos', 'boligrafo-01.jpg'),
  },
  {
    id: 'caja_panuelos',
    titulo: 'Caja de pañuelos',
    descripcion: 'Caja de pañuelos para contexto de atención emocional.',
    tag: 'Clínico',
    previewUrl: assetUrl('objetos', 'caja-panuelos-01.jpg'),
  },
  {
    id: 'calendario',
    titulo: 'Calendario',
    descripcion: 'Calendario de escritorio o pared sin fechas específicas.',
    tag: 'Organización',
    previewUrl: assetUrl('objetos', 'calendario-01.jpg'),
  },
  {
    id: 'carpeta_caso',
    titulo: 'Carpeta de caso',
    descripcion: 'Carpeta psicosocial cerrada con hojas asomando.',
    tag: 'Evidencia',
    previewUrl: assetUrl('objetos', 'carpeta-caso-01.jpg'),
  },
  {
    id: 'computador',
    titulo: 'Computador portátil',
    descripcion: 'Computador portátil moderno y sobrio.',
    tag: 'Tecnología',
    previewUrl: assetUrl('objetos', 'computador-01.jpg'),
  },
  {
    id: 'cuaderno',
    titulo: 'Cuaderno',
    descripcion: 'Cuaderno o libreta de notas cerrada con portada verde.',
    tag: 'Escritura',
    previewUrl: assetUrl('objetos', 'cuaderno-01.jpg'),
  },
  {
    id: 'documento',
    titulo: 'Documento institucional',
    descripcion: 'Documento o historia clínica con líneas abstractas.',
    tag: 'Evidencia',
    previewUrl: assetUrl('objetos', 'documento-01.jpg'),
  },
  {
    id: 'lampara',
    titulo: 'Lámpara',
    descripcion: 'Lámpara minimalista de escritorio en verde suave.',
    tag: 'Ambiente',
    previewUrl: assetUrl('objetos', 'lampara-01.jpg'),
  },
  {
    id: 'librero',
    titulo: 'Librero',
    descripcion: 'Estantería de consultorio con libros en tonos verdes y crema.',
    tag: 'Ambiente',
    previewUrl: assetUrl('objetos', 'librero-01.jpg'),
  },
  {
    id: 'mesa',
    titulo: 'Mesa de consultorio',
    descripcion: 'Mesa pequeña de consultorio en madera clara.',
    tag: 'Mueble',
    previewUrl: assetUrl('objetos', 'mesa-01.jpg'),
  },
  {
    id: 'planta',
    titulo: 'Planta de interior',
    descripcion: 'Planta de interior en maceta con hojas verdes naturales.',
    tag: 'Ambiente',
    previewUrl: assetUrl('objetos', 'planta-01.jpg'),
  },
  {
    id: 'reloj',
    titulo: 'Reloj de pared',
    descripcion: 'Reloj de pared minimalista en verde suave o madera.',
    tag: 'Ambiente',
    previewUrl: assetUrl('objetos', 'reloj-01.jpg'),
  },
  {
    id: 'senal_alerta',
    titulo: 'Señal de alerta',
    descripcion: 'Señal visual de alerta psicosocial sutil y profesional.',
    tag: 'Alerta',
    previewUrl: assetUrl('objetos', 'senal-alerta-01.jpg'),
  },
  {
    id: 'silla',
    titulo: 'Silla de consultorio',
    descripcion: 'Silla cómoda de consultorio en verde suave o beige.',
    tag: 'Mueble',
    previewUrl: assetUrl('objetos', 'silla-01.jpg'),
  },
  {
    id: 'taza',
    titulo: 'Taza de café',
    descripcion: 'Taza de café o té sobre platillo en colores cálidos.',
    tag: 'Ambiente',
    previewUrl: assetUrl('objetos', 'taza-01.jpg'),
  },
  {
    id: 'telefono',
    titulo: 'Teléfono',
    descripcion: 'Teléfono de oficina o celular institucional.',
    tag: 'Tecnología',
    previewUrl: assetUrl('objetos', 'telefono-01.jpg'),
  },
];

// ─────────────────────────────────────────────
//  T A R J E T A S  —  4 tarjetas visuales
// ─────────────────────────────────────────────
export const TARJETAS_CATALOG: EditorAssetEntry[] = [
  {
    id: 'tarjeta_guia',
    titulo: 'Tarjeta guía',
    descripcion: 'Tarjeta visual de orientación para el estudiante.',
    tag: 'Guía',
    previewUrl: assetUrl('tarjetas', 'tarjeta-guia-01.png'),
  },
  {
    id: 'tarjeta_contexto',
    titulo: 'Tarjeta de contexto',
    descripcion: 'Tarjeta para presentar información contextual de la escena.',
    tag: 'Contexto',
    previewUrl: assetUrl('tarjetas', 'tarjeta-contexto-01.png'),
  },
  {
    id: 'tarjeta_pregunta',
    titulo: 'Tarjeta de pregunta',
    descripcion: 'Tarjeta visual para enunciados y preguntas de intervención.',
    tag: 'Pregunta',
    previewUrl: assetUrl('tarjetas', 'tarjeta-pregunta-01.png'),
  },
  {
    id: 'tarjeta_reflexion',
    titulo: 'Tarjeta de reflexión',
    descripcion: 'Tarjeta para reflexiones y puntos clave de aprendizaje.',
    tag: 'Reflexión',
    previewUrl: assetUrl('tarjetas', 'tarjeta-reflexion-01.png'),
  },
];

// ─────────────────────────────────────────────────────────────
//  P E R S O N A L I Z A D A S  —  escenas propias MENTORA
// ─────────────────────────────────────────────────────────────
export const PERSONALIZADAS_CATALOG: EditorAssetEntry[] = [
  {
    id: 'escena_1_entrevista_psicosocial',
    titulo: 'Escena 1 — Entrevista psicosocial',
    descripcion: 'Escena personalizada de entrevista psicosocial en contexto clínico.',
    tag: 'Personalizada',
    previewUrl: assetUrl('personalizadas', 'escena-1.png'),
  },
  {
    id: 'escena_2_acompanamiento_hospitalario',
    titulo: 'Escena 2 — Acompañamiento hospitalario',
    descripcion: 'Escena personalizada de acompañamiento en entorno hospitalario.',
    tag: 'Personalizada',
    previewUrl: assetUrl('personalizadas', 'escena-2.png'),
  },
];
