import { Component } from '@angular/core';

@Component({
  selector: 'app-estudiante-dashboard',
  standalone: true,
  template: `
    <section class="page-header">
      <h1>Panel del estudiante</h1>
      <p class="page-header__subtitle">
        Accede a los casos asignados, desarrolla simulaciones y consulta tus resultados.
      </p>
    </section>
    <div class="dashboard-grid">
      <article class="card dashboard-card">
        <h2>Mis casos</h2>
        <p>Inicia casos publicados y toma decisiones.</p>
      </article>
      <article class="card dashboard-card">
        <h2>Historial</h2>
        <p>Revisa intentos finalizados y retroalimentación recibida.</p>
      </article>
    </div>
  `,
  styles: `
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .dashboard-card h2 {
      margin: 0 0 0.5rem;
      font-size: 1.1rem;
    }
    .dashboard-card p {
      margin: 0;
      color: var(--color-muted);
      font-size: 0.9rem;
    }
  `,
})
export class EstudianteDashboardComponent {}
