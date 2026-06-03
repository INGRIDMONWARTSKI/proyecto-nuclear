import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Usuario } from '../../../../core/models/usuario.model';
import { AuthService } from '../../../../core/services/auth.service';
import { classroomAnimations } from './classroom.animations';
import { ClassroomDeskComponent } from './classroom-desk.component';
import { buildAvatarStyle } from './avatar.util';
import { filtrarEstudiantesPorBusqueda } from '../../utils/estudiante-busqueda.util';

export interface DeskSlot {
  index: number;
  estudiante: Usuario | null;
}

@Component({
  selector: 'app-classroom-scene',
  standalone: true,
  imports: [ClassroomDeskComponent],
  animations: [classroomAnimations],
  templateUrl: './classroom-scene.component.html',
  styleUrl: './classroom-scene.component.scss',
})
export class ClassroomSceneComponent {
  private readonly authService = inject(AuthService);

  readonly estudiantes = input<Usuario[]>([]);
  readonly estudiantesDisponibles = input<Usuario[]>([]);
  readonly puedeAdministrar = input(false);
  readonly grupoActivo = input(true);
  readonly loadingSalon = input(false);
  readonly asientos = input<Record<number, string>>({});

  readonly estudianteSeleccionado = signal<Usuario | null>(null);
  readonly pupitreSeleccionado = signal<number | null>(null);
  readonly mostrarAsignar = signal(false);
  readonly pupitreParaAsignar = signal<number | null>(null);
  readonly busquedaAsignar = signal('');

  readonly removeRequested = output<Usuario>();
  readonly assignRequested = output<{ estudianteId: string; deskIndex: number }>();

  protected readonly buildAvatarStyle = buildAvatarStyle;

  private readonly estudiantesPorId = computed(() => {
    const map = new Map<string, Usuario>();
    for (const estudiante of this.estudiantes()) {
      map.set(estudiante.id, estudiante);
    }
    return map;
  });

  readonly slots = computed(() => this.buildSlots());
  readonly columnas = computed(() => {
    const total = this.slots().length;
    if (total <= 6) return 3;
    if (total <= 12) return 4;
    return 4;
  });

  readonly avatarProfesor = computed(() =>
    buildAvatarStyle(this.authService.user()?.fullName ?? 'Profesor', 'teacher'),
  );

  readonly disponiblesParaAsignar = computed(() => {
    const ids = new Set(this.estudiantes().map((e) => e.id));
    return this.estudiantesDisponibles().filter((e) => !ids.has(e.id));
  });

  readonly disponiblesFiltrados = computed(() =>
    filtrarEstudiantesPorBusqueda(
      this.disponiblesParaAsignar(),
      this.busquedaAsignar(),
    ),
  );

  onDeskClick(slot: DeskSlot) {
    if (!this.grupoActivo()) {
      return;
    }

    this.pupitreSeleccionado.set(slot.index);

    if (slot.estudiante) {
      this.estudianteSeleccionado.set(slot.estudiante);
      this.mostrarAsignar.set(false);
      this.pupitreParaAsignar.set(null);
      return;
    }

    this.estudianteSeleccionado.set(null);

    if (this.puedeAdministrar()) {
      this.busquedaAsignar.set('');
      this.pupitreParaAsignar.set(slot.index);
      this.mostrarAsignar.set(true);
    }
  }

  cerrarPanel() {
    this.estudianteSeleccionado.set(null);
    this.pupitreSeleccionado.set(null);
    this.mostrarAsignar.set(false);
    this.pupitreParaAsignar.set(null);
    this.busquedaAsignar.set('');
  }

  actualizarBusquedaAsignar(event: Event) {
    const input = event.target as HTMLInputElement;
    this.busquedaAsignar.set(input.value);
  }

  limpiarBusquedaAsignar() {
    this.busquedaAsignar.set('');
  }

  solicitarRemover(estudiante: Usuario) {
    this.removeRequested.emit(estudiante);
    this.cerrarPanel();
  }

  seleccionarParaAsignar(estudianteId: string) {
    const deskIndex = this.pupitreParaAsignar();
    if (deskIndex === null) {
      return;
    }

    this.assignRequested.emit({ estudianteId, deskIndex });
    this.cerrarPanel();
  }

  private buildSlots(): DeskSlot[] {
    const list = this.estudiantes();
    const seatMap = this.asientos();
    const byId = this.estudiantesPorId();
    const count = list.length;
    const minDesks = 12;
    const extra = count > 8 ? Math.ceil(count / 4) * 4 - count + 4 : 4;
    const total = Math.min(Math.max(minDesks, count + extra), 24);
    const slots: DeskSlot[] = [];

    for (let i = 0; i < total; i++) {
      const assignedId = seatMap[i];
      const estudiante = assignedId
        ? (byId.get(assignedId) ?? null)
        : (list[i] ?? null);

      slots.push({ index: i, estudiante });
    }

    return slots;
  }
}
