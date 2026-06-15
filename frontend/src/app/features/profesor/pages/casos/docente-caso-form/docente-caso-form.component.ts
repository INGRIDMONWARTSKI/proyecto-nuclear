import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import { SimulacionDocenteService } from '../../../../simulacion/services/simulacion-docente.service';

@Component({
  selector: 'app-docente-caso-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertMessageComponent,
    LoadingStateComponent,
    PageHeaderComponent,
  ],
  templateUrl: './docente-caso-form.component.html',
  styleUrl: './docente-caso-form.component.scss',
})
export class DocenteCasoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly simulacionService = inject(SimulacionDocenteService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isEdit = signal(false);
  private casoId: string | null = null;

  protected readonly form = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    descripcion: ['', [Validators.maxLength(1000)]],
    objetivoAprendizaje: ['', [Validators.maxLength(1000)]],
    tiempoMaximoMinutos: [60, [Validators.required, Validators.min(5), Validators.max(240)]],
  });

  ngOnInit(): void {
    const path = this.route.snapshot.routeConfig?.path ?? '';
    this.isEdit.set(path.includes('editar'));
    this.casoId = this.isEdit() ? this.route.snapshot.paramMap.get('casoId') : null;

    if (this.casoId) {
      this.cargarCaso(this.casoId);
    } else {
      this.loading.set(false);
    }
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      titulo: raw.titulo.trim(),
      descripcion: raw.descripcion.trim() || undefined,
      objetivoAprendizaje: raw.objetivoAprendizaje.trim() || undefined,
      tiempoMaximoMinutos: raw.tiempoMaximoMinutos,
    };

    const request$ = this.isEdit() && this.casoId
      ? this.simulacionService.actualizarCaso(this.casoId, payload)
      : this.simulacionService.crearCaso(payload);

    request$.subscribe({
      next: (caso) => {
        this.saving.set(false);
        void this.router.navigate(['/profesor/casos', caso.id]);
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible guardar el caso.'),
        );
      },
    });
  }

  private cargarCaso(casoId: string) {
    this.simulacionService.obtenerCaso(casoId).subscribe({
      next: (caso) => {
        this.form.patchValue({
          titulo: caso.titulo,
          descripcion: caso.descripcion ?? '',
          objetivoAprendizaje: caso.objetivoAprendizaje ?? '',
          tiempoMaximoMinutos: caso.tiempoMaximoMinutos ?? 60,
        });
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar el caso.'),
        );
        this.loading.set(false);
      },
    });
  }
}
