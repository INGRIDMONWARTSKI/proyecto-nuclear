import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Solo permite acceder a la pantalla de cambio obligatorio cuando aplica. */
export const changeTemporaryPasswordPageGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.hasValidSession()) {
    return router.createUrlTree(['/login']);
  }

  if (!authService.mustChangePassword()) {
    const role = authService.role();
    if (role) {
      return router.createUrlTree([authService.getDefaultRouteForRole(role)]);
    }
    return router.createUrlTree(['/login']);
  }

  return true;
};
