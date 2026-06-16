import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, take } from 'rxjs';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
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
  protected readonly completed = signal(false);
  protected readonly responseNotice = signal<string | null>(null);
  protected readonly remainingSeconds = signal(0);
  protected readonly activePreguntaId = signal<string | null>(null);

  // Video guide state — does not affect functional signals above
  protected readonly videoPhase = signal<VideoPhase>('none');
  protected readonly videoSrc = signal('');
  protected readonly videoTitle = signal('');
  protected readonly videoDesc = signal('');
  protected readonly videoPlaybackKey = signal(0);
  // Triggers a CSS fade-in on the scene content each time a video overlay is dismissed.
  protected readonly sceneEntering = signal(false);

  private sesionId = '';
  private introChecked = false;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private afterTransition: (() => void) | null = null;

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
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  loadEscenarioActual() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.responseNotice.set(null);

    this.simulacionService
      .getEscenarioActual(this.sesionId, this.activePreguntaId() ?? undefined)
      .subscribe({
      next: (res) => {
        this.data.set(res);
        this.completed.set(Boolean(res.completed) || !res.escenario);
        this.remainingSeconds.set(res.remainingSeconds ?? 0);
        this.syncSelectedOptionFromState(res);
        this.ensureTimer();
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

  continuar(): void {
    const nav = this.data()?.navegacion ?? [];
    const currentId = this.data()?.escenario?.pregunta.id;
    const idx = nav.findIndex((i) => i.preguntaId === currentId);
    if (idx >= 0 && idx < nav.length - 1) {
      this.applyPreguntaSelection(nav[idx + 1].preguntaId);
    }
  }

  verResultado() {
    void this.router.navigate(['/estudiante/resultados', this.sesionId]);
  }

  /** Intercepta avance: muestra video de transición antes de cargar la siguiente escena/pregunta. */
  handleContinuarClick(): void {
    this.playTransitionVideo(() => this.continuar());
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
      case 'transition': {
        const next = this.afterTransition;
        this.afterTransition = null;
        next?.();
        break;
      }
      case 'closing':
        markClosingWatched(this.sesionId);
        this.verResultado();
        break;
    }
  }

  private handleRespuesta(res: RespuestaSubmitResponse) {
    this.sending.set(false);
    this.responseNotice.set(res.mensaje);
    if (res.completed) {
      this.completed.set(true);
      this.loadEscenarioActual();
      return;
    }

    this.playTransitionVideo(() => this.loadEscenarioActual());
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
    this.videoPlaybackKey.update((key) => key + 1);
    this.videoPhase.set(phase);
  }

  private playTransitionVideo(next: () => void): void {
    this.afterTransition = next;
    this.triggerVideo(
      'transition',
      'Antes de continuar',
      'Observa esta transición antes de avanzar a la siguiente escena.',
    );
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

  protected formatRemaining(): string {
    const total = Math.max(this.remainingSeconds(), 0);
    const minutes = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(total % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  protected selectPregunta(preguntaId: string): void {
    if (this.completed()) return;

    const currentId = this.data()?.escenario?.pregunta.id;
    if (currentId === preguntaId) return;

    const nav = this.data()?.navegacion ?? [];
    const currentIdx = nav.findIndex((item) => item.preguntaId === currentId);
    const targetIdx = nav.findIndex((item) => item.preguntaId === preguntaId);

    if (targetIdx > currentIdx) {
      this.playTransitionVideo(() => this.applyPreguntaSelection(preguntaId));
      return;
    }

    this.applyPreguntaSelection(preguntaId);
  }

  protected goToPreviousPregunta(): void {
    const nav = this.data()?.navegacion ?? [];
    const currentId = this.data()?.escenario?.pregunta.id;
    const idx = nav.findIndex((i) => i.preguntaId === currentId);
    if (idx > 0) this.applyPreguntaSelection(nav[idx - 1].preguntaId);
  }

  protected goToNextPregunta(): void {
    const nav = this.data()?.navegacion ?? [];
    const currentId = this.data()?.escenario?.pregunta.id;
    const idx = nav.findIndex((i) => i.preguntaId === currentId);
    if (idx >= 0 && idx < nav.length - 1) {
      this.playTransitionVideo(() => this.applyPreguntaSelection(nav[idx + 1].preguntaId));
    }
  }

  private applyPreguntaSelection(preguntaId: string): void {
    this.activePreguntaId.set(preguntaId);
    this.loadEscenarioActual();
  }

  protected canGoPrev(): boolean {
    const nav = this.data()?.navegacion ?? [];
    const currentId = this.data()?.escenario?.pregunta.id;
    const idx = nav.findIndex((i) => i.preguntaId === currentId);
    return idx > 0;
  }

  protected canGoNext(): boolean {
    const nav = this.data()?.navegacion ?? [];
    const currentId = this.data()?.escenario?.pregunta.id;
    const idx = nav.findIndex((i) => i.preguntaId === currentId);
    return idx >= 0 && idx < nav.length - 1;
  }

  protected finalizarManual(): void {
    if (this.completed()) return;
    const ok = window.confirm(
      '¿Finalizar simulación? Después de finalizar no podrás cambiar tus respuestas.',
    );
    if (!ok) return;

    this.sending.set(true);
    this.simulacionService.finalizarSesion(this.sesionId).subscribe({
      next: () => {
        this.sending.set(false);
        this.completed.set(true);
        this.handleVerResultadoClick();
      },
      error: (error) => {
        this.sending.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible finalizar la simulación.'));
      },
    });
  }

  private syncSelectedOptionFromState(res: EscenarioActualResponse): void {
    const selectedId = res.escenario?.pregunta.opcionSeleccionadaId;
    if (!selectedId || !res.escenario) {
      this.selectedOpcion.set(null);
      return;
    }
    const option = res.escenario.pregunta.opciones.find((o) => o.id === selectedId) ?? null;
    this.selectedOpcion.set(option);
  }

  private ensureTimer(): void {
    if (this.timerId) return;
    this.timerId = setInterval(() => {
      const next = this.remainingSeconds() - 1;
      this.remainingSeconds.set(Math.max(next, 0));
      if (next <= 0 && !this.completed()) {
        this.stopTimer();
        this.autoFinishByTimeout();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private autoFinishByTimeout(): void {
    this.simulacionService.finalizarSesion(this.sesionId).subscribe({
      next: () => {
        this.completed.set(true);
        this.errorMessage.set(
          'El tiempo máximo de participación finalizó. Se guardaron tus respuestas registradas.',
        );
        this.handleVerResultadoClick();
      },
      error: () => {
        this.loadEscenarioActual();
      },
    });
  }
}
