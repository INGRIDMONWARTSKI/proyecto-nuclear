import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { ResultadoSimulacion } from '../../../simulacion/models/resultado-simulacion.model';
import { SimulacionEstudianteService } from '../../../simulacion/services/simulacion-estudiante.service';

@Component({
  selector: 'app-estudiante-resultado',
  standalone: true,
  imports: [
    RouterLink,
    AlertMessageComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './estudiante-resultado.component.html',
  styleUrl: './estudiante-resultado.component.scss',
})
export class EstudianteResultadoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly simulacionService = inject(SimulacionEstudianteService);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly resultado = signal<ResultadoSimulacion | null>(null);
  private sesionId = '';

  ngOnInit(): void {
    this.sesionId = this.route.snapshot.paramMap.get('sesionId') ?? '';
    if (!this.sesionId) {
      void this.router.navigate(['/estudiante/casos']);
      return;
    }
    this.loadResultado();
  }

  loadResultado() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.simulacionService.getResultado(this.sesionId).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(
            error,
            'El resultado no está disponible todavía o no pudo cargarse.',
          ),
        );
        this.loading.set(false);
      },
    });
  }

  volverCasos(): void {
    void this.router.navigate(['/estudiante/casos']);
  }

}
