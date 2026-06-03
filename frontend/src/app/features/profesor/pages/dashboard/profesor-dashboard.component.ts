import { Component } from '@angular/core';

@Component({
  selector: 'app-profesor-dashboard',
  standalone: true,
  template: `
    <section class="page-header">
      <h1>Panel del profesor</h1>
      <p class="page-header__subtitle">
        Organiza grupos, construye casos interactivos y revisa el avance de tus estudiantes.
      </p>
    </section>
    <div class="dashboard-grid">
      <article class="card dashboard-card">
        <h2>Grupos</h2>
        <p>Crea grupos y asocia estudiantes.</p>
      </article>
      <article class="card dashboard-card">
        <h2>Casos</h2>
        <p>Diseña escenarios, decisiones y retroalimentación.</p>
      </article>
      <article class="card dashboard-card">
        <h2>Evidencias</h2>
        <p>Consulta intentos registrados por tus estudiantes.</p>
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
export class ProfesorDashboardComponent {}
