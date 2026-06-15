import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Grupo } from '../../../../core/models/grupo.model';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { CasoDocente } from '../../../simulacion/models/docente/caso-docente.model';
import {
  CasoGrupoAsignado,
  SimulacionDocenteService,
} from '../../../simulacion/services/simulacion-docente.service';
import { GruposService } from '../../services/grupos.service';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-docente-asignaciones',
  standalone: true,
  imports: [
    AlertMessageComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './docente-asignaciones.component.html',
  styleUrl: './docente-asignaciones.component.scss',
})
export class DocenteAsignacionesComponent implements OnInit {
  private readonly simulacionService = inject(SimulacionDocenteService);
  private readonly gruposService = inject(GruposService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loadingCasos = signal(true);
  protected readonly loadingGrupos = signal(true);
  protected readonly loadingAsignados = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly casosPublicados = signal<CasoDocente[]>([]);
  protected readonly casosBorrador = signal(0);
  protected readonly grupos = signal<Grupo[]>([]);
  protected readonly selectedCasoId = signal<string | null>(null);

  private readonly asignadosOriginal = signal<Set<string>>(new Set());
  protected readonly seleccion = signal<Set<string>>(new Set());

  protected readonly hayCambios = computed(() => {
    const actual = this.seleccion();
    const original = this.asignadosOriginal();
    if (actual.size !== original.size) {
      return true;
    }
    for (const id of actual) {
      if (!original.has(id)) {
        return true;
      }
    }
    return false;
  });

  ngOnInit(): void {
    this.cargarCasos();
    this.cargarGrupos();
  }

  private cargarCasos() {
    this.loadingCasos.set(true);
    this.simulacionService.listarBibliotecaCasos().subscribe({
      next: (casos) => {
        this.casosPublicados.set(
          casos.filter((caso) => caso.estado === 'published'),
        );
        this.casosBorrador.set(
          casos.filter((caso) => caso.estado === 'draft').length,
        );
        const preselectCasoId = this.route.snapshot.queryParamMap.get('casoId');
        if (
          preselectCasoId &&
          this.casosPublicados().some((caso) => caso.id === preselectCasoId)
        ) {
          this.seleccionarCaso(preselectCasoId);
        }
        this.loadingCasos.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los casos publicados.'),
        );
        this.loadingCasos.set(false);
      },
    });
  }

  private cargarGrupos() {
    this.loadingGrupos.set(true);
    this.gruposService.listar().subscribe({
      next: (grupos) => {
        this.grupos.set(grupos.filter((grupo) => grupo.isActive));
        this.loadingGrupos.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los grupos.'),
        );
        this.loadingGrupos.set(false);
      },
    });
  }

  seleccionarCaso(casoId: string) {
    if (this.selectedCasoId() === casoId) {
      return;
    }
    this.selectedCasoId.set(casoId);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.cargarAsignados(casoId);
  }

  private cargarAsignados(casoId: string) {
    this.loadingAsignados.set(true);
    this.asignadosOriginal.set(new Set());
    this.seleccion.set(new Set());
    this.simulacionService.listarGruposAsignados(casoId).subscribe({
      next: (asignados) => {
        const ids = new Set(asignados.map((item) => item.grupoId));
        this.asignadosOriginal.set(new Set(ids));
        this.seleccion.set(new Set(ids));
        this.loadingAsignados.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar las asignaciones del caso.'),
        );
        this.loadingAsignados.set(false);
      },
    });
  }

  estaSeleccionado(grupoId: string): boolean {
    return this.seleccion().has(grupoId);
  }

  toggleGrupo(grupoId: string) {
    const actual = new Set(this.seleccion());
    if (actual.has(grupoId)) {
      actual.delete(grupoId);
    } else {
      actual.add(grupoId);
    }
    this.seleccion.set(actual);
    this.successMessage.set(null);
  }

  irACasos(): void {
    void this.router.navigate(['/profesor/casos']);
  }

  irAGrupos(): void {
    void this.router.navigate(['/profesor/grupos']);
  }

  mensajeSinCasosPublicados(): string {
    const borradores = this.casosBorrador();
    if (borradores > 0) {
      return `Tienes ${borradores} ${borradores === 1 ? 'caso en borrador' : 'casos en borrador'}. Publícalo desde la gestión del caso antes de asignarlo a tus grupos.`;
    }

    return 'Crea un caso y publícalo desde la gestión del caso antes de asignarlo a tus grupos académicos.';
  }

  guardar() {
    const casoId = this.selectedCasoId();
    if (!casoId || this.saving()) {
      return;
    }

    const original = this.asignadosOriginal();
    const actual = this.seleccion();

    const toAdd = [...actual].filter((id) => !original.has(id));
    const toRemove = [...original].filter((id) => !actual.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      this.successMessage.set('No hay cambios para guardar.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const operaciones = [];
    if (toAdd.length > 0) {
      operaciones.push(this.simulacionService.asignarGrupos(casoId, toAdd));
    }
    for (const grupoId of toRemove) {
      operaciones.push(this.simulacionService.quitarAsignacion(casoId, grupoId));
    }

    forkJoin(operaciones).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Asignaciones actualizadas correctamente.');
        this.cargarAsignados(casoId);
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible guardar las asignaciones.'),
        );
        this.cargarAsignados(casoId);
      },
    });
  }
}
