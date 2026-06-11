import { EscenarioActual } from '../../../features/simulacion/models/escenario-actual.model';
import { EditorElement } from '../../../features/simulacion/models/docente/editor-layout.model';

/**
 * Imágenes esperadas en:
 * frontend/src/assets/mentora/backgrounds/{slug}.png
 *
 * Angular las sirve en runtime como:
 * assets/mentora/backgrounds/{slug}.png
 */
export const MENTORA_BACKGROUND_ASSETS_DIR = 'assets/mentora/backgrounds';

export const MENTORA_BACKGROUND_FILE_NAMES = [
  'consultorio.png',
  'aula.png',
  'casa-familiar.png',
  'oficina-psicosocial.png',
  'comunidad.png',
  'fallback-mentora.png',
] as const;

const KNOWN_BACKGROUND_SLUGS = new Set([
  'consultorio',
  'aula',
  'casa-familiar',
  'oficina-psicosocial',
  'comunidad',
  'fallback-mentora',
]);

/**
 * Fallback visual oficial temporal del frontend cuando el escenario no trae fondoCodigo.
 * Se intenta cargar oficina-psicosocial.png; si el asset falla, se usa degradado MENTORA.
 */
export const DEFAULT_BACKGROUND_WHEN_MISSING_FONDO = 'oficina-psicosocial';

const FONDO_CODIGO_TO_SLUG: Record<string, string> = {
  aula: 'aula',
  oficina_psicologica: 'oficina-psicosocial',
  oficina: 'oficina-psicosocial',
  oficina_psicosocial: 'oficina-psicosocial',
  // Alias temporal: consultorio.png aún no disponible; reutiliza oficina-psicosocial.png.
  consultorio: 'oficina-psicosocial',
  casa: 'casa-familiar',
  casa_familiar: 'casa-familiar',
  comisaria_familia: 'comunidad',
  comunidad: 'comunidad',
  sala_espera: 'oficina-psicosocial',
  hospital: 'oficina-psicosocial',
};

export interface MentoraBackgroundAsset {
  textureKey: string;
  assetSlug: string;
  assetUrl: string | null;
  fondoCodigo: string;
  usesGradientFallback: boolean;
}

function readBackgroundCodeFromLayout(escenario: EscenarioActual): string | null {
  const backgroundElement = escenario.layout?.elements?.find(
    (element): element is EditorElement => element.type === 'background',
  );

  if (!backgroundElement) {
    return null;
  }

  const styleCode = backgroundElement.style['backgroundCode'];
  if (typeof styleCode === 'string' && styleCode.trim()) {
    return styleCode.trim();
  }

  const contentCode = backgroundElement.content['backgroundCode'];
  if (typeof contentCode === 'string' && contentCode.trim()) {
    return contentCode.trim();
  }

  return null;
}

export function extractFondoCodigo(escenario: EscenarioActual | null): string | null {
  if (!escenario) {
    return null;
  }

  if (escenario.fondoCodigo?.trim()) {
    return escenario.fondoCodigo.trim();
  }

  return readBackgroundCodeFromLayout(escenario);
}

export function normalizeFondoCodigo(code: string): string {
  return code.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function resolveBackgroundSlug(fondoCodigo: string | null | undefined): string {
  if (!fondoCodigo?.trim()) {
    return DEFAULT_BACKGROUND_WHEN_MISSING_FONDO;
  }

  const normalized = normalizeFondoCodigo(fondoCodigo);
  const mapped = FONDO_CODIGO_TO_SLUG[normalized];
  if (mapped) {
    return mapped;
  }

  const hyphenated = normalized.replace(/_/g, '-');
  if (KNOWN_BACKGROUND_SLUGS.has(hyphenated)) {
    return hyphenated;
  }

  return 'fallback-mentora';
}

export function resolveBackgroundAsset(escenario: EscenarioActual | null): MentoraBackgroundAsset {
  const fondoCodigo = extractFondoCodigo(escenario) ?? '';
  const assetSlug = resolveBackgroundSlug(fondoCodigo);

  return {
    textureKey: `mentora-bg-${assetSlug}`,
    assetSlug,
    assetUrl: `${MENTORA_BACKGROUND_ASSETS_DIR}/${assetSlug}.png`,
    fondoCodigo,
    usesGradientFallback: assetSlug === 'fallback-mentora',
  };
}

export function buildBackgroundFingerprint(escenario: EscenarioActual | null): string {
  const asset = resolveBackgroundAsset(escenario);
  return `${escenario?.id ?? 'none'}::${asset.textureKey}::${asset.fondoCodigo}`;
}
