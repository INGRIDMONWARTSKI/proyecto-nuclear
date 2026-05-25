import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Role } from '../../../core/models/role.enum';
import { Grupo } from '../../../core/models/grupo.model';
import { Usuario } from '../../../core/models/usuario.model';
import { AuthService } from '../../../core/services/auth.service';
import { getErrorMessage } from '../../../core/utils/http-error.util';
import { AlertMessageComponent } from '../../../shared/components/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { ClassroomSceneComponent } from '../../components/salon-clases/classroom-scene.component';
import { GruposService } from '../../services/grupos.service';
import { UsuariosApiService } from '../../services/usuarios-api.service';
import { filtrarEstudiantesPorBusqueda } from '../../utils/estudiante-busqueda.util';

@Component({
  selector: 'app-grupo-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    AlertMessageComponent,
    LoadingStateComponent,
    ClassroomSceneComponent,
  ],
  templateUrl: './grupo-detail.component.html',
  styleUrl: './grupo-detail.component.scss',
})
export class GrupoDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly gruposService = inject(GruposService);
  private readonly usuariosApiService = inject(UsuariosApiService);
  protected readonly authService = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly loadingEstudiantes = signal(false);
  protected readonly assigning = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly grupoData = signal<Grupo | null>(null);
  protected readonly estudiantes = signal<Usuario[]>([]);
  protected readonly estudiantesDisponibles = signal<Usuario[]>([]);
  protected readonly showAssignPanel = signal(false);
  protected readonly busquedaAsignacion = signal('');
  protected readonly asientos = signal<Record<number, string>>({});

  protected readonly assignForm = this.fb.nonNullable.group({
    estudianteIds: [[] as string[]],
  });

  protected readonly estudiantesPendientes = computed(() => {
    const asignados = new Set(this.estudiantes().map((e) => e.id));
    return this.estudiantesDisponibles().filter((e) => !asignados.has(e.id));
  });

  protected readonly estudiantesPendientesFiltrados = computed(() =>
    filtrarEstudiantesPorBusqueda(
      this.estudiantesPendientes(),
      this.busquedaAsignacion(),
    ),
  );

  protected readonly puedeAdministrar = computed(() => {
    const grupo = this.grupoData();
    const user = this.authService.user();
    if (!grupo || !user) {
      return false;
    }
    if (user.role === Role.ADMIN) {
      return true;
    }
    return user.role === Role.PROFESOR && grupo.profesorId === user.id;
  });

  private grupoId = '';

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.grupoId = params.get('id') ?? '';
      if (!this.grupoId) {
        void this.router.navigate(['/grupos']);
        return;
      }
      this.cargarDetalle();
    });
  }

  cargarDetalle() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.grupoData.set(null);

    this.gruposService.obtener(this.grupoId).subscribe({
      next: (grupo) => {
        this.grupoData.set(grupo);
        this.loading.set(false);
        this.cargarEstudiantes();
        if (this.puedeAdministrar()) {
          this.cargarEstudiantesDisponibles();
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

  cargarEstudiantes() {
    this.loadingEstudiantes.set(true);

    this.gruposService.listarEstudiantes(this.grupoId).subscribe({
      next: (estudiantes) => {
        this.estudiantes.set(estudiantes);
        this.syncAsientos(estudiantes);
        this.loadingEstudiantes.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los estudiantes.'),
        );
        this.loadingEstudiantes.set(false);
      },
    });
  }

  cargarEstudiantesDisponibles() {
    this.usuariosApiService.listarUsuarios().subscribe({
      next: (usuarios) => {
        this.estudiantesDisponibles.set(
          this.usuariosApiService.filtrarEstudiantes(usuarios),
        );
      },
      error: (error) => {
        this.estudiantesDisponibles.set([]);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar el listado de estudiantes.'),
        );
      },
    });
  }

  toggleAssignPanel() {
    const abrir = !this.showAssignPanel();
    this.showAssignPanel.set(abrir);
    if (!abrir) {
      this.busquedaAsignacion.set('');
    }
  }

  actualizarBusquedaAsignacion(event: Event) {
    const input = event.target as HTMLInputElement;
    this.busquedaAsignacion.set(input.value);
  }

  limpiarBusquedaAsignacion() {
    this.busquedaAsignacion.set('');
  }

  estaSeleccionadoParaAsignar(estudianteId: string): boolean {
    return this.assignForm.controls.estudianteIds.value.includes(estudianteId);
  }

  toggleSeleccionEstudiante(estudianteId: string, seleccionado: boolean) {
    const actual = new Set(this.assignForm.controls.estudianteIds.value);
    if (seleccionado) {
      actual.add(estudianteId);
    } else {
      actual.delete(estudianteId);
    }
    this.assignForm.controls.estudianteIds.setValue([...actual]);
  }

  asignarDesdePupitre(event: { estudianteId: string; deskIndex: number }) {
    this.asignarEstudiantesIds([event.estudianteId], event.deskIndex);
  }

  asignarEstudiantes() {
    const ids = [...this.assignForm.controls.estudianteIds.value];
    this.asignarEstudiantesIds([...new Set(ids)]);
  }

  private asignarEstudiantesIds(uniqueIds: string[], deskIndex?: number) {
    if (uniqueIds.length === 0) {
      this.errorMessage.set('Selecciona al menos un estudiante.');
      return;
    }

    this.assigning.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.gruposService
      .asignarEstudiantes(this.grupoId, { estudianteIds: uniqueIds })
      .subscribe({
        next: (estudiantes) => {
          this.estudiantes.set(estudiantes);
          this.syncAsientos(estudiantes);
          if (deskIndex !== undefined && uniqueIds.length === 1) {
            this.aplicarAsientoEnPupitre(uniqueIds[0], deskIndex);
          }
          this.assigning.set(false);
          this.showAssignPanel.set(false);
          this.busquedaAsignacion.set('');
          this.successMessage.set('Estudiante(s) asignado(s) correctamente.');
          this.assignForm.reset({ estudianteIds: [] });
        },
        error: (error) => {
          this.assigning.set(false);
          this.errorMessage.set(
            getErrorMessage(error, 'No fue posible asignar estudiantes.'),
          );
        },
      });
  }

  confirmarRemover(estudiante: Usuario) {
    const grupo = this.grupoData();
    if (!grupo) {
      return;
    }

    const confirmed = confirm(
      `¿Quitar a ${estudiante.fullName} del grupo "${grupo.nombre}"?`,
    );
    if (!confirmed) {
      return;
    }

    this.gruposService.removerEstudiante(this.grupoId, estudiante.id).subscribe({
      next: () => {
        const restantes = this.estudiantes().filter((e) => e.id !== estudiante.id);
        this.estudiantes.set(restantes);
        this.syncAsientos(restantes);
        this.successMessage.set('Estudiante quitado del grupo.');
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible quitar al estudiante.'),
        );
      },
    });
  }

  confirmarDesactivar() {
    const grupo = this.grupoData();
    if (!grupo) {
      return;
    }

    const confirmed = confirm(`¿Desactivar el grupo "${grupo.nombre}"?`);
    if (!confirmed) {
      return;
    }

    this.gruposService.desactivar(this.grupoId).subscribe({
      next: () => {
        void this.router.navigate(['/grupos']);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible desactivar el grupo.'),
        );
      },
    });
  }

  private syncAsientos(estudiantes: Usuario[]) {
    const next: Record<number, string> = {};
    estudiantes.forEach((estudiante, index) => {
      next[index] = estudiante.id;
    });
    this.asientos.set(next);
  }

  private aplicarAsientoEnPupitre(estudianteId: string, deskIndex: number) {
    this.asientos.update((map) => {
      const next = { ...map };
      for (const [idx, id] of Object.entries(next)) {
        if (id === estudianteId) {
          delete next[Number(idx)];
        }
      }
      next[deskIndex] = estudianteId;
      return next;
    });
  }
}
