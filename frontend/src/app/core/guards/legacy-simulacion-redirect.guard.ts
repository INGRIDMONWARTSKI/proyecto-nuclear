import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/role.enum';
import { AuthService } from '../services/auth.service';

/**
 * Redirige rutas legacy /simulacion/* según el rol del usuario autenticado.
 */
export const legacySimulacionRedirectGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.hasValidSession()) {
    if (authService.isAuthenticated() && authService.isSessionExpired()) {
      authService.invalidateLocalSession();
    }
    return router.createUrlTree(['/login']);
  }

  const role = authService.role();
  const target = resolveLegacySimulacionTarget(state.url, role, authService);

  return router.parseUrl(target);
};

function resolveLegacySimulacionTarget(
  url: string,
  role: Role | null,
  authService: AuthService,
): string {
  const normalizedUrl = url.replace(/\/$/, '') || '/';

  const sesionResultadoMatch = normalizedUrl.match(
    /^\/simulacion\/sesiones\/([^/]+)\/resultado$/,
  );
  if (sesionResultadoMatch) {
    if (role === Role.ESTUDIANTE) {
      return `/estudiante/resultados/${sesionResultadoMatch[1]}`;
    }
    return authService.getDefaultRouteForRole(role ?? Role.ESTUDIANTE);
  }

  const sesionMatch = normalizedUrl.match(/^\/simulacion\/sesiones\/([^/]+)$/);
  if (sesionMatch) {
    if (role === Role.ESTUDIANTE) {
      return `/estudiante/sesiones/${sesionMatch[1]}`;
    }
    return authService.getDefaultRouteForRole(role ?? Role.ESTUDIANTE);
  }

  if (normalizedUrl === '/simulacion/casos') {
    if (role === Role.ESTUDIANTE) {
      return '/estudiante/casos';
    }
    return authService.getDefaultRouteForRole(role ?? Role.ESTUDIANTE);
  }

  if (normalizedUrl.startsWith('/simulacion/docente/')) {
    if (role === Role.ESTUDIANTE) {
      return '/estudiante/dashboard';
    }

    if (role === Role.ADMIN) {
      return '/admin/dashboard';
    }

    if (role === Role.PROFESOR) {
      const suffix = normalizedUrl.replace(/^\/simulacion\/docente\//, '');
      const profesorSuffix = suffix.replace(
        /^escenarios\/([^/]+)\/configurar$/,
        'escenarios/$1/decision',
      );
      return `/profesor/${profesorSuffix}`;
    }
  }

  return authService.getDefaultRouteForRole(role ?? Role.ESTUDIANTE);
}
