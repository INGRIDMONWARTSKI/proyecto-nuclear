import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { legacyGruposRedirectGuard } from './core/guards/legacy-grupos-redirect.guard';
import { legacySimulacionRedirectGuard } from './core/guards/legacy-simulacion-redirect.guard';
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

  // Compatibilidad temporal — redirecciones legacy sensibles al rol
  {
    path: 'grupos/nuevo',
    canActivate: [legacyGruposRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'grupos/:id/editar',
    canActivate: [legacyGruposRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'grupos/:id',
    canActivate: [legacyGruposRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'grupos',
    canActivate: [legacyGruposRedirectGuard],
    pathMatch: 'full',
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  // Compatibilidad temporal — redirecciones legacy simulación sensibles al rol
  {
    path: 'simulacion/docente/casos/nuevo',
    canActivate: [legacySimulacionRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'simulacion/docente/casos/:casoId/escenarios/nuevo',
    canActivate: [legacySimulacionRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'simulacion/docente/casos/:casoId/editar',
    canActivate: [legacySimulacionRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'simulacion/docente/casos/:casoId',
    canActivate: [legacySimulacionRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'simulacion/docente/casos',
    canActivate: [legacySimulacionRedirectGuard],
    pathMatch: 'full',
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'simulacion/docente/escenarios/:escenarioId/configurar',
    canActivate: [legacySimulacionRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'simulacion/docente/escenarios/:escenarioId/editar',
    canActivate: [legacySimulacionRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'simulacion/sesiones/:sesionId/resultado',
    canActivate: [legacySimulacionRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'simulacion/sesiones/:sesionId',
    canActivate: [legacySimulacionRedirectGuard],
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },
  {
    path: 'simulacion/casos',
    canActivate: [legacySimulacionRedirectGuard],
    pathMatch: 'full',
    loadComponent: () =>
      import('./core/components/legacy-redirect.component').then(
        (m) => m.LegacyRedirectComponent,
      ),
  },

  { path: '**', redirectTo: 'login', pathMatch: 'full' },
];
