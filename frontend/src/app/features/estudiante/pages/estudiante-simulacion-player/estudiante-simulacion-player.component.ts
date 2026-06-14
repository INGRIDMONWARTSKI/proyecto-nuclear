import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, take } from 'rxjs';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { FeedbackPanelComponent, FeedbackView } from '../../../../shared/simulacion/feedback-panel/feedback-panel.component';
import { OpcionesRespuestaComponent } from '../../../../shared/simulacion/opciones-respuesta/opciones-respuesta.component';
import { EscenarioViewerComponent } from '../../../../shared/simulacion/escenario-viewer/escenario-viewer.component';
import { SimulacionProgressComponent } from '../../../../shared/simulacion/simulacion-progress/simulacion-progress.component';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EscenarioActualResponse, OpcionEscenario } from '../../../simulacion/models/escenario-actual.model';
import { RespuestaSubmitResponse } from '../../../simulacion/models/respuesta-submit.model';
import { SimulacionEstudianteService } from '../../../simulacion/services/simulacion-estudiante.service';
import {
  getVideoSrc,
  isClosingWatched,
  isIntroWatched,
  markClosingWatched,
  markIntroWatched,
} from '../../utils/video-guide.util';
import { VideoOverlayComponent } from '../../components/video-overlay/video-overlay.component';

type VideoPhase = 'none' | 'intro' | 'transition' | 'closing';

@Component({
  selector: 'app-estudiante-simulacion-player',
  standalone: true,
  imports: [
    RouterLink,
    AlertMessageComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    FeedbackPanelComponent,
    OpcionesRespuestaComponent,
    EscenarioViewerComponent,
    SimulacionProgressComponent,
    VideoOverlayComponent,
  ],
  templateUrl: './estudiante-simulacion-player.component.html',
  styleUrl: './estudiante-simulacion-player.component.scss',
})
export class EstudianteSimulacionPlayerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly simulacionService = inject(SimulacionEstudianteService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly data = signal<EscenarioActualResponse | null>(null);
  protected readonly selectedOpcion = signal<OpcionEscenario | null>(null);
  protected readonly feedback = signal<FeedbackView | null>(null);
  protected readonly completed = signal(false);

  // Video guide state — does not affect functional signals above
  protected readonly videoPhase = signal<VideoPhase>('none');
  protected readonly videoSrc = signal('');
  protected readonly videoTitle = signal('');
  protected readonly videoDesc = signal('');
  // Triggers a CSS fade-in on the scene content each time a video overlay is dismissed.
  protected readonly sceneEntering = signal(false);

  private sesionId = '';
  private introChecked = false;

  // Observable derived from data signal for reactive intro check
  private readonly data$ = toObservable(this.data);

  ngOnInit(): void {
    this.sesionId = this.route.snapshot.paramMap.get('sesionId') ?? '';
    if (!this.sesionId) {
      void this.router.navigate(['/estudiante/casos']);
      return;
    }

    this.loadEscenarioActual();
    this.checkIntroVideo();
  }

  loadEscenarioActual() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.selectedOpcion.set(null);
    this.feedback.set(null);

    this.simulacionService.getEscenarioActual(this.sesionId).subscribe({
      next: (res) => {
        this.data.set(res);
        this.completed.set(Boolean(res.completed) || !res.escenario);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar el escenario actual.'),
        );
        this.loading.set(false);
      },
    });
  }

  seleccionarOpcion(opcion: OpcionEscenario) {
    this.selectedOpcion.set(opcion);
  }

  responder() {
    const payload = this.selectedOpcion();
    const data = this.data();
    const pregunta = data?.escenario?.pregunta;
    if (!payload || !pregunta) {
      return;
    }

    this.sending.set(true);
    this.errorMessage.set(null);

    this.simulacionService
      .submitRespuesta(this.sesionId, {
        preguntaId: pregunta.id,
        opcionId: payload.id,
      })
      .subscribe({
        next: (res) => this.handleRespuesta(res),
        error: (error) => {
          this.sending.set(false);
          this.errorMessage.set(
            getErrorMessage(error, 'No fue posible enviar la respuesta.'),
          );
        },
      });
  }

  continuar() {
    this.loadEscenarioActual();
  }

  verResultado() {
    void this.router.navigate(['/estudiante/resultados', this.sesionId]);
  }

  /** Intercepta "Continuar recorrido": muestra video de transición antes de cargar siguiente escena. */
  handleContinuarClick(): void {
    this.triggerVideo(
      'transition',
      'Antes de continuar',
      'Observa esta transición antes de avanzar a la siguiente escena.',
    );
  }

  /** Intercepta "Ver resultado": muestra video de cierre si aún no fue visto. */
  handleVerResultadoClick(): void {
    if (!isClosingWatched(this.sesionId)) {
      this.triggerVideo(
        'closing',
        'Cierre de experiencia',
        'Observa el cierre antes de revisar tu retroalimentación final.',
      );
    } else {
      this.verResultado();
    }
  }

  /** Llamado por VideoOverlayComponent cuando el video termina o el estudiante lo omite. */
  onVideoEnded(): void {
    const phase = this.videoPhase();
    if (phase === 'none') {
      return;
    }
    this.videoPhase.set('none');
    this.videoSrc.set('');
    this.videoTitle.set('');
    this.videoDesc.set('');

    // Trigger scene fade-in to smooth the transition from overlay to content.
    this.sceneEntering.set(true);
    setTimeout(() => this.sceneEntering.set(false), 500);

    switch (phase) {
      case 'intro':
        markIntroWatched(this.sesionId);
        // Scenario was already loaded in background; template reveals it automatically.
        break;
      case 'transition':
        this.continuar();
        break;
      case 'closing':
        markClosingWatched(this.sesionId);
        this.verResultado();
        break;
    }
  }

  private handleRespuesta(res: RespuestaSubmitResponse) {
    this.sending.set(false);
    const feedbackView: FeedbackView = res.retroalimentacion
      ? {
          ...res.retroalimentacion,
          puntajeObtenido: res.puntajeObtenido,
        }
      : {
          mensaje: 'Respuesta registrada.',
          tipo: 'pedagogica',
          referenciaTeorica: null,
          puntajeObtenido: res.puntajeObtenido,
        };

    this.feedback.set(feedbackView);

    if (res.completed) {
      this.completed.set(true);
    }
  }

  private triggerVideo(phase: VideoPhase, title: string, desc: string): void {
    this.videoTitle.set(title);
    this.videoDesc.set(desc);
    this.videoSrc.set(
      getVideoSrc(
        phase === 'intro'
          ? 'intro'
          : phase === 'transition'
            ? 'transicion'
            : 'cierre',
      ),
    );
    this.videoPhase.set(phase);
  }

  /**
   * Observa la primera carga exitosa de data para decidir si mostrar el video introductorio.
   * No modifica loadEscenarioActual() ni ninguna señal funcional.
   */
  private checkIntroVideo(): void {
    this.data$
      .pipe(
        filter((d): d is EscenarioActualResponse => d !== null),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((d) => {
        if (this.introChecked) return;
        this.introChecked = true;

        if (
          d.escenario &&
          d.progreso.respondidas === 0 &&
          !isIntroWatched(this.sesionId)
        ) {
          this.triggerVideo(
            'intro',
            'Antes de iniciar',
            'Observa esta introducción para comprender tu rol en el caso.',
          );
        }
      });
  }
}
