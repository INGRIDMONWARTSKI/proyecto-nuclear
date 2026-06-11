import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/role.enum';
import { AuthService } from '../services/auth.service';

/**
 * Redirige rutas legacy /grupos/* según el rol del usuario autenticado.
 */
export const legacyGruposRedirectGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.hasValidSession()) {
    if (authService.isAuthenticated() && authService.isSessionExpired()) {
      authService.invalidateLocalSession();
    }
    return router.createUrlTree(['/login']);
  }

  const role = authService.role();
  let basePath: string;

  switch (role) {
    case Role.ADMIN:
      basePath = '/admin/grupos';
      break;
    case Role.PROFESOR:
      basePath = '/profesor/grupos';
      break;
    default:
      return router.parseUrl(
        authService.getDefaultRouteForRole(role ?? Role.ESTUDIANTE),
      );
  }

  const suffix = state.url.replace(/^\/grupos\/?/, '');
  const target = suffix ? `${basePath}/${suffix}` : basePath;

  return router.parseUrl(target);
};
