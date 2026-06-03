import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { SimulacionEstudianteService } from '../../../simulacion/services/simulacion-estudiante.service';
import { CasoPublicado } from '../../../simulacion/models/caso-publicado.model';
import { getErrorMessage } from '../../../../core/utils/http-error.util';

@Component({
  selector: 'app-estudiante-casos-list',
  standalone: true,
  imports: [
    LoadingStateComponent,
    AlertMessageComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './estudiante-casos-list.component.html',
  styleUrl: './estudiante-casos-list.component.scss',
})
export class EstudianteCasosListComponent implements OnInit {
  private readonly simulacionService = inject(SimulacionEstudianteService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly startingCasoId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly casos = signal<CasoPublicado[]>([]);

  ngOnInit(): void {
    this.loadCasos();
  }

  loadCasos() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.simulacionService.getCasosPublicados().subscribe({
      next: (casos) => {
        this.casos.set(casos);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar las simulaciones disponibles.'),
        );
        this.loading.set(false);
      },
    });
  }

  iniciarSimulacion(casoId: string) {
    this.startingCasoId.set(casoId);
    this.errorMessage.set(null);
    this.simulacionService.startSesion(casoId).subscribe({
      next: (res) => {
        this.startingCasoId.set(null);
        void this.router.navigate(['/estudiante/sesiones', res.sesionId]);
      },
      error: (error) => {
        this.startingCasoId.set(null);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible iniciar la simulacion.'),
        );
      },
    });
  }
}
