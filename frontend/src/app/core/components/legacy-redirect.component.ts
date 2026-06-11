import { Component } from '@angular/core';

/**
 * Shell vacío para rutas legacy cuya navegación real la resuelve un guard.
 */
@Component({
  selector: 'app-legacy-redirect',
  standalone: true,
  template: '',
})
export class LegacyRedirectComponent {}
