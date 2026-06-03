import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { Role } from './core/models/role.enum';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then(
        (m) => m.PublicLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/auth/pages/login/login.component').then(
            (m) => m.LoginComponent,
          ),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(Role.ADMIN)],
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent,
      ),
    loadChildren: () =>
      import('./features/admin/routes/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'profesor',
    canActivate: [authGuard, roleGuard(Role.PROFESOR)],
    loadComponent: () =>
      import('./layouts/profesor-layout/profesor-layout.component').then(
        (m) => m.ProfesorLayoutComponent,
      ),
    loadChildren: () =>
      import('./features/profesor/routes/profesor.routes').then(
        (m) => m.profesorRoutes,
      ),
  },
  {
    path: 'estudiante',
    canActivate: [authGuard, roleGuard(Role.ESTUDIANTE)],
    loadComponent: () =>
      import('./layouts/estudiante-layout/estudiante-layout.component').then(
        (m) => m.EstudianteLayoutComponent,
      ),
    loadChildren: () =>
      import('./features/estudiante/routes/estudiante.routes').then(
        (m) => m.estudianteRoutes,
      ),
  },

  // Compatibilidad temporal — redirecciones legacy
  { path: 'grupos', redirectTo: 'profesor/grupos', pathMatch: 'full' },
  { path: 'grupos/nuevo', redirectTo: 'profesor/grupos/nuevo', pathMatch: 'full' },
  { path: 'grupos/:id/editar', redirectTo: 'profesor/grupos/:id/editar', pathMatch: 'full' },
  { path: 'grupos/:id', redirectTo: 'profesor/grupos/:id', pathMatch: 'full' },
  {
    path: 'simulacion/docente/casos',
    redirectTo: 'profesor/casos',
    pathMatch: 'full',
  },
  {
    path: 'simulacion/docente/casos/nuevo',
    redirectTo: 'profesor/casos/nuevo',
    pathMatch: 'full',
  },
  {
    path: 'simulacion/docente/casos/:casoId/editar',
    redirectTo: 'profesor/casos/:casoId/editar',
    pathMatch: 'full',
  },
  {
    path: 'simulacion/docente/casos/:casoId',
    redirectTo: 'profesor/casos/:casoId',
    pathMatch: 'full',
  },
  {
    path: 'simulacion/docente/casos/:casoId/escenarios/nuevo',
    redirectTo: 'profesor/casos/:casoId/escenarios/nuevo',
    pathMatch: 'full',
  },
  {
    path: 'simulacion/docente/escenarios/:escenarioId/editar',
    redirectTo: 'profesor/escenarios/:escenarioId/editar',
    pathMatch: 'full',
  },
  {
    path: 'simulacion/docente/escenarios/:escenarioId/configurar',
    redirectTo: 'profesor/escenarios/:escenarioId/decision',
    pathMatch: 'full',
  },
  { path: 'simulacion/casos', redirectTo: 'estudiante/casos', pathMatch: 'full' },
  {
    path: 'simulacion/sesiones/:sesionId/resultado',
    redirectTo: 'estudiante/resultados/:sesionId',
    pathMatch: 'full',
  },
  {
    path: 'simulacion/sesiones/:sesionId',
    redirectTo: 'estudiante/sesiones/:sesionId',
    pathMatch: 'full',
  },

  { path: '**', redirectTo: 'login', pathMatch: 'full' },
];
