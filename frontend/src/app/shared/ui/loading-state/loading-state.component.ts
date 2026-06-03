import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  template: `
    <div class="siep-loading" role="status" aria-live="polite">
      <span class="siep-loading__spinner" aria-hidden="true"></span>
      <span>{{ message }}</span>
    </div>
  `,
})
export class LoadingStateComponent {
  @Input() message = 'Cargando...';
}
