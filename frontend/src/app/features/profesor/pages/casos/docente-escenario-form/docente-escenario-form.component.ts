import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import { BACKGROUND_OPTIONS } from '../../../../simulacion/constants/backgrounds.constant';
import { SimulacionDocenteService } from '../../../../simulacion/services/simulacion-docente.service';

@Component({
  selector: 'app-docente-escenario-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertMessageComponent,
    LoadingStateComponent,
    PageHeaderComponent,
  ],
  templateUrl: './docente-escenario-form.component.html',
  styleUrl: './docente-escenario-form.component.scss',
})
export class DocenteEscenarioFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly simulacionService = inject(SimulacionDocenteService);

  protected readonly backgrounds = BACKGROUND_OPTIONS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isEdit = signal(false);

  private casoId = '';
  private escenarioId: string | null = null;

  protected readonly form = this.fb.nonNullable.group({
    orden: [1, [Validators.required, Validators.min(1)]],
    titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    situacionTexto: ['', [Validators.required, Validators.minLength(10)]],
    fondoCodigo: ['aula', [Validators.required]],
    isFinal: [false],
  });

  ngOnInit(): void {
    const path = this.route.snapshot.routeConfig?.path ?? '';
    this.isEdit.set(path.includes('editar'));
    this.casoId =
      this.route.snapshot.paramMap.get('casoId') ??
      this.route.snapshot.queryParamMap.get('casoId') ??
      '';
    this.escenarioId = this.isEdit()
      ? this.route.snapshot.paramMap.get('escenarioId')
      : null;

    if (!this.casoId) {
      void this.router.navigate(['/profesor/casos']);
      return;
    }

    if (this.isEdit() && this.escenarioId) {
      this.cargarEscenario();
    } else {
      this.sugerirOrden();
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
      orden: Number(raw.orden),
      titulo: raw.titulo.trim(),
      situacionTexto: raw.situacionTexto.trim(),
      fondoCodigo: raw.fondoCodigo,
      isFinal: raw.isFinal,
    };

    const request$ =
      this.isEdit() && this.escenarioId
        ? this.simulacionService.actualizarEscenario(this.escenarioId, payload)
        : this.simulacionService.crearEscenario(this.casoId, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/profesor/casos', this.casoId]);
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible guardar el escenario.'),
        );
      },
    });
  }

  volverLink(): string[] {
    return ['/profesor/casos', this.casoId];
  }

  private sugerirOrden() {
    this.simulacionService.listarEscenarios(this.casoId).subscribe({
      next: (escenarios) => {
        const nextOrden =
          escenarios.length === 0
            ? 1
            : Math.max(...escenarios.map((e) => e.orden)) + 1;
        this.form.patchValue({ orden: nextOrden });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private cargarEscenario() {
    this.simulacionService.obtenerPreview(this.casoId).subscribe({
      next: (preview) => {
        const escenario = preview.escenarios.find((e) => e.id === this.escenarioId);
        if (!escenario) {
          this.errorMessage.set('No se encontró el escenario solicitado.');
          this.loading.set(false);
          return;
        }
        this.form.patchValue({
          orden: escenario.orden,
          titulo: escenario.titulo,
          situacionTexto: escenario.situacionTexto,
          fondoCodigo: escenario.fondoCodigo,
          isFinal: escenario.isFinal,
        });
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar el escenario.'),
        );
        this.loading.set(false);
      },
    });
  }
}
