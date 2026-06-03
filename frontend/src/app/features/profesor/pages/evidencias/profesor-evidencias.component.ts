import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { EvidenciaDocente } from '../../../simulacion/models/docente/evidencia-docente.model';
import { SimulacionDocenteService } from '../../../simulacion/services/simulacion-docente.service';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import {
  SiepStatusBadge,
  StatusBadgeComponent,
} from '../../../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-profesor-evidencias',
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
  templateUrl: './profesor-evidencias.component.html',
  styleUrl: './profesor-evidencias.component.scss',
})
export class ProfesorEvidenciasComponent implements OnInit {
  private readonly simulacionService = inject(SimulacionDocenteService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly evidencias = signal<EvidenciaDocente[]>([]);

  ngOnInit(): void {
    this.loadEvidencias();
  }

  loadEvidencias(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.simulacionService.listarEvidencias().subscribe({
      next: (evidencias) => {
        this.evidencias.set(evidencias);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar las evidencias de intentos.'),
        );
        this.loading.set(false);
      },
    });
  }

  estadoLabel(estado: EvidenciaDocente['estado']): string {
    if (estado === 'completed') {
      return 'Finalizado';
    }
    return estado;
  }

  estadoBadge(estado: EvidenciaDocente['estado']): SiepStatusBadge {
    if (estado === 'completed') {
      return 'success';
    }
    return 'inactive';
  }

  irAAsignaciones(): void {
    void this.router.navigate(['/profesor/asignaciones']);
  }
}
