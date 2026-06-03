import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Role } from '../../../../core/models/role.enum';
import { Usuario } from '../../../../core/models/usuario.model';
import { AuthService } from '../../../../core/services/auth.service';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { UsuariosApiService } from '../../../profesor/services/usuarios-api.service';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import {
  SiepRoleBadge,
  StatusBadgeComponent,
} from '../../../../shared/ui/status-badge/status-badge.component';

type PanelMode = 'none' | 'create' | 'edit';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertMessageComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.scss',
})
export class AdminUsuariosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosApi = inject(UsuariosApiService);
  private readonly authService = inject(AuthService);

  protected readonly Role = Role;
  protected readonly roles = [Role.ADMIN, Role.PROFESOR, Role.ESTUDIANTE];

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly usuarios = signal<Usuario[]>([]);

  protected readonly panelMode = signal<PanelMode>('none');
  protected readonly editingUsuario = signal<Usuario | null>(null);

  protected readonly currentUserId = computed(
    () => this.authService.user()?.id ?? null,
  );

  protected readonly createForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: [Role.ESTUDIANTE, [Validators.required]],
  });

  protected readonly editForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    role: [Role.ESTUDIANTE, [Validators.required]],
  });

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.usuariosApi.listarUsuarios().subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los usuarios.'),
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
      password: '',
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

  crearUsuario() {
    if (this.createForm.invalid || this.saving()) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.usuariosApi.crearUsuario(this.createForm.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Usuario creado correctamente.');
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

    // Solo enviar rol si no es el admin actual y cambió.
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
    if (this.esAdminActual(usuario) && usuario.isActive) {
      return;
    }

    if (this.saving()) {
      return;
    }

    if (usuario.isActive) {
      const confirmar = window.confirm(
        `¿Desactivar a ${usuario.fullName}? No podrá iniciar sesión, pero su historial académico se conserva.`,
      );
      if (!confirmar) {
        return;
      }
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.usuariosApi
      .cambiarEstadoUsuario(usuario.id, !usuario.isActive)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set(
            usuario.isActive
              ? 'Usuario desactivado correctamente.'
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
