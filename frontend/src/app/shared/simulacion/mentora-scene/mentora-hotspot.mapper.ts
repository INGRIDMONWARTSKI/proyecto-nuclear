import { EscenarioActual } from '../../../features/simulacion/models/escenario-actual.model';
import {
  EditorElement,
  EditorElementType,
} from '../../../features/simulacion/models/docente/editor-layout.model';

export interface MentoraHotspotConfig {
  id: string;
  title: string;
  description: string;
  category: string;
  xRatio: number;
  yRatio: number;
  color: number;
  important?: boolean;
}

export const MENTORA_FALLBACK_HOTSPOT_TOTAL = 3;

const MENTORA_COLORS = {
  lavender: 0xcde8b5,
  accent: 0x7cb342,
  amber: 0xf3c96b,
  success: 0x7cb342,
};

const EXCLUDED_TYPES: EditorElementType[] = ['background', 'audio'];

const HOTSPOT_TYPES: ReadonlySet<EditorElementType> = new Set([
  'character',
  'object',
  'text',
  'instruction',
  'question',
  'feedback',
  'image',
]);

const RISK_KEYWORDS = [
  'riesgo',
  'alerta',
  'peligro',
  'vulnerabilidad',
  'crisis',
  'urgencia',
  'violencia',
  'amenaza',
];

export const FALLBACK_HOTSPOTS: MentoraHotspotConfig[] = [
  {
    id: 'contexto-familiar',
    title: 'Contexto familiar',
    category: 'Contexto psicosocial',
    description:
      'Explora vínculos, dinámicas y factores protectores del entorno familiar del caso.',
    xRatio: 0.22,
    yRatio: 0.58,
    color: 0x7cb342,
  },
  {
    id: 'senales-riesgo',
    title: 'Señales de riesgo',
    category: 'Alerta clínica',
    description:
      'Identifica indicadores de alerta emocional, conductual o situacional que requieren intervención.',
    xRatio: 0.5,
    yRatio: 0.42,
    color: MENTORA_COLORS.amber,
    important: true,
  },
  {
    id: 'red-apoyo',
    title: 'Red de apoyo',
    category: 'Recursos de apoyo',
    description:
      'Revisa recursos comunitarios, institucionales y figuras de contención disponibles.',
    xRatio: 0.78,
    yRatio: 0.58,
    color: MENTORA_COLORS.success,
  },
];

function contentString(content: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = content[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function clampRatio(value: number, min: number, max: number): number {
  const ratio = value > 1 ? value / 100 : value;
  return Math.min(max, Math.max(min, ratio));
}

function fallbackTitle(type: EditorElementType, index: number): string {
  const labels: Partial<Record<EditorElementType, string>> = {
    character: 'Personaje del caso',
    object: 'Elemento contextual',
    text: 'Indicador del escenario',
    instruction: 'Indicación clínica',
    question: 'Punto de decisión',
    feedback: 'Señal de alerta',
    image: 'Recurso visual',
  };

  return labels[type] ?? `Pista ${index + 1}`;
}

function fallbackDescription(type: EditorElementType): string {
  const descriptions: Partial<Record<EditorElementType, string>> = {
    character:
      'Observa quién participa en la situación y qué rol cumple en el proceso de intervención.',
    object:
      'Revisa este elemento del entorno: puede aportar pistas sobre el contexto psicosocial.',
    text: 'Lee este indicador para comprender mejor la dinámica actual del caso.',
    instruction:
      'Considera esta indicación como parte del análisis previo a tu intervención.',
    question: 'Este punto orienta la toma de decisiones dentro del recorrido formativo.',
    feedback: 'Presta atención a esta señal: puede implicar riesgo o vulnerabilidad.',
    image: 'Explora este recurso visual para ampliar tu comprensión del caso.',
  };

  return (
    descriptions[type] ??
    'Explora este punto de la escena para registrar información relevante del caso.'
  );
}

function categoryForType(type: EditorElementType): string {
  const categories: Partial<Record<EditorElementType, string>> = {
    character: 'Personaje del caso',
    object: 'Contexto psicosocial',
    text: 'Indicador clínico',
    instruction: 'Orientación clínica',
    question: 'Punto de decisión',
    feedback: 'Alerta clínica',
    image: 'Recurso visual',
  };

  return categories[type] ?? 'Exploración del caso';
}

function colorForHotspot(important: boolean, type: EditorElementType): number {
  if (important) {
    return MENTORA_COLORS.amber;
  }

  if (type === 'character') {
    return MENTORA_COLORS.accent;
  }

  if (type === 'object' || type === 'text' || type === 'instruction') {
    return 0x7cb342;
  }

  if (type === 'question' || type === 'feedback') {
    return MENTORA_COLORS.lavender;
  }

  return MENTORA_COLORS.success;
}

function detectImportance(element: EditorElement, corpus: string): boolean {
  if (element.type === 'feedback') {
    return true;
  }

  const lower = corpus.toLowerCase();
  return RISK_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function mapElementToHotspot(element: EditorElement, index: number): MentoraHotspotConfig {
  const nombre = contentString(element.content, 'nombre', 'label', 'titulo');
  const texto = contentString(
    element.content,
    'texto',
    'mensaje',
    'dialogo',
    'enunciado',
    'descripcion',
  );
  const title =
    nombre ||
    (texto ? texto.split('\n')[0].slice(0, 48) : '') ||
    fallbackTitle(element.type, index);
  const description =
    contentString(
      element.content,
      'dialogo',
      'descripcion',
      'mensaje',
      'texto',
      'enunciado',
    ) || fallbackDescription(element.type);
  const corpus = `${title} ${description} ${element.type} ${JSON.stringify(element.content)}`;
  const important = detectImportance(element, corpus);

  return {
    id: element.id,
    title,
    description,
    category: categoryForType(element.type),
    xRatio: clampRatio(element.position.x, 0.1, 0.9),
    yRatio: clampRatio(element.position.y, 0.25, 0.82),
    color: colorForHotspot(important, element.type),
    important,
  };
}

export function mapLayoutElementsToHotspots(
  escenario: EscenarioActual | null,
): MentoraHotspotConfig[] {
  const elements = escenario?.layout?.elements;
  if (!elements?.length) {
    return [];
  }

  return elements
    .filter((element) => !element.hidden && !EXCLUDED_TYPES.includes(element.type))
    .filter((element) => HOTSPOT_TYPES.has(element.type))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((element, index) => mapElementToHotspot(element, index));
}

export function getHotspotConfigsForEscenario(
  escenario: EscenarioActual | null,
): MentoraHotspotConfig[] {
  const mapped = mapLayoutElementsToHotspots(escenario);
  return mapped.length > 0 ? mapped : FALLBACK_HOTSPOTS;
}

export function getHotspotTotalForEscenario(escenario: EscenarioActual | null): number {
  return getHotspotConfigsForEscenario(escenario).length;
}

export function buildHotspotConfigFingerprint(
  escenario: EscenarioActual | null,
): string {
  const escenarioId = escenario?.id ?? 'none';
  const configs = getHotspotConfigsForEscenario(escenario);
  const configKey = configs
    .map((config) => `${config.id}:${config.xRatio}:${config.yRatio}:${config.title}`)
    .join('|');

  return `${escenarioId}::${configKey}`;
}
