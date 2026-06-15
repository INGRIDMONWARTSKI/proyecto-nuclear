import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const profesorCaseCreatorGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.canCreateCases()) {
    return true;
  }

  return router.createUrlTree(['/profesor/casos']);
};
