import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/role.guard';
import { Role } from '../../../core/models/role.enum';

export const adminRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('../pages/dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
  },
  {
    path: 'usuarios',
    loadComponent: () =>
      import('../pages/usuarios/admin-usuarios.component').then(
        (m) => m.AdminUsuariosComponent,
      ),
  },
  {
    path: 'grupos',
    loadComponent: () =>
      import('../../profesor/pages/grupos/grupos-list/grupos-list.component').then(
        (m) => m.GruposListComponent,
      ),
  },
  {
    path: 'grupos/nuevo',
    canActivate: [roleGuard(Role.ADMIN)],
    loadComponent: () =>
      import('../../profesor/pages/grupos/grupo-form/grupo-form.component').then(
        (m) => m.GrupoFormComponent,
      ),
  },
  {
    path: 'grupos/:id/editar',
    canActivate: [roleGuard(Role.ADMIN)],
    loadComponent: () =>
      import('../../profesor/pages/grupos/grupo-form/grupo-form.component').then(
        (m) => m.GrupoFormComponent,
      ),
  },
  {
    path: 'grupos/:id',
    loadComponent: () =>
      import('../../profesor/pages/grupos/grupo-detail/grupo-detail.component').then(
        (m) => m.GrupoDetailComponent,
      ),
  },
];
