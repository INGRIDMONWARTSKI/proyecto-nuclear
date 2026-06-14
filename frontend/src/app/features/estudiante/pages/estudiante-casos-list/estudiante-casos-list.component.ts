import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import {
  SiepStatusBadge,
  StatusBadgeComponent,
} from '../../../../shared/ui/status-badge/status-badge.component';
import { SimulacionEstudianteService } from '../../../simulacion/services/simulacion-estudiante.service';
import { CasoPublicado } from '../../../simulacion/models/caso-publicado.model';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import {
  EstadoCasoEstudiante,
  ResumenSesionCaso,
  buildResumenSesionesPorCaso,
  getResumenCaso,
} from '../../utils/estudiante-sesion-estado.util';
import {
  GuideChoice,
  hasGuideChoice,
  setGuideChoice,
} from '../../utils/video-guide.util';
import { VideoGuidePickerComponent } from '../../components/video-guide-picker/video-guide-picker.component';

type PendingAction = { type: 'iniciar' | 'continuar' | 'reintentar'; id: string };

@Component({
  selector: 'app-estudiante-casos-list',
  standalone: true,
  imports: [
    RouterLink,
    LoadingStateComponent,
    AlertMessageComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
    VideoGuidePickerComponent,
  ],
  templateUrl: './estudiante-casos-list.component.html',
  styleUrl: './estudiante-casos-list.component.scss',
})
export class EstudianteCasosListComponent implements OnInit {
  private readonly simulacionService = inject(SimulacionEstudianteService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly startingCasoId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly casos = signal<CasoPublicado[]>([]);
  protected readonly resumenPorCaso = signal<Map<string, ResumenSesionCaso>>(new Map());

  protected readonly showGuidePicker = signal(false);
  private pendingAction: PendingAction | null = null;

  ngOnInit(): void {
    this.loadCasos();
  }

  loadCasos() {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      casos: this.simulacionService.getCasosPublicados(),
      sesionesActivas: this.simulacionService.listarSesionesActivas(),
      historial: this.simulacionService.listarHistorial(),
    }).subscribe({
      next: ({ casos, sesionesActivas, historial }) => {
        this.casos.set(casos);
        this.resumenPorCaso.set(
          buildResumenSesionesPorCaso(sesionesActivas, historial),
        );
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los casos asignados.'),
        );
        this.loading.set(false);
      },
    });
  }

  resumenDe(casoId: string): ResumenSesionCaso {
    return getResumenCaso(this.resumenPorCaso(), casoId);
  }

  estadoLabel(estado: EstadoCasoEstudiante): string {
    switch (estado) {
      case 'en_progreso':
        return 'En progreso';
      case 'finalizado':
        return 'Finalizado';
      default:
        return 'Disponible';
    }
  }

  estadoBadge(estado: EstadoCasoEstudiante): SiepStatusBadge {
    switch (estado) {
      case 'en_progreso':
        return 'pending';
      case 'finalizado':
        return 'success';
      default:
        return 'active';
    }
  }

  /**
   * Intercepta todos los botones de acción antes de ejecutarlos.
   * — 'reintentar' siempre fuerza el selector de guía (nuevo intento = nueva elección).
   * — 'iniciar'    muestra el selector solo si no hay guía guardada.
   * — 'continuar'  usa la guía guardada si existe; si no, pide al usuario elegir.
   */
  requestGuideOrProceed(type: 'iniciar' | 'continuar' | 'reintentar', id: string): void {
    const forceShow = type === 'reintentar';
    if (forceShow || !hasGuideChoice()) {
      this.pendingAction = { type, id };
      this.showGuidePicker.set(true);
      return;
    }
    this.executeAction(type, id);
  }

  onGuideSelected(choice: GuideChoice): void {
    setGuideChoice(choice);
    this.showGuidePicker.set(false);
    const action = this.pendingAction;
    this.pendingAction = null;
    if (action) {
      this.executeAction(action.type, action.id);
    }
  }

  onGuidePickerClosed(): void {
    this.showGuidePicker.set(false);
    this.pendingAction = null;
  }

  /** Permite al estudiante cambiar la guía sin iniciar ningún caso. */
  solicitarCambioDeGuia(): void {
    this.pendingAction = null;
    this.showGuidePicker.set(true);
  }

  private executeAction(type: 'iniciar' | 'continuar' | 'reintentar', id: string): void {
    if (type === 'continuar') {
      this.continuarSimulacion(id);
    } else {
      // Both 'iniciar' and 'reintentar' start a new session
      this.iniciarSimulacion(id);
    }
  }

  continuarSimulacion(sesionId: string) {
    void this.router.navigate(['/estudiante/sesiones', sesionId]);
  }

  iniciarSimulacion(casoId: string) {
    this.startingCasoId.set(casoId);
    this.errorMessage.set(null);
    this.simulacionService.startSesion(casoId).subscribe({
      next: (res) => {
        this.startingCasoId.set(null);
        void this.router.navigate(['/estudiante/sesiones', res.sesionId]);
      },
      error: (error) => {
        this.startingCasoId.set(null);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible iniciar la simulación.'),
        );
      },
    });
  }

  reintentarCaso(casoId: string) {
    this.iniciarSimulacion(casoId);
  }
}
