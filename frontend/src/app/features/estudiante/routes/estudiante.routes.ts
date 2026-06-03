import { Routes } from '@angular/router';

export const estudianteRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('../pages/dashboard/estudiante-dashboard.component').then(
        (m) => m.EstudianteDashboardComponent,
      ),
  },
  {
    path: 'casos',
    loadComponent: () =>
      import('../pages/estudiante-casos-list/estudiante-casos-list.component').then(
        (m) => m.EstudianteCasosListComponent,
      ),
  },
  {
    path: 'sesiones/:sesionId',
    loadComponent: () =>
      import('../pages/estudiante-simulacion-player/estudiante-simulacion-player.component').then(
        (m) => m.EstudianteSimulacionPlayerComponent,
      ),
  },
  {
    path: 'casos/:casoId/desarrollar/:sesionId',
    loadComponent: () =>
      import('../pages/estudiante-simulacion-player/estudiante-simulacion-player.component').then(
        (m) => m.EstudianteSimulacionPlayerComponent,
      ),
  },
  {
    path: 'desarrollar/:sesionId',
    redirectTo: 'sesiones/:sesionId',
  },
  {
    path: 'resultados/:sesionId',
    loadComponent: () =>
      import('../pages/estudiante-resultado/estudiante-resultado.component').then(
        (m) => m.EstudianteResultadoComponent,
      ),
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('../pages/historial/estudiante-historial.component').then(
        (m) => m.EstudianteHistorialComponent,
      ),
  },
];
