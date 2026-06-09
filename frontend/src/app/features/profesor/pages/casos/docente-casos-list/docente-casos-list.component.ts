import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SiepStatusBadge,
  StatusBadgeComponent,
} from '../../../../../shared/ui/status-badge/status-badge.component';
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import { CasoDocente } from '../../../../simulacion/models/docente/caso-docente.model';
import { SimulacionDocenteService } from '../../../../simulacion/services/simulacion-docente.service';

@Component({
  selector: 'app-docente-casos-list',
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
  templateUrl: './docente-casos-list.component.html',
  styleUrl: './docente-casos-list.component.scss',
})
export class DocenteCasosListComponent implements OnInit {
  private readonly simulacionService = inject(SimulacionDocenteService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly casos = signal<CasoDocente[]>([]);

  ngOnInit(): void {
    this.cargarCasos();
  }

  cargarCasos() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.simulacionService.listarCasos().subscribe({
      next: (casos) => {
        this.casos.set(casos);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los casos de simulación.'),
        );
        this.loading.set(false);
      },
    });
  }

  estadoLabel(estado: CasoDocente['estado']): string {
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

  estadoBadge(estado: CasoDocente['estado']): SiepStatusBadge {
    switch (estado) {
      case 'published':
        return 'success';
      case 'archived':
        return 'inactive';
      default:
        return 'pending';
    }
  }

  irANuevoCaso(): void {
    void this.router.navigate(['nuevo'], { relativeTo: this.route });
  }

  totalPorEstado(estado: CasoDocente['estado']): number {
    return this.casos().filter((caso) => caso.estado === estado).length;
  }
}
