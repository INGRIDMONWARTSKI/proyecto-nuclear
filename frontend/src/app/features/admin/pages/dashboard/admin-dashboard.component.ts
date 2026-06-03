import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  template: `
    <section class="page-header">
      <h1>Panel de administración</h1>
      <p class="page-header__subtitle">
        Registra usuarios, consulta grupos académicos y controla el acceso por rol.
      </p>
    </section>
    <div class="dashboard-grid">
      <article class="card dashboard-card">
        <h2>Usuarios</h2>
        <p>Crea y consulta cuentas del sistema.</p>
      </article>
      <article class="card dashboard-card">
        <h2>Grupos</h2>
        <p>Consulta la organización académica global.</p>
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
export class AdminDashboardComponent {}
