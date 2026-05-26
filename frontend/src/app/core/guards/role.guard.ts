import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/role.enum';
import { AuthService } from '../services/auth.service';

export const roleGuard = (...roles: Role[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.hasRole(...roles)) {
      return true;
    }

    return router.createUrlTree(['/grupos']);
  };
};
