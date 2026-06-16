import { randomUUID } from 'crypto';
import { normalizeUploadUrl } from '../common/utils/upload-url.util';
import { EscenarioRecord } from './entities/escenario.entity';
import {
  EditorElementBase,
  EscenarioLayout,
} from './types/editor-layout.types';

interface LegacyElementoEscenaRecord {
  id: string;
  tipo: 'personaje' | 'objeto' | 'texto';
  asset_codigo: string | null;
  texto_contenido: string | null;
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
  rotacion: number;
  z_index: number;
}

const DEFAULT_LAYOUT_VERSION = 1;

function buildBackgroundElement(escenario: EscenarioRecord): EditorElementBase {
  return {
    id: `bg-${escenario.id}`,
    type: 'background',
    position: { x: 50, y: 50 },
    size: { width: 1000, height: 560 },
    rotation: 0,
    zIndex: 0,
    locked: true,
    hidden: false,
    style: {
      backgroundCode: escenario.fondo_codigo,
    },
    content: {
      title: escenario.titulo,
      situacionTexto: escenario.situacion_texto,
    },
    bindings: {},
  };
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeAssetFields(record: Record<string, unknown>): Record<string, unknown> {
  const next = { ...record };

  for (const key of ['imageUrl']) {
    const value = next[key];
    if (typeof value === 'string') {
      next[key] = normalizeUploadUrl(value) ?? value;
    }
  }

  return next;
}

function normalizeElement(raw: unknown): EditorElementBase | null {
  const record = safeRecord(raw);
  const position = safeRecord(record.position);
  const size = safeRecord(record.size);
  const bindings = safeRecord(record.bindings);

  if (typeof record.id !== 'string' || typeof record.type !== 'string') {
    return null;
  }

  return {
    id: record.id,
    type: record.type as EditorElementBase['type'],
    position: {
      x: safeNumber(position.x, 50),
      y: safeNumber(position.y, 50),
    },
    size: {
      width: safeNumber(size.width, 180),
      height: safeNumber(size.height, 140),
    },
    rotation: safeNumber(record.rotation, 0),
    zIndex: safeNumber(record.zIndex, 1),
    locked: safeBoolean(record.locked, false),
    hidden: safeBoolean(record.hidden, false),
    style: normalizeAssetFields(safeRecord(record.style)) as Record<
      string,
      string | number | boolean | null
    >,
    content: normalizeAssetFields(safeRecord(record.content)),
    bindings: {
      preguntaId:
        typeof bindings.preguntaId === 'string' ? bindings.preguntaId : null,
      opcionId: typeof bindings.opcionId === 'string' ? bindings.opcionId : null,
      retroalimentacionId:
        typeof bindings.retroalimentacionId === 'string'
          ? bindings.retroalimentacionId
          : null,
      escenarioDestinoId:
        typeof bindings.escenarioDestinoId === 'string'
          ? bindings.escenarioDestinoId
          : null,
    },
  };
}

export function buildDefaultLayout(
  escenario: EscenarioRecord,
  legacyElements: LegacyElementoEscenaRecord[] = [],
): EscenarioLayout {
  const backgroundElement = buildBackgroundElement(escenario);

  const mappedLegacyElements = legacyElements.map<EditorElementBase>((item) => ({
    id: item.id,
    type:
      item.tipo === 'personaje'
        ? 'character'
        : item.tipo === 'texto'
          ? 'text'
          : 'object',
    position: {
      x: Number(item.pos_x),
      y: Number(item.pos_y),
    },
    size: {
      width: Number(item.ancho),
      height: Number(item.alto),
    },
    rotation: Number(item.rotacion),
    zIndex: item.z_index,
    locked: false,
    hidden: false,
    style: {},
    content:
      item.tipo === 'texto'
        ? { texto: item.texto_contenido ?? '' }
        : {
            assetCodigo: item.asset_codigo,
            nombre: item.asset_codigo ?? item.tipo,
          },
    bindings: {},
  }));

  if (mappedLegacyElements.length > 0) {
    return {
      version: DEFAULT_LAYOUT_VERSION,
      elements: [backgroundElement, ...mappedLegacyElements],
    };
  }

  const fallbackElements: EditorElementBase[] = [
    backgroundElement,
    {
      id: randomUUID(),
      type: 'character',
      position: { x: 26, y: 68 },
      size: { width: 170, height: 240 },
      rotation: 0,
      zIndex: 2,
      locked: false,
      hidden: false,
      style: {
        palette: 'patient-warm',
      },
      content: {
        nombre: 'Paciente',
        rol: 'Paciente',
        avatar: 'patient-default',
        expresion: 'Pensativo',
        estadoEmocional: 'Ansiedad moderada',
        dialogo: escenario.situacion_texto,
      },
      bindings: {},
    },
    {
      id: randomUUID(),
      type: 'character',
      position: { x: 68, y: 61 },
      size: { width: 180, height: 250 },
      rotation: 0,
      zIndex: 3,
      locked: false,
      hidden: false,
      style: {
        palette: 'therapist-calm',
      },
      content: {
        nombre: 'Profesional',
        rol: 'Psicologo',
        avatar: 'therapist-default',
        expresion: 'Empatica',
        estadoEmocional: 'Regulacion',
        dialogo: 'Guia la intervencion del estudiante.',
      },
      bindings: {},
    },
    {
      id: randomUUID(),
      type: 'instruction',
      position: { x: 21, y: 17 },
      size: { width: 260, height: 80 },
      rotation: 0,
      zIndex: 5,
      locked: false,
      hidden: false,
      style: {
        tone: 'soft',
      },
      content: {
        texto: 'Observa la escena y prepara tu siguiente decision clinica.',
      },
      bindings: {},
    },
  ];

  return {
    version: DEFAULT_LAYOUT_VERSION,
    elements: fallbackElements,
  };
}

function normalizeBackgroundElement(
  element: EditorElementBase,
  escenario: EscenarioRecord,
): EditorElementBase {
  const fallback = buildBackgroundElement(escenario);

  return {
    ...element,
    id: typeof element.id === 'string' && element.id.trim().length > 0 ? element.id : fallback.id,
    type: 'background',
    position: fallback.position,
    size: fallback.size,
    rotation: 0,
    zIndex: 0,
    locked: true,
    hidden: false,
    style: {
      ...element.style,
      backgroundCode:
        typeof element.style?.backgroundCode === 'string'
          ? element.style.backgroundCode
          : escenario.fondo_codigo,
    },
    content: {
      ...element.content,
      title:
        typeof element.content?.['title'] === 'string'
          ? element.content['title']
          : escenario.titulo,
      situacionTexto:
        typeof element.content?.['situacionTexto'] === 'string'
          ? element.content['situacionTexto']
          : escenario.situacion_texto,
    },
    bindings: {},
  };
}

function ensureBackgroundElement(
  elements: EditorElementBase[],
  escenario: EscenarioRecord,
): EditorElementBase[] {
  const backgroundIndex = elements.findIndex((item) => item.type === 'background');

  if (backgroundIndex === -1) {
    return [buildBackgroundElement(escenario), ...elements];
  }

  return elements.map((element, index) =>
    index === backgroundIndex ? normalizeBackgroundElement(element, escenario) : element,
  );
}

export function normalizeLayout(
  layoutData: unknown,
  escenario: EscenarioRecord,
  legacyElements: LegacyElementoEscenaRecord[] = [],
): EscenarioLayout {
  const record = safeRecord(layoutData);
  const rawElements = Array.isArray(record.elements) ? record.elements : null;
  const normalizedElements = rawElements
    ?.map((item) => normalizeElement(item))
    .filter((item): item is EditorElementBase => item !== null);

  if (!rawElements || !normalizedElements || normalizedElements.length === 0) {
    return buildDefaultLayout(escenario, legacyElements);
  }

  const elementsWithBackground = ensureBackgroundElement(normalizedElements, escenario);

  return {
    version: safeNumber(record.version, DEFAULT_LAYOUT_VERSION),
    elements: elementsWithBackground.sort((a, b) => a.zIndex - b.zIndex),
  };
}
