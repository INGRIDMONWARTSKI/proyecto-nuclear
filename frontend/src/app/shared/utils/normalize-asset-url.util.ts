import { CasoEditor } from '../../features/simulacion/models/docente/caso-editor.model';
import { EditorElement } from '../../features/simulacion/models/docente/editor-layout.model';

const UPLOAD_URL_KEYS = ['imageUrl'] as const;

/**
 * Normaliza URLs de assets del canvas para evitar Mixed Content en producción.
 * - /uploads/... se conserva
 * - /assets/... y assets/... se conservan (catálogo MENTORA)
 * - http(s)://.../uploads/... se convierte a /uploads/...
 */
export function normalizeAssetUrl(url: string | null | undefined): string {
  if (typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('/assets/') || trimmed.startsWith('assets/')) {
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const pathname = new URL(trimmed).pathname;
      if (pathname.startsWith('/uploads/')) {
        return pathname;
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function normalizeRecordUrls(record: Record<string, unknown>): Record<string, unknown> {
  const next = { ...record };

  for (const key of UPLOAD_URL_KEYS) {
    const value = next[key];
    if (typeof value === 'string') {
      next[key] = normalizeAssetUrl(value);
    }
  }

  return next;
}

export function normalizeEditorElement(element: EditorElement): EditorElement {
  return {
    ...element,
    style: normalizeRecordUrls(element.style as Record<string, unknown>) as EditorElement['style'],
    content: normalizeRecordUrls(element.content) as EditorElement['content'],
  };
}

export function normalizeEditorLayoutElements(elements: EditorElement[]): EditorElement[] {
  return elements.map((element) => normalizeEditorElement(element));
}

export function normalizeCasoEditor(editor: CasoEditor): CasoEditor {
  return {
    ...editor,
    escenarios: editor.escenarios.map((escenario) => {
      const normalizedElements = normalizeEditorLayoutElements(escenario.layout.elements);
      const background = normalizedElements.find((item) => item.type === 'background');
      const aiBackgroundUrl =
        typeof background?.style?.['imageUrl'] === 'string'
          ? normalizeAssetUrl(background.style['imageUrl'])
          : typeof background?.content?.['imageUrl'] === 'string'
            ? normalizeAssetUrl(background.content['imageUrl'])
            : escenario.aiBackgroundUrl
              ? normalizeAssetUrl(escenario.aiBackgroundUrl)
              : null;

      return {
        ...escenario,
        aiBackgroundUrl,
        layout: {
          ...escenario.layout,
          elements: normalizedElements,
        },
      };
    }),
  };
}
