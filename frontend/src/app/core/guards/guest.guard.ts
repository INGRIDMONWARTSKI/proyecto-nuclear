import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Permite /login solo a usuarios no autenticados; si ya hay sesión, envía al dashboard del rol. */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.hasValidSession()) {
    if (authService.isAuthenticated() && authService.isSessionExpired()) {
      authService.invalidateLocalSession();
    }
    return true;
  }

  const role = authService.role();
  if (!role) {
    return true;
  }

  if (authService.mustChangePassword()) {
    return router.parseUrl('/auth/cambiar-contrasena-temporal');
  }

  return router.parseUrl(authService.getDefaultRouteForRole(role));
};
