import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { RevisionSesionDocente } from '../../../simulacion/models/docente/revision-sesion-docente.model';
import { SimulacionDocenteService } from '../../../simulacion/services/simulacion-docente.service';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-revision-docente',
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
  templateUrl: './revision-docente.component.html',
  styleUrl: './revision-docente.component.scss',
})
export class RevisionDocenteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly simulacionService = inject(SimulacionDocenteService);

  protected readonly loading = signal(true);
  protected readonly authorizing = signal(false);
  protected readonly savingFeedback = signal(false);
  protected readonly downloadingReport = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly revision = signal<RevisionSesionDocente | null>(null);
  protected readonly feedbackForm = this.fb.nonNullable.group({
    mensaje: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(2000)]],
  });

  private sesionId = '';

  ngOnInit(): void {
    this.sesionId = this.route.snapshot.paramMap.get('sesionId') ?? '';

    if (!this.sesionId) {
      void this.router.navigate(['/profesor/evidencias']);
      return;
    }

    this.loadRevision();
  }

  loadRevision(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.simulacionService.obtenerRevisionSesion(this.sesionId).subscribe({
      next: (revision) => {
        this.revision.set(revision);
        this.feedbackForm.patchValue({
          mensaje: revision.retroalimentacionDocenteGeneral ?? '',
        });
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(
            error,
            'No tienes permisos para revisar este intento o no está disponible.',
          ),
        );
        this.loading.set(false);
      },
    });
  }

  volverEvidencias(): void {
    void this.router.navigate(['/profesor/evidencias']);
  }

  autorizarNuevoIntento(): void {
    const revision = this.revision();

    if (!revision || this.authorizing()) {
      return;
    }

    const confirmado = window.confirm(
      '¿Quieres autorizar un nuevo intento para este estudiante? Esta autorización permitirá iniciar una nueva sesión del caso.',
    );

    if (!confirmado) {
      return;
    }

    this.authorizing.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.simulacionService
      .autorizarReintento(revision.caso.id, revision.estudiante.id)
      .subscribe({
        next: (response) => {
          this.successMessage.set(response.message || 'Nuevo intento autorizado.');
          this.authorizing.set(false);
        },
        error: (error) => {
          this.errorMessage.set(
            getErrorMessage(error, 'No fue posible autorizar el nuevo intento.'),
          );
          this.authorizing.set(false);
        },
      });
  }

  guardarRetroalimentacionGeneral(): void {
    if (this.feedbackForm.invalid || this.savingFeedback()) {
      this.feedbackForm.markAllAsTouched();
      return;
    }

    this.savingFeedback.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.simulacionService
      .guardarRetroalimentacionGeneral(
        this.sesionId,
        this.feedbackForm.getRawValue().mensaje,
      )
      .subscribe({
        next: (revision) => {
          this.revision.set(revision);
          this.feedbackForm.patchValue({
            mensaje: revision.retroalimentacionDocenteGeneral ?? '',
          });
          this.successMessage.set('Retroalimentacion general guardada.');
          this.savingFeedback.set(false);
        },
        error: (error) => {
          this.errorMessage.set(
            getErrorMessage(error, 'No fue posible guardar la retroalimentacion general.'),
          );
          this.savingFeedback.set(false);
        },
      });
  }

  descargarReporte(): void {
    if (this.downloadingReport()) {
      return;
    }

    this.downloadingReport.set(true);
    this.simulacionService.descargarReporteSesion(this.sesionId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `reporte-participacion-${this.sesionId}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
        this.downloadingReport.set(false);
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'No fue posible descargar el reporte.'));
        this.downloadingReport.set(false);
      },
    });
  }
}
