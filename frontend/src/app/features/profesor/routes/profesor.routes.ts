import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/role.guard';
import { Role } from '../../../core/models/role.enum';

const placeholder = (
  title: string,
  subtitle: string,
  message: string,
) => ({
  loadComponent: () =>
    import('../../../shared/ui/placeholder-page/placeholder-page.component').then(
      (m) => m.PlaceholderPageComponent,
    ),
  data: { title, subtitle, message },
});

export const profesorRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('../pages/dashboard/profesor-dashboard.component').then(
        (m) => m.ProfesorDashboardComponent,
      ),
  },
  {
    path: 'grupos',
    loadComponent: () =>
      import('../pages/grupos/grupos-list/grupos-list.component').then(
        (m) => m.GruposListComponent,
      ),
  },
  {
    path: 'grupos/nuevo',
    canActivate: [roleGuard(Role.PROFESOR)],
    loadComponent: () =>
      import('../pages/grupos/grupo-form/grupo-form.component').then(
        (m) => m.GrupoFormComponent,
      ),
  },
  {
    path: 'grupos/:id/editar',
    canActivate: [roleGuard(Role.PROFESOR)],
    loadComponent: () =>
      import('../pages/grupos/grupo-form/grupo-form.component').then(
        (m) => m.GrupoFormComponent,
      ),
  },
  {
    path: 'grupos/:id',
    loadComponent: () =>
      import('../pages/grupos/grupo-detail/grupo-detail.component').then(
        (m) => m.GrupoDetailComponent,
      ),
  },
  {
    path: 'casos',
    loadComponent: () =>
      import('../pages/casos/docente-casos-list/docente-casos-list.component').then(
        (m) => m.DocenteCasosListComponent,
      ),
  },
  {
    path: 'casos/nuevo',
    loadComponent: () =>
      import('../pages/casos/docente-caso-form/docente-caso-form.component').then(
        (m) => m.DocenteCasoFormComponent,
      ),
  },
  {
    path: 'casos/:casoId/editar',
    loadComponent: () =>
      import('../pages/casos/docente-caso-form/docente-caso-form.component').then(
        (m) => m.DocenteCasoFormComponent,
      ),
  },
  {
    path: 'casos/:casoId',
    loadComponent: () =>
      import('../pages/casos/docente-caso-detail/docente-caso-detail.component').then(
        (m) => m.DocenteCasoDetailComponent,
      ),
  },
  {
    path: 'casos/:casoId/escenarios/nuevo',
    loadComponent: () =>
      import('../pages/casos/docente-escenario-form/docente-escenario-form.component').then(
        (m) => m.DocenteEscenarioFormComponent,
      ),
  },
  {
    path: 'escenarios/:escenarioId/editar',
    loadComponent: () =>
      import('../pages/casos/docente-escenario-form/docente-escenario-form.component').then(
        (m) => m.DocenteEscenarioFormComponent,
      ),
  },
  {
    path: 'escenarios/:escenarioId/decision',
    loadComponent: () =>
      import('../pages/casos/docente-escenario-config/docente-escenario-config.component').then(
        (m) => m.DocenteEscenarioConfigComponent,
      ),
  },
  {
    path: 'casos/:casoId/canvas',
    loadComponent: () =>
      import('../pages/casos/caso-canvas/docente-caso-canvas.component').then(
        (m) => m.DocenteCasoCanvasComponent,
      ),
  },
  {
    path: 'asignaciones',
    loadComponent: () =>
      import('../pages/asignaciones/docente-asignaciones.component').then(
        (m) => m.DocenteAsignacionesComponent,
      ),
  },
  {
    path: 'evidencias',
    loadComponent: () =>
      import('../pages/evidencias/profesor-evidencias.component').then(
        (m) => m.ProfesorEvidenciasComponent,
      ),
  },
  {
    path: 'evidencias/:sesionId',
    loadComponent: () =>
      import('../pages/evidencias/revision-docente.component').then(
        (m) => m.RevisionDocenteComponent,
      ),
  },
];
