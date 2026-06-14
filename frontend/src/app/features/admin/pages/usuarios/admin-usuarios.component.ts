import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { Role } from '../../../../core/models/role.enum';
import { Grupo } from '../../../../core/models/grupo.model';
import { Usuario } from '../../../../core/models/usuario.model';
import { AuthService } from '../../../../core/services/auth.service';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { GruposService } from '../../../profesor/services/grupos.service';
import { UsuariosApiService } from '../../../profesor/services/usuarios-api.service';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../../shared/ui/confirm-dialog/confirm-dialog.component';
import {
  SiepRoleBadge,
  StatusBadgeComponent,
} from '../../../../shared/ui/status-badge/status-badge.component';
import { AdminAmbientComponent } from '../../shared/admin-ambient/admin-ambient.component';

type PanelMode = 'none' | 'create' | 'edit';

export interface GrupoEstudiantesView {
  grupo: Grupo;
  estudiantes: Usuario[];
}

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    AlertMessageComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
    ConfirmDialogComponent,
    AdminAmbientComponent,
  ],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.scss',
})
export class AdminUsuariosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosApi = inject(UsuariosApiService);
  private readonly gruposService = inject(GruposService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly Role = Role;
  protected readonly roles = [Role.ADMIN, Role.PROFESOR, Role.ESTUDIANTE];

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly gruposConEstudiantes = signal<GrupoEstudiantesView[]>([]);
  protected readonly estudiantesSinGrupo = signal<Usuario[]>([]);
  protected readonly todosLosGrupos = signal<Grupo[]>([]);

  // ── Buscador global ──────────────────────────────────────
  protected readonly busqueda = signal('');

  // ── Acordeón de sección profesores ───────────────────────
  protected readonly profesoresSeccionAbierta = signal(false);

  protected toggleProfesores(): void {
    this.profesoresSeccionAbierta.update((v) => !v);
  }

  // ── Acordeón de grupos (existente) ───────────────────────
  protected readonly gruposAbiertos = signal<Set<string>>(new Set());

  protected isGrupoAbierto(id: string): boolean {
    return this.gruposAbiertos().has(id);
  }

  protected toggleGrupo(id: string): void {
    const current = new Set(this.gruposAbiertos());
    current.has(id) ? current.delete(id) : current.add(id);
    this.gruposAbiertos.set(current);
  }

  // ── Detalle de usuario individual ─────────────────────────
  protected readonly usuariosAbiertos = signal<Set<string>>(new Set());

  protected isUsuarioAbierto(id: string): boolean {
    return this.usuariosAbiertos().has(id);
  }

  protected toggleUsuario(id: string): void {
    const current = new Set(this.usuariosAbiertos());
    current.has(id) ? current.delete(id) : current.add(id);
    this.usuariosAbiertos.set(current);
  }

  protected readonly panelMode = signal<PanelMode>('none');
  protected readonly editingUsuario = signal<Usuario | null>(null);
  protected readonly confirmOpen = signal(false);
  protected readonly confirmTitle = signal('');
  protected readonly confirmMessage = signal('');
  protected readonly confirmLabel = signal('Confirmar');
  protected readonly confirmDestructive = signal(false);

  private usuarioPendienteEstado: Usuario | null = null;

  protected readonly currentUserId = computed(
    () => this.authService.user()?.id ?? null,
  );

  // ── Listas base (sin filtro) ──────────────────────────────
  protected readonly adminsActivos = computed(() =>
    this.usuarios()
      .filter((u) => u.role === Role.ADMIN && u.isActive)
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  );

  protected readonly profesoresActivos = computed(() =>
    this.usuarios()
      .filter((u) => u.role === Role.PROFESOR && u.isActive)
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  );

  protected readonly usuariosArchivados = computed(() =>
    this.usuarios()
      .filter((u) => !u.isActive)
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  );

  // ── Listas filtradas por búsqueda ─────────────────────────
  private matchesQuery(u: Usuario, q: string): boolean {
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      this.roleLabel(u.role).toLowerCase().includes(q)
    );
  }

  protected readonly adminsActivosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.adminsActivos();
    return this.adminsActivos().filter((u) => this.matchesQuery(u, q));
  });

  // Admins que no pueden archivarse → cuenta(s) del sistema / protegidas
  protected readonly adminsSistema = computed(() =>
    this.adminsActivosFiltrados().filter((u) => !this.puedeArchivar(u)),
  );

  // Admins que sí pueden archivarse → administradores institucionales
  protected readonly adminsInstitucionales = computed(() =>
    this.adminsActivosFiltrados().filter((u) => this.puedeArchivar(u)),
  );

  protected readonly profesoresActivosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.profesoresActivos();
    return this.profesoresActivos().filter((u) => this.matchesQuery(u, q));
  });

  protected readonly gruposFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.gruposConEstudiantes();
    return this.gruposConEstudiantes()
      .map((gv) => {
        const grupoMatch = gv.grupo.nombre.toLowerCase().includes(q);
        const estudiantesFiltrados = grupoMatch
          ? gv.estudiantes
          : gv.estudiantes.filter((e) => this.matchesQuery(e, q));
        return { grupo: gv.grupo, estudiantes: estudiantesFiltrados };
      })
      .filter((gv) => gv.estudiantes.length > 0);
  });

  protected readonly sinGrupoFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.estudiantesSinGrupo();
    return this.estudiantesSinGrupo().filter((u) => this.matchesQuery(u, q));
  });

  protected readonly archivadosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.usuariosArchivados();
    return this.usuariosArchivados().filter((u) => this.matchesQuery(u, q));
  });

  // ── Archivados por rol ────────────────────────────────────
  protected readonly adminsArchivados = computed(() =>
    this.archivadosFiltrados().filter((u) => u.role === Role.ADMIN),
  );
  protected readonly profesoresArchivados = computed(() =>
    this.archivadosFiltrados().filter((u) => u.role === Role.PROFESOR),
  );
  protected readonly estudiantesArchivados = computed(() =>
    this.archivadosFiltrados().filter((u) => u.role === Role.ESTUDIANTE),
  );

  protected readonly hayResultados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return true;
    return (
      this.adminsActivosFiltrados().length > 0 ||
      this.profesoresActivosFiltrados().length > 0 ||
      this.gruposFiltrados().length > 0 ||
      this.sinGrupoFiltrados().length > 0 ||
      this.archivadosFiltrados().length > 0
    );
  });

  // ── Helpers de relación usuario-grupo ────────────────────
  protected gruposDelProfesor(profesorId: string): Grupo[] {
    return this.todosLosGrupos()
      .filter((g) => g.profesorId === profesorId && g.isActive)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  protected grupoDelEstudiante(estudianteId: string): string | null {
    for (const gv of this.gruposConEstudiantes()) {
      if (gv.estudiantes.some((e) => e.id === estudianteId)) {
        return gv.grupo.nombre;
      }
    }
    return null;
  }

  protected readonly createForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    role: [Role.ESTUDIANTE, [Validators.required]],
  });

  protected readonly editForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    role: [Role.ESTUDIANTE, [Validators.required]],
  });

  ngOnInit(): void {
    this.cargarUsuarios();
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('crear') === '1') {
        this.abrirCrear();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { crear: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  }

  cargarUsuarios() {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      usuarios: this.usuariosApi.listarUsuarios(),
      grupos: this.gruposService.listar(),
    }).subscribe({
      next: ({ usuarios, grupos }) => {
        this.usuarios.set(usuarios);
        this.todosLosGrupos.set(grupos);
        this.cargarAgrupacionEstudiantes(usuarios, grupos);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los usuarios.'),
        );
        this.loading.set(false);
      },
    });
  }

  private cargarAgrupacionEstudiantes(usuarios: Usuario[], grupos: Grupo[]) {
    const gruposActivos = grupos
      .filter((grupo) => grupo.isActive)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const estudiantesActivos = usuarios.filter(
      (usuario) => usuario.role === Role.ESTUDIANTE && usuario.isActive,
    );

    if (gruposActivos.length === 0) {
      this.gruposConEstudiantes.set([]);
      this.estudiantesSinGrupo.set(estudiantesActivos);
      this.loading.set(false);
      return;
    }

    forkJoin(
      gruposActivos.map((grupo) =>
        this.gruposService.listarEstudiantes(grupo.id).pipe(
          map((estudiantes) => ({
            grupo,
            estudiantes: estudiantes
              .filter((estudiante) => estudiante.isActive)
              .sort((a, b) => a.fullName.localeCompare(b.fullName)),
          })),
        ),
      ),
    ).subscribe({
      next: (resultados) => {
        const idsEnGrupo = new Set<string>();

        for (const resultado of resultados) {
          for (const estudiante of resultado.estudiantes) {
            idsEnGrupo.add(estudiante.id);
          }
        }

        this.gruposConEstudiantes.set(
          resultados.filter((resultado) => resultado.estudiantes.length > 0),
        );
        this.estudiantesSinGrupo.set(
          estudiantesActivos
            .filter((estudiante) => !idsEnGrupo.has(estudiante.id))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        );
        this.loading.set(false);
      },
      error: (error) => {
        this.gruposConEstudiantes.set([]);
        this.estudiantesSinGrupo.set(estudiantesActivos);
        this.errorMessage.set(
          getErrorMessage(
            error,
            'Usuarios cargados, pero no fue posible agrupar estudiantes por grupo.',
          ),
        );
        this.loading.set(false);
      },
    });
  }

  abrirCrear() {
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.editingUsuario.set(null);
    this.createForm.reset({
      fullName: '',
      email: '',
      role: Role.ESTUDIANTE,
    });
    this.panelMode.set('create');
  }

  abrirEditar(usuario: Usuario) {
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.editingUsuario.set(usuario);
    this.editForm.reset({
      fullName: usuario.fullName,
      role: usuario.role,
    });
    if (this.esAdminActual(usuario)) {
      this.editForm.controls.role.disable();
    } else {
      this.editForm.controls.role.enable();
    }
    this.panelMode.set('edit');
  }

  cerrarPanel() {
    this.panelMode.set('none');
    this.editingUsuario.set(null);
  }

  esAdminActual(usuario: Usuario): boolean {
    return usuario.id === this.currentUserId();
  }

  esUltimoAdminActivo(usuario: Usuario): boolean {
    return (
      usuario.role === Role.ADMIN &&
      usuario.isActive &&
      this.adminsActivos().length <= 1
    );
  }

  puedeArchivar(usuario: Usuario): boolean {
    return (
      usuario.isActive &&
      !this.esAdminActual(usuario) &&
      !this.esUltimoAdminActivo(usuario)
    );
  }

  crearUsuario() {
    if (this.createForm.invalid || this.saving()) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.usuariosApi.crearUsuario(this.createForm.getRawValue()).subscribe({
      next: (response) => {
        this.saving.set(false);
        if (response.warning) {
          this.successMessage.set(response.warning);
        } else if (response.emailSent) {
          this.successMessage.set(
            'Usuario creado. Se envió un correo con la contraseña temporal.',
          );
        } else {
          this.successMessage.set('Usuario creado correctamente.');
        }
        this.cerrarPanel();
        this.cargarUsuarios();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible crear el usuario.'),
        );
      },
    });
  }

  guardarEdicion() {
    const usuario = this.editingUsuario();
    if (!usuario || this.editForm.invalid || this.saving()) {
      this.editForm.markAllAsTouched();
      return;
    }

    const raw = this.editForm.getRawValue();
    const payload: { fullName?: string; role?: Role } = {
      fullName: raw.fullName.trim(),
    };

    if (!this.esAdminActual(usuario) && raw.role !== usuario.role) {
      payload.role = raw.role;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.usuariosApi.actualizarUsuario(usuario.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Usuario actualizado correctamente.');
        this.cerrarPanel();
        this.cargarUsuarios();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible actualizar el usuario.'),
        );
      },
    });
  }

  cambiarEstado(usuario: Usuario) {
    if (this.saving()) {
      return;
    }

    if (usuario.isActive) {
      if (this.esAdminActual(usuario)) {
        this.errorMessage.set('No puedes archivar tu propia cuenta.');
        return;
      }

      if (this.esUltimoAdminActivo(usuario)) {
        this.errorMessage.set(
          'Debe existir al menos un administrador activo.',
        );
        return;
      }

      this.usuarioPendienteEstado = usuario;
      this.confirmTitle.set('Archivar usuario');
      this.confirmMessage.set(
        'Este usuario dejará de aparecer en los listados principales y no podrá acceder a MENTORA. Su historial académico, evidencias y registros se conservarán.',
      );
      this.confirmLabel.set('Archivar usuario');
      this.confirmDestructive.set(false);
      this.confirmOpen.set(true);
      return;
    }

    this.ejecutarCambiarEstado(usuario);
  }

  confirmarCambioEstado(): void {
    const usuario = this.usuarioPendienteEstado;
    if (!usuario) {
      this.cerrarConfirmacion();
      return;
    }

    this.ejecutarCambiarEstado(usuario);
  }

  cerrarConfirmacion(): void {
    if (this.saving()) {
      return;
    }

    this.confirmOpen.set(false);
    this.usuarioPendienteEstado = null;
  }

  private ejecutarCambiarEstado(usuario: Usuario) {
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.usuariosApi
      .cambiarEstadoUsuario(usuario.id, !usuario.isActive)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.cerrarConfirmacion();
          this.successMessage.set(
            usuario.isActive
              ? 'Usuario archivado correctamente.'
              : 'Usuario reactivado correctamente.',
          );
          this.cargarUsuarios();
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(
            getErrorMessage(error, 'No fue posible cambiar el estado.'),
          );
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
