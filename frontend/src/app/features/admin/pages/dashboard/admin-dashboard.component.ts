import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Role } from '../../../../core/models/role.enum';
import { Usuario } from '../../../../core/models/usuario.model';
import { Grupo } from '../../../../core/models/grupo.model';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { GruposService } from '../../../profesor/services/grupos.service';
import { UsuariosApiService } from '../../../profesor/services/usuarios-api.service';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import {
  SiepRoleBadge,
  StatusBadgeComponent,
} from '../../../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    StatusBadgeComponent,
    AlertMessageComponent,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly usuariosApi = inject(UsuariosApiService);
  private readonly gruposService = inject(GruposService);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly grupos = signal<Grupo[]>([]);

  protected readonly totalUsuarios = computed(() => this.usuarios().length);

  protected readonly profesoresActivos = computed(
    () =>
      this.usuarios().filter(
        (usuario) => usuario.role === Role.PROFESOR && usuario.isActive,
      ).length,
  );

  protected readonly estudiantesActivos = computed(
    () =>
      this.usuarios().filter(
        (usuario) => usuario.role === Role.ESTUDIANTE && usuario.isActive,
      ).length,
  );

  protected readonly gruposAcademicos = computed(() => this.grupos().length);

  protected readonly cuentasInactivas = computed(
    () => this.usuarios().filter((usuario) => !usuario.isActive).length,
  );

  protected readonly usuariosRecientes = computed(() =>
    [...this.usuarios()]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5),
  );

  protected readonly rolesResumen = computed(() => [
    {
      role: Role.ADMIN,
      label: 'Administradores',
      count: this.usuarios().filter((u) => u.role === Role.ADMIN).length,
      badge: 'admin' as SiepRoleBadge,
    },
    {
      role: Role.PROFESOR,
      label: 'Profesores',
      count: this.usuarios().filter((u) => u.role === Role.PROFESOR).length,
      badge: 'profesor' as SiepRoleBadge,
    },
    {
      role: Role.ESTUDIANTE,
      label: 'Estudiantes',
      count: this.usuarios().filter((u) => u.role === Role.ESTUDIANTE).length,
      badge: 'estudiante' as SiepRoleBadge,
    },
  ]);

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      usuarios: this.usuariosApi.listarUsuarios(),
      grupos: this.gruposService.listar(),
    }).subscribe({
      next: ({ usuarios, grupos }) => {
        this.usuarios.set(usuarios);
        this.grupos.set(grupos);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(
            error,
            'No fue posible cargar el resumen del panel administrativo.',
          ),
        );
        this.loading.set(false);
      },
    });
  }

  roleLabel(role: Role): string {
    switch (role) {
      case Role.ADMIN:
        return 'Administrador';
      case Role.PROFESOR:
        return 'Profesor';
      case Role.ESTUDIANTE:
        return 'Estudiante';
      default:
        return role;
    }
  }

  irAUsuarios(): void {
    void this.router.navigate(['/admin/usuarios']);
  }

  roleBadgeKey(role: Role): SiepRoleBadge {
    switch (role) {
      case Role.ADMIN:
        return 'admin';
      case Role.PROFESOR:
        return 'profesor';
      default:
        return 'estudiante';
    }
  }
}
