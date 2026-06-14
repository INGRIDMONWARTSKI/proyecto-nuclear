import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Bloquea rutas de la app hasta completar el cambio de contraseña inicial. */
export const mustChangePasswordGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.user()?.mustChangePassword) {
    return router.createUrlTree(['/auth/cambiar-contrasena-temporal']);
  }

  return true;
};
