import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { FeedbackPanelComponent, FeedbackView } from '../../../../shared/simulacion/feedback-panel/feedback-panel.component';
import { OpcionesRespuestaComponent } from '../../../../shared/simulacion/opciones-respuesta/opciones-respuesta.component';
import { SimulacionProgressComponent } from '../../../../shared/simulacion/simulacion-progress/simulacion-progress.component';
import {
  AvatarMotion,
  MentoraHotspotConfig,
  MentoraHotspotSelection,
  MentoraSceneComponent,
  getHotspotConfigsForEscenario,
  getHotspotTotalForEscenario,
} from '../../../../shared/simulacion/mentora-scene/mentora-scene.component';
import { EscenarioActualResponse, OpcionEscenario } from '../../../simulacion/models/escenario-actual.model';
import { RespuestaSubmitResponse } from '../../../simulacion/models/respuesta-submit.model';
import { SimulacionEstudianteService } from '../../../simulacion/services/simulacion-estudiante.service';

export type { AvatarMotion };

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
    SimulacionProgressComponent,
    MentoraSceneComponent,
  ],
  templateUrl: './estudiante-simulacion-player.component.html',
  styleUrl: './estudiante-simulacion-player.component.scss',
})
export class EstudianteSimulacionPlayerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly simulacionService = inject(SimulacionEstudianteService);

  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly data = signal<EscenarioActualResponse | null>(null);
  protected readonly selectedOpcion = signal<OpcionEscenario | null>(null);
  protected readonly feedback = signal<FeedbackView | null>(null);
  protected readonly completed = signal(false);
  protected readonly avatarMotion = signal<AvatarMotion>('idle');
  protected readonly selectedHotspot = signal<MentoraHotspotSelection | null>(null);
  protected readonly exploredHotspotIds = signal<ReadonlySet<string>>(new Set());

  private sesionId = '';

  ngOnInit(): void {
    this.sesionId = this.route.snapshot.paramMap.get('sesionId') ?? '';
    if (!this.sesionId) {
      void this.router.navigate(['/estudiante/casos']);
      return;
    }
    this.loadEscenarioActual();
  }

  loadEscenarioActual() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.selectedOpcion.set(null);
    this.feedback.set(null);
    this.avatarMotion.set('idle');
    this.selectedHotspot.set(null);
    this.exploredHotspotIds.set(new Set());

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

  onHotspotSelected(hotspot: MentoraHotspotSelection) {
    this.selectedHotspot.set(hotspot);
    this.exploredHotspotIds.update((current) => {
      const next = new Set(current);
      next.add(hotspot.id);
      return next;
    });
  }

  protected hotspotPistas(): MentoraHotspotConfig[] {
    return getHotspotConfigsForEscenario(this.data()?.escenario ?? null);
  }

  protected isHotspotExplored(id: string): boolean {
    return this.exploredHotspotIds().has(id);
  }

  protected selectHotspotPista(pista: MentoraHotspotConfig) {
    this.onHotspotSelected({
      id: pista.id,
      title: pista.title,
      description: pista.description,
      category: pista.category,
    });
  }

  protected exploredCount(): number {
    return this.exploredHotspotIds().size;
  }

  protected hotspotTotal(): number {
    return getHotspotTotalForEscenario(this.data()?.escenario ?? null);
  }

  protected explorationPedagogyMessage(): string {
    const count = this.exploredCount();
    const total = this.hotspotTotal();

    if (count >= total) {
      return 'Análisis completo. Puedes elegir una intervención con mayor criterio.';
    }

    if (count > 0) {
      return 'Ya identificaste información inicial del caso.';
    }

    return 'Explora la escena antes de tomar una decisión.';
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

  protected consequenceTitle(): string {
    switch (this.avatarMotion()) {
      case 'advance':
        return 'Avance hacia zona segura';
      case 'pause':
        return 'Pausa en reflexión';
      case 'retreat':
        return 'Retroceso hacia zona de alerta';
      default:
        return 'Momento de intervención';
    }
  }

  protected consequenceDetail(): string {
    switch (this.avatarMotion()) {
      case 'advance':
        return 'Tu decisión favorece el recorrido formativo. El practicante avanza con criterio.';
      case 'pause':
        return 'Hay aprendizaje pendiente. Detente, reflexiona y ajusta tu intervención.';
      case 'retreat':
        return 'La intervención elegida aleja del objetivo. Revisa la consecuencia en la reflexión.';
      default:
        return 'Elige una acción para mover al practicante en el recorrido MENTORA.';
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
    const motion = this.resolveAvatarMotion(feedbackView.puntajeObtenido, feedbackView.tipo);
    this.avatarMotion.set(motion);

    if (res.completed) {
      this.completed.set(true);
    }
  }

  private resolveAvatarMotion(
    puntajeObtenido: number | undefined,
    tipo: FeedbackView['tipo'],
  ): AvatarMotion {
    if (puntajeObtenido !== undefined && !Number.isNaN(puntajeObtenido)) {
      if (puntajeObtenido >= 8) {
        return 'advance';
      }

      if (puntajeObtenido >= 4) {
        return 'pause';
      }

      return 'retreat';
    }

    if (tipo === 'correctiva') {
      return 'pause';
    }

    return 'advance';
  }
}
