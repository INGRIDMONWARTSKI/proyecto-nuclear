import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { getErrorBody, getErrorMessage } from '../../../../../core/utils/http-error.util';
import { CasoDocente } from '../../../../simulacion/models/docente/caso-docente.model';
import { SimulacionDocenteService } from '../../../../simulacion/services/simulacion-docente.service';

@Component({
  selector: 'app-docente-caso-ia-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertMessageComponent,
    LoadingStateComponent,
    PageHeaderComponent,
  ],
  templateUrl: './docente-caso-ia-form.component.html',
  styleUrl: './docente-caso-ia-form.component.scss',
})
export class DocenteCasoIaFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly simulacionService = inject(SimulacionDocenteService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly casosDisponibles = signal<CasoDocente[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    referenciasTexto: ['', [Validators.maxLength(25000)]],
    instruccion: ['', [Validators.maxLength(2000)]],
    cantidadEscenarios: [3, [Validators.min(1), Validators.max(5)]],
    casosReferenciaIds: this.fb.array([] as string[]),
  });

  get casosReferenciaIds(): FormArray {
    return this.form.controls.casosReferenciaIds;
  }

  ngOnInit(): void {
    this.cargarCasos();
  }

  toggleCaso(casoId: string, checked: boolean): void {
    const values = this.casosReferenciaIds.getRawValue() as string[];
    const exists = values.includes(casoId);

    if (checked && !exists) {
      this.casosReferenciaIds.push(this.fb.control(casoId, { nonNullable: true }));
      return;
    }

    if (!checked && exists) {
      const index = values.findIndex((value) => value === casoId);
      this.casosReferenciaIds.removeAt(index);
    }
  }

  isSelected(casoId: string): boolean {
    return (this.casosReferenciaIds.getRawValue() as string[]).includes(casoId);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const casosReferenciaTexto = raw.referenciasTexto
      .split(/\r?\n\s*\r?\n/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (casosReferenciaTexto.length === 0 && raw.casosReferenciaIds.length === 0) {
      this.errorMessage.set(
        'Debes ingresar al menos una referencia en texto o seleccionar un caso existente.',
      );
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    this.simulacionService
      .generarCasoConIa({
        instruccion: raw.instruccion.trim() || undefined,
        cantidadEscenarios: raw.cantidadEscenarios,
        casosReferenciaTexto,
        casosReferenciaIds: raw.casosReferenciaIds.filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        ),
      })
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          void this.router.navigate(['/profesor/casos', response.casoId]);
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(this.getIaGenerationErrorMessage(error));
        },
      });
  }

  private cargarCasos(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.simulacionService.listarCasos().subscribe({
      next: (casos) => {
        this.casosDisponibles.set(casos);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los casos disponibles.'),
        );
        this.loading.set(false);
      },
    });
  }

  private getIaGenerationErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = getErrorBody(error);
      const code = body?.code;

      switch (code) {
        case 'IA_NOT_CONFIGURED':
          return 'La generación con IA no está configurada todavía.';
        case 'IA_RATE_LIMIT':
        case 'IA_QUOTA_EXCEEDED':
          return 'El servicio de IA alcanzó su límite temporal. Intenta más tarde.';
        case 'IA_PROMPT_INSUFFICIENT':
          return 'Agrega más contexto para generar un caso completo.';
        case 'IA_SERVICE_TEMPORARILY_UNAVAILABLE':
          return 'El servicio de IA está temporalmente saturado. Intenta de nuevo en unos minutos.';
        case 'IA_CONNECTION_ERROR':
          return 'No se pudo conectar con el servicio de IA. Verifica la conexión e intenta de nuevo.';
        case 'IA_DRAFT_INVALID':
          return typeof body?.message === 'string'
            ? body.message
            : 'La IA generó un borrador inválido y no se guardó. Intenta nuevamente con referencias más específicas.';
      }

      if (error.status === 422) {
        return typeof body?.message === 'string'
          ? body.message
          : 'La IA generó un borrador inválido y no se guardó. Intenta nuevamente con referencias más específicas.';
      }

      if (error.status === 400 && typeof body?.message === 'string') {
        return body.message;
      }
    }

    return getErrorMessage(error, 'No se pudo generar el caso en este momento.');
  }
}
