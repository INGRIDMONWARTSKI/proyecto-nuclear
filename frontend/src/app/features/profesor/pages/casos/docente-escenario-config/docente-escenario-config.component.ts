import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import {
  EscenarioPreview,
  OpcionPreview,
  PreguntaPreview,
} from '../../../../simulacion/models/docente/caso-preview.model';
import { SimulacionDocenteService } from '../../../../simulacion/services/simulacion-docente.service';
import {
  FIN_SIMULACION_DESTINO,
  destinoToSelectValue,
  hasNextScenarioByOrder,
  labelDestinoOpcion,
  selectValueToDestinoPayload,
} from '../../../../simulacion/utils/opcion-destino.util';

@Component({
  selector: 'app-docente-escenario-config',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertMessageComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './docente-escenario-config.component.html',
  styleUrl: './docente-escenario-config.component.scss',
})
export class DocenteEscenarioConfigComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly simulacionService = inject(SimulacionDocenteService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly escenario = signal<EscenarioPreview | null>(null);
  protected readonly preguntas = signal<PreguntaPreview[]>([]);
  protected readonly selectedPreguntaId = signal<string | null>(null);
  protected readonly pregunta = computed(() => {
    const selectedId = this.selectedPreguntaId();
    return this.preguntas().find((pregunta) => pregunta.id === selectedId) ?? this.preguntas()[0] ?? null;
  });
  protected readonly escenariosCaso = signal<EscenarioPreview[]>([]);

  private casoId = '';
  private escenarioId = '';
  private notaEditadaManualmente = false;

  protected readonly preguntaForm = this.fb.nonNullable.group({
    enunciado: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
    puntajeMaximo: [5, [Validators.required, Validators.min(0), Validators.max(5)]],
  });

  protected readonly opcionForm = this.fb.nonNullable.group({
    texto: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(500)]],
    orden: [1, [Validators.required, Validators.min(1)]],
    puntaje: [3, [Validators.required, Validators.min(0), Validators.max(5)]],
    isCorrecta: [false],
    escenarioDestinoId: [''],
  });

  protected readonly retroForm = this.fb.nonNullable.group({
    mensaje: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(1200)]],
    tipo: ['pedagogica' as 'pedagogica' | 'correctiva' | 'refuerzo', [Validators.required]],
    referenciaTeorica: ['', [Validators.maxLength(1000)]],
  });

  protected editingOpcionId = signal<string | null>(null);
  protected editingPreguntaId = signal<string | null>(null);
  protected retroOpcionId = signal<string | null>(null);
  protected respuestasModalOpen = signal(false);
  protected retroModalOpen = signal(false);
  protected readonly finSimulacionDestino = FIN_SIMULACION_DESTINO;

  ngOnInit(): void {
    this.escenarioId = this.route.snapshot.paramMap.get('escenarioId') ?? '';
    this.casoId = this.route.snapshot.queryParamMap.get('casoId') ?? '';

    if (!this.escenarioId || !this.casoId) {
      void this.router.navigate(['/profesor/casos']);
      return;
    }

    this.cargarPreview();
  }

  cargarPreview() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.simulacionService.obtenerPreview(this.casoId).subscribe({
      next: (preview) => {
        const escenario = preview.escenarios.find((e) => e.id === this.escenarioId) ?? null;
        const preguntas = escenario?.preguntas ?? (escenario?.pregunta ? [escenario.pregunta] : []);
        this.escenariosCaso.set(preview.escenarios);
        this.escenario.set(escenario);
        this.preguntas.set(preguntas);
        this.selectedPreguntaId.set(
          this.selectedPreguntaId() && preguntas.some((p) => p.id === this.selectedPreguntaId())
            ? this.selectedPreguntaId()
            : preguntas[0]?.id ?? null,
        );

        const preguntaActual = this.pregunta();
        if (preguntaActual) {
          this.preguntaForm.patchValue({
            enunciado: '',
            puntajeMaximo: 5,
          });
          const nextOrden = preguntaActual.opciones.length + 1;
          this.opcionForm.patchValue({
            orden: nextOrden,
            escenarioDestinoId: this.defaultOpcionDestinoSelectValue(),
          });
        } else {
          this.preguntaForm.patchValue({
            enunciado: '',
            puntajeMaximo: 5,
          });
          this.opcionForm.patchValue({
            orden: 1,
            escenarioDestinoId: this.defaultOpcionDestinoSelectValue(),
          });
        }

        this.opcionForm.updateValueAndValidity();

        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar la configuración del escenario.'),
        );
        this.loading.set(false);
      },
    });
  }

  guardarPregunta() {
    if (this.preguntaForm.invalid) {
      this.preguntaForm.markAllAsTouched();
      if (this.preguntaForm.controls.enunciado.hasError('minlength')) {
        this.errorMessage.set(
          'Escribe una pregunta más completa para orientar la decisión del estudiante.',
        );
      }
      return;
    }

    this.saving.set(true);
    const raw = this.preguntaForm.getRawValue();
    const editingPreguntaId = this.editingPreguntaId();
    const payload = {
        enunciado: raw.enunciado.trim(),
        puntajeMaximo: Number(raw.puntajeMaximo),
        orden: this.preguntas().length + 1,
        tipo: 'single_choice',
      };
    const request$ = editingPreguntaId
      ? this.simulacionService.actualizarPregunta(editingPreguntaId, {
          ...payload,
          orden: this.preguntas().find((p) => p.id === editingPreguntaId)?.orden ?? payload.orden,
        })
      : this.simulacionService.crearPregunta(this.escenarioId, payload);

    request$.subscribe({
        next: () => {
          this.saving.set(false);
          this.editingPreguntaId.set(null);
          this.preguntaForm.reset({
            enunciado: '',
            puntajeMaximo: 5,
          });
          this.cargarPreview();
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(
            getErrorMessage(error, 'No fue posible crear la pregunta.'),
          );
        },
      });
  }

  guardarOpcion() {
    const pregunta = this.pregunta();
    if (!pregunta) {
      this.errorMessage.set('Primero debes crear la pregunta de decisión.');
      return;
    }

    if (this.opcionForm.invalid) {
      this.opcionForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const raw = this.opcionForm.getRawValue();
    const payload = {
      texto: raw.texto.trim(),
      orden: Number(raw.orden),
      puntaje: Number(raw.puntaje),
      isCorrecta: raw.isCorrecta,
      escenarioDestinoId: selectValueToDestinoPayload(raw.escenarioDestinoId),
    };

    const editingId = this.editingOpcionId();
    const request$ = editingId
      ? this.simulacionService.actualizarOpcion(editingId, payload)
      : this.simulacionService.crearOpcion(pregunta.id, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.editingOpcionId.set(null);
        this.opcionForm.reset({
          texto: '',
        orden: (this.pregunta()?.opciones.length || 0) + 1,
          puntaje: 3,
          isCorrecta: false,
          escenarioDestinoId: this.defaultOpcionDestinoSelectValue(),
        });
        this.notaEditadaManualmente = false;
        this.cargarPreview();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible guardar la opción.'));
      },
    });
  }

  editarOpcion(opcion: OpcionPreview) {
    this.retroOpcionId.set(null);
    this.retroModalOpen.set(false);
    this.editingOpcionId.set(opcion.id);
    this.notaEditadaManualmente = true;
    this.opcionForm.patchValue({
      texto: opcion.texto,
      orden: opcion.orden,
      puntaje: this.normalizeNota(opcion.puntaje),
      isCorrecta: opcion.isCorrecta,
      escenarioDestinoId: destinoToSelectValue(
        opcion.escenarioDestinoId,
        this.escenarioId,
        this.escenariosOrdenRef(),
      ),
    });
    this.opcionForm.updateValueAndValidity();
  }

  canUseNextScenarioByOrder(): boolean {
    return hasNextScenarioByOrder(this.escenarioId, this.escenariosOrdenRef());
  }

  defaultOpcionDestinoSelectValue(): string {
    return this.canUseNextScenarioByOrder() ? '' : FIN_SIMULACION_DESTINO;
  }

  destinoBadgeStatus(destinoId: string | null | undefined): 'success' | 'pending' {
    if (destinoId) {
      return 'success';
    }

    return this.canUseNextScenarioByOrder() ? 'pending' : 'success';
  }

  private escenariosOrdenRef() {
    return this.escenariosCaso().map((item) => ({
      id: item.id,
      orden: item.orden,
      titulo: item.titulo,
    }));
  }

  labelEscenarioDestino(destinoId: string | null | undefined): string {
    return labelDestinoOpcion(destinoId, this.escenarioId, this.escenariosOrdenRef());
  }

  eliminarOpcion(opcionId: string) {
    this.saving.set(true);
    this.simulacionService.eliminarOpcion(opcionId).subscribe({
      next: () => {
        this.saving.set(false);
        this.cargarPreview();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible eliminar la opción.'));
      },
    });
  }

  prepararRetro(opcion: OpcionPreview) {
    this.retroOpcionId.set(opcion.id);
    this.retroModalOpen.set(true);
    if (opcion.retroalimentacion) {
      this.retroForm.patchValue({
        mensaje: opcion.retroalimentacion.mensaje,
        tipo: opcion.retroalimentacion.tipo,
        referenciaTeorica: opcion.retroalimentacion.referenciaTeorica ?? '',
      });
    } else {
      this.retroForm.reset({
        mensaje: '',
        tipo: 'pedagogica',
        referenciaTeorica: '',
      });
    }
  }

  guardarRetroalimentacion(opcion: OpcionPreview) {
    if (this.retroForm.invalid) {
      this.retroForm.markAllAsTouched();
      this.errorMessage.set(
        'Agrega una retroalimentacion para orientar el aprendizaje del estudiante.',
      );
      return;
    }

    this.saving.set(true);
    const raw = this.retroForm.getRawValue();
    const payload = {
      mensaje: raw.mensaje.trim(),
      tipo: raw.tipo,
      referenciaTeorica: raw.referenciaTeorica.trim() || undefined,
    };

    const request$ = opcion.retroalimentacion
      ? this.simulacionService.actualizarRetroalimentacion(
          opcion.retroalimentacion.id,
          payload,
        )
      : this.simulacionService.crearRetroalimentacion(opcion.id, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.retroModalOpen.set(false);
        this.retroOpcionId.set(null);
        this.cargarPreview();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible guardar la retroalimentación.'),
        );
      },
    });
  }

  configSubtitle(): string {
    const titulo = this.escenario()?.titulo || 'Escenario';
    return `${titulo} — pregunta, opciones y retroalimentación.`;
  }

  volverLink(): string[] {
    return ['/profesor/casos', this.casoId];
  }

  opcionParaRetro(): OpcionPreview | null {
    const id = this.retroOpcionId();
    if (!id) {
      return null;
    }
    return this.pregunta()?.opciones.find((o) => o.id === id) ?? null;
  }

  puntajeMaximoPregunta(): number | null {
    return 5;
  }

  seleccionarPregunta(preguntaId: string): void {
    this.selectedPreguntaId.set(preguntaId);
    const pregunta = this.pregunta();
    this.editingOpcionId.set(null);
    this.retroOpcionId.set(null);
    this.opcionForm.reset({
      texto: '',
      orden: (pregunta?.opciones.length ?? 0) + 1,
      puntaje: 3,
      isCorrecta: false,
      escenarioDestinoId: this.defaultOpcionDestinoSelectValue(),
    });
    this.notaEditadaManualmente = false;
  }

  abrirRespuestasModal(preguntaId: string): void {
    this.seleccionarPregunta(preguntaId);
    this.respuestasModalOpen.set(true);
  }

  cerrarRespuestasModal(): void {
    this.respuestasModalOpen.set(false);
    this.editingOpcionId.set(null);
    this.retroOpcionId.set(null);
    this.retroModalOpen.set(false);
    this.opcionForm.reset({
      texto: '',
      orden: (this.pregunta()?.opciones.length ?? 0) + 1,
      puntaje: 3,
      isCorrecta: false,
      escenarioDestinoId: this.defaultOpcionDestinoSelectValue(),
    });
    this.notaEditadaManualmente = false;
  }

  cerrarRetroModal(): void {
    this.retroModalOpen.set(false);
    this.retroOpcionId.set(null);
    this.retroForm.reset({
      mensaje: '',
      tipo: 'pedagogica',
      referenciaTeorica: '',
    });
  }

  editarPregunta(pregunta: PreguntaPreview): void {
    this.seleccionarPregunta(pregunta.id);
    this.editingPreguntaId.set(pregunta.id);
    this.preguntaForm.patchValue({
      enunciado: pregunta.enunciado,
      puntajeMaximo: Math.min(5, pregunta.puntajeMaximo),
    });
  }

  eliminarPregunta(pregunta: PreguntaPreview): void {
    const confirmed = window.confirm(
      `¿Quieres eliminar la pregunta ${pregunta.orden}? Esta acción eliminará sus opciones y retroalimentaciones si no tiene respuestas registradas.`,
    );

    if (!confirmed) {
      return;
    }

    this.saving.set(true);
    this.simulacionService.eliminarPregunta(pregunta.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedPreguntaId.set(null);
        this.cargarPreview();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible eliminar la pregunta.'),
        );
      },
    });
  }

  preguntaTieneCorrecta(pregunta: PreguntaPreview): boolean {
    return pregunta.opciones.some((opcion) => opcion.isCorrecta);
  }

  preguntaTieneRetroCompleta(pregunta: PreguntaPreview): boolean {
    return pregunta.opciones.length > 0 && pregunta.opciones.every((opcion) => opcion.retroalimentacion);
  }

  marcarNotaManual(): void {
    this.notaEditadaManualmente = true;
  }

  sugerirNotaPorTipo(isCorrecta: boolean): void {
    if (this.notaEditadaManualmente) {
      return;
    }

    this.opcionForm.controls.puntaje.setValue(isCorrecta ? 5 : 3);
  }

  notaOpcionInvalida(): boolean {
    const control = this.opcionForm.controls.puntaje;
    return control.invalid && (control.touched || control.dirty);
  }

  preguntaEnunciadoCorto(): boolean {
    const control = this.preguntaForm.controls.enunciado;
    return control.touched && control.hasError('minlength');
  }

  formatNota(value: number): string {
    return this.normalizeNota(value).toFixed(1);
  }

  tipoOpcionLabel(opcion: OpcionPreview): string {
    if (opcion.isCorrecta) {
      return 'Correcta';
    }

    return this.normalizeNota(opcion.puntaje) <= 0 ? 'Incorrecta' : 'Alternativa';
  }

  private normalizeNota(value: number): number {
    const numeric = Number(value);
    const nota = numeric > 5 ? numeric / 20 : numeric;
    return Number(Math.min(Math.max(nota, 0), 5).toFixed(1));
  }
}
