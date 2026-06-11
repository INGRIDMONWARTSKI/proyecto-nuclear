import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasValidSession()) {
    return true;
  }

  if (authService.isAuthenticated() && authService.isSessionExpired()) {
    authService.invalidateLocalSession();
    return router.createUrlTree(['/login']);
  }

  return router.createUrlTree(['/login']);
};
