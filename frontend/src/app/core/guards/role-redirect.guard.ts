import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const role = authService.role();
  if (!role) {
    return router.createUrlTree(['/login']);
  }

  return router.parseUrl(authService.getDefaultRouteForRole(role));
};
