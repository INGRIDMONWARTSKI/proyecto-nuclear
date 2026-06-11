interface JwtPayload {
  exp?: number;
}

export function getJwtExpirationMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1])) as JwtPayload;
    if (typeof payload.exp !== 'number') {
      return null;
    }

    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, skewMs = 0): boolean {
  const expirationMs = getJwtExpirationMs(token);
  if (expirationMs === null) {
    return false;
  }

  return Date.now() >= expirationMs - skewMs;
}
