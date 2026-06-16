/**
 * Normaliza rutas de uploads servidas por Nest bajo /uploads/.
 * Convierte URLs absolutas de desarrollo/producción a rutas relativas.
 */
export function normalizeUploadUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
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
