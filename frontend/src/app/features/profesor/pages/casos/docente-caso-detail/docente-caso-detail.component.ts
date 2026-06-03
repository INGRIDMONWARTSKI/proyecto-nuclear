import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import { CasoDocenteDetalle } from '../../../../simulacion/models/docente/caso-docente.model';
import { CasoPreview } from '../../../../simulacion/models/docente/caso-preview.model';
import { SesionEvidencia } from '../../../../simulacion/models/docente/sesion-evidencia.model';
import { SimulacionDocenteService } from '../../../../simulacion/services/simulacion-docente.service';

@Component({
  selector: 'app-docente-caso-detail',
  standalone: true,
  imports: [
    RouterLink,
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
  private readonly simulacionService = inject(SimulacionDocenteService);

  protected readonly loading = signal(true);
  protected readonly publishing = signal(false);
  protected readonly loadingPreview = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly publishErrors = signal<string[]>([]);
  protected readonly caso = signal<CasoDocenteDetalle | null>(null);
  protected readonly preview = signal<CasoPreview | null>(null);
  protected readonly evidencias = signal<SesionEvidencia[]>([]);
  protected readonly showPreview = signal(false);
  protected readonly showEvidencias = signal(false);

  private casoId = '';

  ngOnInit(): void {
    this.casoId = this.route.snapshot.paramMap.get('casoId') ?? '';
    if (!this.casoId) {
      void this.router.navigate(['/profesor/casos']);
      return;
    }
    this.cargarCaso();
  }

  cargarCaso() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.publishErrors.set([]);

    this.simulacionService.obtenerCaso(this.casoId).subscribe({
      next: (caso) => {
        this.caso.set(caso);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'No fue posible cargar el caso.'));
        this.loading.set(false);
      },
    });
  }

  cargarPreview() {
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
    this.publishErrors.set([]);

    this.simulacionService.publicarCaso(this.casoId).subscribe({
      next: () => {
        this.publishing.set(false);
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
}
