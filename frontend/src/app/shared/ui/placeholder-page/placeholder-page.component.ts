import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  template: `
    <section class="page-header">
      <h1>{{ title }}</h1>
      <p class="page-header__subtitle">{{ subtitle }}</p>
    </section>
    <section class="card placeholder-card">
      <p>{{ message }}</p>
    </section>
  `,
  styles: `
    .placeholder-card {
      color: var(--color-muted);
      line-height: 1.6;
    }
  `,
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly title =
    this.route.snapshot.data['title'] ?? 'Módulo en preparación';
  protected readonly subtitle =
    this.route.snapshot.data['subtitle'] ??
    'Esta sección estará disponible en una fase posterior.';
  protected readonly message =
    this.route.snapshot.data['message'] ??
    'Funcionalidad pendiente de backend o en preparación.';
}
