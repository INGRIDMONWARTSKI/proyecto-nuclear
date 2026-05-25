import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { Role } from './core/models/role.enum';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/main-layout.component').then(
        (m) => m.MainLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'grupos' },
      {
        path: 'grupos',
        loadComponent: () =>
          import('./grupos/pages/grupos-list/grupos-list.component').then(
            (m) => m.GruposListComponent,
          ),
      },
      {
        path: 'grupos/nuevo',
        canActivate: [roleGuard(Role.ADMIN, Role.PROFESOR)],
        loadComponent: () =>
          import('./grupos/pages/grupo-form/grupo-form.component').then(
            (m) => m.GrupoFormComponent,
          ),
      },
      {
        path: 'grupos/:id/editar',
        canActivate: [roleGuard(Role.ADMIN, Role.PROFESOR)],
        loadComponent: () =>
          import('./grupos/pages/grupo-form/grupo-form.component').then(
            (m) => m.GrupoFormComponent,
          ),
      },
      {
        path: 'grupos/:id',
        loadComponent: () =>
          import('./grupos/pages/grupo-detail/grupo-detail.component').then(
            (m) => m.GrupoDetailComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'grupos' },
];
