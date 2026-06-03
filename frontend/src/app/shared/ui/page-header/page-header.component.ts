import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="siep-page-header">
      <div class="siep-page-header__main">
        @if (icon) {
          <span class="siep-page-header__icon" aria-hidden="true">{{ icon }}</span>
        }
        <div>
          <h1>{{ title }}</h1>
          @if (subtitle) {
            <p class="siep-page-header__subtitle">{{ subtitle }}</p>
          }
        </div>
      </div>
      <div class="siep-page-header__actions">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
}
