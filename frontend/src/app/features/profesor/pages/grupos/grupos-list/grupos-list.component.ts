import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Role } from '../../../../../core/models/role.enum';
import { Grupo } from '../../../../../core/models/grupo.model';
import { Usuario } from '../../../../../core/models/usuario.model';
import { AuthService } from '../../../../../core/services/auth.service';
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { ConfirmDialogComponent } from '../../../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import { GruposService } from '../../../services/grupos.service';
import { UsuariosApiService } from '../../../services/usuarios-api.service';
@Component({
  selector: 'app-grupos-list',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    AlertMessageComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './grupos-list.component.html',
  styleUrl: './grupos-list.component.scss',
})
export class GruposListComponent implements OnInit {
  private readonly gruposService = inject(GruposService);
  private readonly usuariosApi = inject(UsuariosApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly authService = inject(AuthService);

  protected readonly Role = Role;
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly grupos = signal<Grupo[]>([]);
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly busqueda = signal('');

  // Mapa de profesorId → nombre para lookup O(1)
  protected readonly profesoresPorId = computed(() => {
    const map = new Map<string, string>();
    for (const u of this.usuarios()) {
      if (u.role === Role.PROFESOR) {
        map.set(u.id, u.fullName);
      }
    }
    return map;
  });

  protected nombreProfesor(profesorId: string | null): string | null {
    if (!profesorId) return null;
    return this.profesoresPorId().get(profesorId) ?? null;
  }

  protected readonly gruposFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.grupos();
    return this.grupos().filter((g) => {
      const nombreDocente = g.profesorId
        ? (this.profesoresPorId().get(g.profesorId) ?? '').toLowerCase()
        : '';
      return (
        g.nombre.toLowerCase().includes(q) ||
        (g.descripcion ?? '').toLowerCase().includes(q) ||
        (g.semestre ?? '').toLowerCase().includes(q) ||
        (g.isActive ? 'activo' : 'inactivo').includes(q) ||
        nombreDocente.includes(q)
      );
    });
  });

  protected readonly hayResultados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    return !q || this.gruposFiltrados().length > 0;
  });

  protected readonly confirmOpen = signal(false);
  protected readonly confirmTitle = signal('');
  protected readonly confirmMessage = signal('');
  protected readonly confirmLabel = signal('Confirmar');
  protected readonly updatingGroupId = signal<string | null>(null);

  private confirmAction: (() => void) | null = null;

  ngOnInit() {
    this.cargarGrupos();
  }

  cargarGrupos() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.authService.hasRole(Role.ADMIN)) {
      forkJoin({
        grupos: this.gruposService.listar(),
        usuarios: this.usuariosApi.listarUsuarios(),
      }).subscribe({
        next: ({ grupos, usuarios }) => {
          this.grupos.set(grupos);
          this.usuarios.set(usuarios);
          this.loading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(
            getErrorMessage(error, 'No fue posible cargar los grupos.'),
          );
          this.loading.set(false);
        },
      });
      return;
    }

    this.gruposService.listar().subscribe({
      next: (grupos) => {
        const user = this.authService.user();
        this.grupos.set(grupos);
        this.usuarios.set(user ? [user] : []);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los grupos.'),
        );
        this.loading.set(false);
      },
    });
  }

  puedeAdministrar(grupo: Grupo): boolean {
    const user = this.authService.user();

    if (!user) {
      return false;
    }

    if (user.role === Role.ADMIN) {
      return true;
    }

    return user.role === Role.PROFESOR && grupo.profesorId === user.id;
  }

  listSubtitle(): string {
    if (this.authService.hasRole(Role.ESTUDIANTE)) {
      return 'Grupos en los que participas.';
    }
    if (this.authService.hasRole(Role.PROFESOR)) {
      return 'Grupos que impartes.';
    }
    return 'Todos los grupos del sistema.';
  }

  irANuevoGrupo(): void {
    void this.router.navigate(['nuevo'], { relativeTo: this.route });
  }

  confirmarCambioEstado(grupo: Grupo): void {
    if (!this.puedeAdministrar(grupo) || this.updatingGroupId()) {
      return;
    }

    const activar = !grupo.isActive;
    this.confirmTitle.set(activar ? 'Activar grupo' : 'Desactivar grupo');
    this.confirmMessage.set(
      activar
        ? `¿Activar el grupo "${grupo.nombre}"? Volverá a estar disponible para nuevas asignaciones.`
        : `¿Desactivar el grupo "${grupo.nombre}"? Dejará de estar disponible para nuevas asignaciones.`,
    );
    this.confirmLabel.set(activar ? 'Activar grupo' : 'Desactivar grupo');
    this.confirmAction = () => this.cambiarEstado(grupo, activar);
    this.confirmOpen.set(true);
  }

  confirmarAccionDialogo(): void {
    this.confirmAction?.();
  }

  cerrarConfirmacion(): void {
    if (this.updatingGroupId()) {
      return;
    }

    this.confirmOpen.set(false);
    this.confirmAction = null;
  }

  estaActualizando(grupoId: string): boolean {
    return this.updatingGroupId() === grupoId;
  }

  private cambiarEstado(grupo: Grupo, isActive: boolean): void {
    this.updatingGroupId.set(grupo.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.gruposService.actualizar(grupo.id, { isActive }).subscribe({
      next: (grupoActualizado) => {
        this.grupos.update((grupos) =>
          grupos.map((item) => (item.id === grupoActualizado.id ? grupoActualizado : item)),
        );
        this.updatingGroupId.set(null);
        this.cerrarConfirmacion();
        this.successMessage.set(
          isActive
            ? 'Grupo activado correctamente.'
            : 'Grupo desactivado correctamente.',
        );
      },
      error: (error) => {
        this.updatingGroupId.set(null);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible actualizar el estado del grupo.'),
        );
      },
    });
  }
}
