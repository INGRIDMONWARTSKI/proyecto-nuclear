import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Role } from '../../../../../core/models/role.enum';
import { AuthService } from '../../../../../core/services/auth.service';
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { GruposService } from '../../../services/grupos.service';
import { UsuariosApiService } from '../../../services/usuarios-api.service';
import { Usuario } from '../../../../../core/models/usuario.model';
import { AdminAmbientComponent } from '../../../../admin/shared/admin-ambient/admin-ambient.component';

@Component({
  selector: 'app-grupo-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertMessageComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    AdminAmbientComponent,
  ],
  templateUrl: './grupo-form.component.html',
  styleUrl: './grupo-form.component.scss',
})
export class GrupoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gruposService = inject(GruposService);
  private readonly usuariosApiService = inject(UsuariosApiService);
  protected readonly authService = inject(AuthService);

  protected readonly Role = Role;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly profesores = signal<Usuario[]>([]);

  protected readonly isEdit = signal(false);
  private grupoId: string | null = null;

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    descripcion: ['', [Validators.maxLength(500)]],
    profesorId: [''],
  });

  ngOnInit() {
    const path = this.route.snapshot.routeConfig?.path ?? '';
    this.isEdit.set(path.includes('editar'));
    this.grupoId = this.isEdit()
      ? this.route.snapshot.paramMap.get('id')
      : null;

    if (this.authService.hasRole(Role.ADMIN)) {
      this.form.controls.profesorId.setValidators(
        this.isEdit() ? [] : [Validators.required],
      );
      this.cargarProfesores();
    } else {
      this.loading.set(false);
    }

    if (this.grupoId) {
      this.cargarGrupo(this.grupoId);
    }
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const payload: {
      nombre: string;
      descripcion?: string;
      profesorId?: string;
    } = {
      nombre: this.form.controls.nombre.value.trim(),
      descripcion: this.form.controls.descripcion.value.trim() || undefined,
    };

    if (this.authService.hasRole(Role.ADMIN)) {
      const profesorId = this.form.controls.profesorId.value.trim();

      if (!profesorId && !this.isEdit()) {
        this.saving.set(false);
        this.errorMessage.set('Selecciona un profesor.');
        return;
      }

      if (profesorId) {
        payload.profesorId = profesorId;
      }
    }

    const request = this.isEdit() && this.grupoId
      ? this.gruposService.actualizar(this.grupoId, payload)
      : this.gruposService.crear(payload);

    request.subscribe({
      next: (grupo) => {
        this.saving.set(false);
        void this.router.navigate([
          this.authService.getRoleBasePath().slice(1),
          'grupos',
          grupo.id,
        ]);
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible guardar el grupo.'),
        );
      },
    });
  }

  private cargarGrupo(id: string) {
    this.gruposService.obtener(id).subscribe({
      next: (grupo) => {
        this.form.patchValue({
          nombre: grupo.nombre,
          descripcion: grupo.descripcion ?? '',
          profesorId: grupo.profesorId,
        });
        if (!this.authService.hasRole(Role.ADMIN)) {
          this.loading.set(false);
        }
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar el grupo.'),
        );
        this.loading.set(false);
      },
    });
  }

  private cargarProfesores() {
    this.usuariosApiService.listarUsuarios().subscribe({
      next: (usuarios) => {
        this.profesores.set(
          usuarios.filter(
            (usuario) => usuario.role === Role.PROFESOR && usuario.isActive,
          ),
        );

        if (!this.isEdit()) {
          this.loading.set(false);
        } else if (this.grupoId) {
          this.loading.set(false);
        }
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar profesores.'),
        );
        this.loading.set(false);
      },
    });
  }

  formSubtitle(): string | undefined {
    if (this.authService.hasRole(Role.PROFESOR) && !this.isEdit()) {
      return 'Se asignará a tu usuario como profesor.';
    }
    return undefined;
  }
}
