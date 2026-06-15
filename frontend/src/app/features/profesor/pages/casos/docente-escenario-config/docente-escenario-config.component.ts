import { Component, OnInit, inject, signal } from '@angular/core';
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
  protected readonly pregunta = signal<PreguntaPreview | null>(null);
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
  protected retroOpcionId = signal<string | null>(null);

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
        this.escenariosCaso.set(preview.escenarios);
        this.escenario.set(escenario);
        this.pregunta.set(escenario?.pregunta ?? null);

        if (escenario?.pregunta) {
          this.preguntaForm.patchValue({
            enunciado: escenario.pregunta.enunciado,
            puntajeMaximo: Math.min(5, escenario.pregunta.puntajeMaximo),
          });
          const nextOrden = escenario.pregunta.opciones.length + 1;
          this.opcionForm.patchValue({ orden: nextOrden });
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
      return;
    }

    if (this.pregunta()) {
      this.errorMessage.set(
        'La pregunta ya existe. En esta fase solo se permite una pregunta por escenario.',
      );
      return;
    }

    this.saving.set(true);
    const raw = this.preguntaForm.getRawValue();
    this.simulacionService
      .crearPregunta(this.escenarioId, {
        enunciado: raw.enunciado.trim(),
        puntajeMaximo: Number(raw.puntajeMaximo),
        tipo: 'single_choice',
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
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
      escenarioDestinoId: raw.escenarioDestinoId || null,
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
          orden: (pregunta.opciones.length || 0) + 1,
          puntaje: 3,
          isCorrecta: false,
          escenarioDestinoId: '',
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
    this.editingOpcionId.set(opcion.id);
    this.notaEditadaManualmente = true;
    this.opcionForm.patchValue({
      texto: opcion.texto,
      orden: opcion.orden,
      puntaje: this.normalizeNota(opcion.puntaje),
      isCorrecta: opcion.isCorrecta,
      escenarioDestinoId: opcion.escenarioDestinoId ?? '',
    });
    this.opcionForm.updateValueAndValidity();
  }

  labelEscenarioDestino(destinoId: string | null | undefined): string {
    if (!destinoId) {
      return 'Siguiente por orden (default)';
    }

    const escenario = this.escenariosCaso().find((item) => item.id === destinoId);
    return escenario
      ? `${escenario.orden}. ${escenario.titulo}`
      : 'Escenario destino';
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
