import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { EscenarioViewerComponent } from '../../../../shared/simulacion/escenario-viewer/escenario-viewer.component';
import { FeedbackPanelComponent, FeedbackView } from '../../../../shared/simulacion/feedback-panel/feedback-panel.component';
import { OpcionesRespuestaComponent } from '../../../../shared/simulacion/opciones-respuesta/opciones-respuesta.component';
import { SimulacionProgressComponent } from '../../../../shared/simulacion/simulacion-progress/simulacion-progress.component';
import { EscenarioActualResponse, OpcionEscenario } from '../../../simulacion/models/escenario-actual.model';
import { RespuestaSubmitResponse } from '../../../simulacion/models/respuesta-submit.model';
import { SimulacionEstudianteService } from '../../../simulacion/services/simulacion-estudiante.service';

@Component({
  selector: 'app-estudiante-simulacion-player',
  standalone: true,
  imports: [
    RouterLink,
    AlertMessageComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    EscenarioViewerComponent,
    FeedbackPanelComponent,
    OpcionesRespuestaComponent,
    SimulacionProgressComponent,
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

  private handleRespuesta(res: RespuestaSubmitResponse) {
    this.sending.set(false);
    this.feedback.set(
      res.retroalimentacion
        ? {
            ...res.retroalimentacion,
            puntajeObtenido: res.puntajeObtenido,
          }
        : {
            mensaje: 'Respuesta registrada.',
            tipo: 'pedagogica',
            referenciaTeorica: null,
            puntajeObtenido: res.puntajeObtenido,
          },
    );

    if (res.completed) {
      this.completed.set(true);
    }
  }
}
