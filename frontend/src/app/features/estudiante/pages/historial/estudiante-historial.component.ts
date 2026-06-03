import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { HistorialIntento } from '../../../simulacion/models/historial-intento.model';
import { SimulacionEstudianteService } from '../../../simulacion/services/simulacion-estudiante.service';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import {
  SiepStatusBadge,
  StatusBadgeComponent,
} from '../../../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-estudiante-historial',
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
  templateUrl: './estudiante-historial.component.html',
  styleUrl: './estudiante-historial.component.scss',
})
export class EstudianteHistorialComponent implements OnInit {
  private readonly simulacionService = inject(SimulacionEstudianteService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly intentos = signal<HistorialIntento[]>([]);

  ngOnInit(): void {
    this.loadHistorial();
  }

  loadHistorial(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.simulacionService.listarHistorial().subscribe({
      next: (intentos) => {
        this.intentos.set(intentos);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar tu historial de intentos.'),
        );
        this.loading.set(false);
      },
    });
  }

  estadoLabel(estado: HistorialIntento['estado']): string {
    if (estado === 'completed') {
      return 'Finalizado';
    }
    return estado;
  }

  estadoBadge(estado: HistorialIntento['estado']): SiepStatusBadge {
    if (estado === 'completed') {
      return 'success';
    }
    return 'inactive';
  }

  irACasos(): void {
    void this.router.navigate(['/estudiante/casos']);
  }
}
