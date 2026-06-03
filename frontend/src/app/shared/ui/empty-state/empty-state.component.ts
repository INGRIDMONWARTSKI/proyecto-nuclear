import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <section class="siep-empty" role="status">
      @if (icon) {
        <span class="siep-empty__icon" aria-hidden="true">{{ icon }}</span>
      }
      <h2 class="siep-empty__title">{{ title }}</h2>
      @if (message) {
        <p class="siep-empty__message">{{ message }}</p>
      }
      @if (actionLabel) {
        <button type="button" class="siep-btn-primary" (click)="actionClick.emit()">
          {{ actionLabel }}
        </button>
      }
    </section>
  `,
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() message = '';
  @Input() icon = '🍃';
  @Input() actionLabel?: string;

  @Output() readonly actionClick = new EventEmitter<void>();
}
