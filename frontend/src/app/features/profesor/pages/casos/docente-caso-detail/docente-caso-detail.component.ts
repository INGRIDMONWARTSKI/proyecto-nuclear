import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SiepStatusBadge,
  StatusBadgeComponent,
} from '../../../../../shared/ui/status-badge/status-badge.component';
import { AuthService } from '../../../../../core/services/auth.service';
import { Role } from '../../../../../core/models/role.enum';
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import { CasoDocenteDetalle } from '../../../../simulacion/models/docente/caso-docente.model';
import { CasoPreview, EscenarioPreview } from '../../../../simulacion/models/docente/caso-preview.model';
import { RubricaCriterio } from '../../../../simulacion/models/docente/rubrica-criterio.model';
import { SesionEvidencia } from '../../../../simulacion/models/docente/sesion-evidencia.model';
import { SimulacionDocenteService } from '../../../../simulacion/services/simulacion-docente.service';

@Component({
  selector: 'app-docente-caso-detail',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    AlertMessageComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './docente-caso-detail.component.html',
  styleUrl: './docente-caso-detail.component.scss',
})
export class DocenteCasoDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly simulacionService = inject(SimulacionDocenteService);
  private readonly authService = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly publishing = signal(false);
  protected readonly loadingPreview = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly publishErrors = signal<string[]>([]);
  protected readonly caso = signal<CasoDocenteDetalle | null>(null);
  protected readonly preview = signal<CasoPreview | null>(null);
  protected readonly evidencias = signal<SesionEvidencia[]>([]);
  protected readonly showPreview = signal(false);
  protected readonly showEvidencias = signal(false);
  protected readonly deletingEscenarioId = signal<string | null>(null);
  protected readonly editingRubricaId = signal<string | null>(null);
  protected readonly savingRubrica = signal(false);
  protected readonly actionsDrawerOpen = signal(false);

  protected readonly rubricaForm = this.fb.nonNullable.group({
    criterio: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
    nivelEsperado: ['', [Validators.maxLength(1000)]],
    peso: [null as number | null],
  });

  private casoId = '';

  ngOnInit(): void {
    this.casoId = this.route.snapshot.paramMap.get('casoId') ?? '';
    if (!this.casoId) {
      void this.router.navigate(['/profesor/casos']);
      return;
    }
    this.cargarCaso();
  }

  toggleActionsDrawer(): void {
    this.actionsDrawerOpen.update((v) => !v);
  }

  closeActionsDrawer(): void {
    this.actionsDrawerOpen.set(false);
  }

  cargarCaso() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.publishErrors.set([]);

    this.simulacionService.obtenerCaso(this.casoId).subscribe({
      next: (caso) => {
        this.caso.set(caso);
        this.loading.set(false);
        this.cargarPreviewParaChecklist();
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'No fue posible cargar el caso.'));
        this.loading.set(false);
      },
    });
  }

  cargarPreview() {
    if (this.preview()) {
      this.showPreview.set(true);
      return;
    }

    this.loadingPreview.set(true);
    this.simulacionService.obtenerPreview(this.casoId).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.showPreview.set(true);
        this.loadingPreview.set(false);
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'No fue posible cargar la vista previa.'));
        this.loadingPreview.set(false);
      },
    });
  }

  closePreview(): void {
    this.showPreview.set(false);
  }

  previewMissingItems(): string[] {
    const preview = this.preview();

    if (!preview || preview.escenarios.length === 0) {
      return [
        'Agrega al menos un escenario.',
        'Agrega al menos una pregunta.',
        'Agrega opciones de respuesta.',
        'Agrega retroalimentaciones.',
        'Define notas entre 0.0 y 5.0.',
      ];
    }

    const missing = new Set<string>();
    const preguntas = preview.escenarios.flatMap((esc) => esc.preguntas ?? (esc.pregunta ? [esc.pregunta] : []));

    if (preguntas.length === 0) {
      missing.add('Agrega al menos una pregunta.');
    }

    if ((preview.rubrica ?? []).length === 0) {
      missing.add('Agrega al menos un criterio de rubrica.');
    }

    for (const escenario of preview.escenarios) {
      const preguntasEscenario = escenario.preguntas ?? (escenario.pregunta ? [escenario.pregunta] : []);
      if (preguntasEscenario.length === 0) {
        missing.add('Agrega al menos una pregunta.');
        continue;
      }

      for (const pregunta of preguntasEscenario) {
        if (pregunta.opciones.length === 0) {
          missing.add('Agrega opciones de respuesta.');
        }

        for (const opcion of pregunta.opciones) {
          if (!opcion.retroalimentacion) {
            missing.add('Agrega retroalimentaciones.');
          }
          if (opcion.puntaje < 0 || opcion.puntaje > 5) {
            missing.add('Define notas entre 0.0 y 5.0.');
          }
        }
      }
    }

    return Array.from(missing);
  }

  hasPreviewContent(): boolean {
    return this.previewMissingItems().length === 0;
  }

  requisitosPublicacion(): Array<{ label: string; ok: boolean }> {
    const caso = this.caso();
    const preview = this.preview();
    const escenarios = preview?.escenarios ?? [];
    const totalEscenarios = preview?.escenarios.length ?? caso?.escenarios.length ?? 0;
    const preguntas = escenarios.flatMap((esc) => esc.preguntas ?? (esc.pregunta ? [esc.pregunta] : []));
    const opciones = preguntas.flatMap((pregunta) => pregunta?.opciones ?? []);

    return [
      {
        label: 'Datos básicos del caso completos.',
        ok: Boolean(caso?.titulo?.trim() && caso?.descripcion?.trim() && caso?.objetivoAprendizaje?.trim()),
      },
      {
        label: 'Al menos un escenario creado.',
        ok: totalEscenarios > 0,
      },
      {
        label: 'Cada escenario tiene texto de situación.',
        ok: escenarios.length > 0 && escenarios.every((esc) => Boolean(esc.situacionTexto?.trim())),
      },
      {
        label: 'Cada escenario tiene al menos una pregunta.',
        ok: escenarios.length > 0 && escenarios.every((esc) => (esc.preguntas ?? (esc.pregunta ? [esc.pregunta] : [])).length > 0),
      },
      {
        label: 'Cada pregunta tiene mínimo dos opciones.',
        ok: preguntas.length > 0 && preguntas.every((pregunta) => (pregunta?.opciones.length ?? 0) >= 2),
      },
      {
        label: 'Cada pregunta tiene al menos una opción correcta.',
        ok: preguntas.length > 0 && preguntas.every((pregunta) => pregunta?.opciones.some((op) => op.isCorrecta)),
      },
      {
        label: 'Cada opción tiene nota entre 0.0 y 5.0.',
        ok: opciones.length > 0 && opciones.every((op) => op.puntaje >= 0 && op.puntaje <= 5),
      },
      {
        label: 'Cada opción tiene retroalimentación.',
        ok: opciones.length > 0 && opciones.every((op) => Boolean(op.retroalimentacion)),
      },
      {
        label: 'Escenario final definido o ruta de cierre clara.',
        ok: escenarios.some((esc) => esc.isFinal) || opciones.some((op) => !op.escenarioDestinoId),
      },
      {
        label: 'Rúbrica de calificación con al menos un criterio.',
        ok: (preview?.rubrica?.length ?? 0) > 0,
      },
    ];
  }

  pendientesPublicacionDetallados(): string[] {
    const caso = this.caso();
    const preview = this.preview();
    const escenarios = preview?.escenarios ?? [];
    const pendientes: string[] = [];

    if (!caso?.titulo?.trim() || !caso?.descripcion?.trim() || !caso?.objetivoAprendizaje?.trim()) {
      pendientes.push('Datos basicos del caso: completa titulo, descripcion y objetivo pedagogico.');
    }

    if ((preview?.rubrica?.length ?? 0) === 0) {
      pendientes.push('Caso: agrega al menos un criterio de rubrica para justificar la calificacion final.');
    }

    if (escenarios.length === 0) {
      pendientes.push('Caso: agrega al menos una escena.');
      return pendientes;
    }

    for (const escenario of escenarios) {
      const escenaLabel = this.escenarioChecklistLabel(escenario);
      const preguntas = escenario.preguntas ?? (escenario.pregunta ? [escenario.pregunta] : []);

      if (!escenario.situacionTexto?.trim()) {
        pendientes.push(`${escenaLabel}: agrega texto de situacion.`);
      }

      if (preguntas.length === 0) {
        pendientes.push(`${escenaLabel}: agrega al menos una pregunta.`);
        continue;
      }

      for (const pregunta of preguntas) {
        const preguntaLabel = `${escenaLabel} -> Pregunta ${pregunta.orden}`;
        if (pregunta.opciones.length < 2) {
          pendientes.push(`${preguntaLabel}: agrega minimo dos opciones de respuesta.`);
        }
        if (!pregunta.opciones.some((opcion) => opcion.isCorrecta)) {
          pendientes.push(`${preguntaLabel}: marca al menos una opcion como correcta.`);
        }

        pregunta.opciones.forEach((opcion, index) => {
          const opcionLabel = `${preguntaLabel} -> Opcion ${opcion.orden || index + 1}`;
          if (opcion.puntaje < 0 || opcion.puntaje > 5) {
            pendientes.push(`${opcionLabel}: define una nota entre 0.0 y 5.0.`);
          }
          if (!opcion.retroalimentacion) {
            pendientes.push(`${opcionLabel}: agrega retroalimentacion.`);
          }
        });
      }
    }

    if (!escenarios.some((esc) => esc.isFinal)) {
      const tieneCierrePorRuta = escenarios
        .flatMap((esc) => esc.preguntas ?? (esc.pregunta ? [esc.pregunta] : []))
        .flatMap((pregunta) => pregunta.opciones)
        .some((opcion) => !opcion.escenarioDestinoId);

      if (!tieneCierrePorRuta) {
        pendientes.push('Caso: define un escenario final o una ruta de cierre clara.');
      }
    }

    return pendientes;
  }

  cumpleRequisitosPublicacion(): boolean {
    return this.requisitosPublicacion().every((item) => item.ok);
  }

  cargarEvidencias() {
    this.simulacionService.listarEvidencias(this.casoId).subscribe({
      next: (evidencias) => {
        this.evidencias.set(evidencias);
        this.showEvidencias.set(true);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar las evidencias de sesiones.'),
        );
      },
    });
  }

  publicar() {
    this.publishing.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.publishErrors.set([]);

    this.simulacionService.publicarCaso(this.casoId).subscribe({
      next: () => {
        this.publishing.set(false);
        this.successMessage.set(
          'Caso publicado. Para que los estudiantes puedan verlo, asígnalo a una o más comunidades académicas.',
        );
        this.cargarCaso();
      },
      error: (error) => {
        this.publishing.set(false);
        if (error instanceof HttpErrorResponse && error.status === 422) {
          const body = error.error as { message?: string; errors?: string[] };
          this.errorMessage.set(
            body.message ?? 'El caso no cumple los requisitos para publicarse.',
          );
          this.publishErrors.set(body.errors ?? []);
          return;
        }
        this.errorMessage.set(getErrorMessage(error, 'No fue posible publicar el caso.'));
      },
    });
  }

  estadoLabel(estado: string): string {
    switch (estado) {
      case 'draft':
        return 'Borrador';
      case 'published':
        return 'Publicado';
      case 'archived':
        return 'Archivado';
      default:
        return estado;
    }
  }

  estadoBadge(estado: string): SiepStatusBadge {
    switch (estado) {
      case 'published':
        return 'success';
      case 'archived':
        return 'inactive';
      default:
        return 'pending';
    }
  }

  canEditCase(): boolean {
    const user = this.authService.user();
    const caso = this.caso();
    if (!user || !caso) {
      return false;
    }
    if (user.role === Role.ADMIN) {
      return false;
    }
    return (
      user.role === Role.PROFESOR &&
      this.authService.canCreateCases() &&
      caso.autorDocenteId === user.id
    );
  }

  canEditRubrica(): boolean {
    const user = this.authService.user();
    const caso = this.caso();
    if (!user || !caso) {
      return false;
    }
    if (user.role === Role.ADMIN) {
      return true;
    }
    return (
      user.role === Role.PROFESOR &&
      this.authService.canCreateCases() &&
      caso.autorDocenteId === user.id
    );
  }

  guardarCriterioRubrica(): void {
    const preview = this.preview();
    if (this.rubricaForm.invalid || !preview) {
      this.rubricaForm.markAllAsTouched();
      return;
    }

    const raw = this.rubricaForm.getRawValue();
    const payload = {
      criterio: raw.criterio.trim(),
      descripcion: raw.descripcion.trim(),
      nivelEsperado: raw.nivelEsperado.trim() || undefined,
      peso: raw.peso ?? undefined,
      orden: this.editingRubricaId()
        ? preview.rubrica.find((item) => item.id === this.editingRubricaId())?.orden
        : preview.rubrica.length + 1,
    };

    this.savingRubrica.set(true);
    const request$ = this.editingRubricaId()
      ? this.simulacionService.actualizarCriterioRubrica(this.editingRubricaId()!, payload)
      : this.simulacionService.crearCriterioRubrica(this.casoId, payload);

    request$.subscribe({
      next: () => {
        this.savingRubrica.set(false);
        this.cancelarEdicionRubrica();
        this.cargarPreviewParaChecklist();
      },
      error: (error) => {
        this.savingRubrica.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible guardar el criterio de rubrica.'));
      },
    });
  }

  editarCriterioRubrica(criterio: RubricaCriterio): void {
    this.editingRubricaId.set(criterio.id);
    this.rubricaForm.patchValue({
      criterio: criterio.criterio,
      descripcion: criterio.descripcion,
      nivelEsperado: criterio.nivelEsperado ?? '',
      peso: criterio.peso,
    });
  }

  cancelarEdicionRubrica(): void {
    this.editingRubricaId.set(null);
    this.rubricaForm.reset({
      criterio: '',
      descripcion: '',
      nivelEsperado: '',
      peso: null,
    });
  }

  eliminarCriterioRubrica(criterio: RubricaCriterio): void {
    const confirmed = window.confirm('¿Eliminar este criterio de rubrica?');
    if (!confirmed) {
      return;
    }
    this.savingRubrica.set(true);
    this.simulacionService.eliminarCriterioRubrica(criterio.id).subscribe({
      next: () => {
        this.savingRubrica.set(false);
        this.cargarPreviewParaChecklist();
      },
      error: (error) => {
        this.savingRubrica.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible eliminar el criterio de rubrica.'));
      },
    });
  }

  eliminarEscenario(escenario: { id: string; titulo: string }): void {
    const confirmed = window.confirm(
      '¿Eliminar esta escena? Tambien se eliminaran sus preguntas, opciones y retroalimentaciones asociadas. Esta accion no se puede deshacer.',
    );

    if (!confirmed) {
      return;
    }

    this.deletingEscenarioId.set(escenario.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.simulacionService.eliminarEscenario(this.casoId, escenario.id).subscribe({
      next: () => {
        this.deletingEscenarioId.set(null);
        this.successMessage.set('Escena eliminada correctamente.');
        this.preview.set(null);
        this.cargarCaso();
      },
      error: (error) => {
        this.deletingEscenarioId.set(null);
        this.errorMessage.set(
          getErrorMessage(
            error,
            'No puedes eliminar esta escena porque ya tiene participacion o evidencias asociadas.',
          ),
        );
      },
    });
  }

  private cargarPreviewParaChecklist(): void {
    this.simulacionService.obtenerPreview(this.casoId).subscribe({
      next: (preview) => this.preview.set(preview),
      error: () => undefined,
    });
  }

  private escenarioChecklistLabel(escenario: EscenarioPreview): string {
    return `Escena ${escenario.orden} · ${escenario.titulo}`;
  }
}
