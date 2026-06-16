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
import { AuthService } from '../../../../../core/services/auth.service';
import { Role } from '../../../../../core/models/role.enum';
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
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly deletingCasoId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly casos = signal<CasoDocente[]>([]);

  protected readonly canCreateCases = signal(false);
  protected readonly isAdmin = signal(false);

  ngOnInit(): void {
    const user = this.authService.user();
    this.isAdmin.set(user?.role === Role.ADMIN);
    this.canCreateCases.set(this.authService.canCreateCases());
    this.cargarCasos();
  }

  cargarCasos(clearMessages = true) {
    this.loading.set(true);
    if (clearMessages) {
      this.errorMessage.set(null);
      this.successMessage.set(null);
    }
    if (!this.canCreateCases() && !this.isAdmin()) {
      this.casos.set([]);
      this.loading.set(false);
      return;
    }

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

  irABiblioteca(): void {
    void this.router.navigate(['/profesor/casos/biblioteca']);
  }

  totalPorEstado(estado: CasoDocente['estado']): number {
    return this.casos().filter((caso) => caso.estado === estado).length;
  }

  requiereRevision(caso: CasoDocente): boolean {
    if (caso.estado !== 'draft') {
      return false;
    }

    if (sessionStorage.getItem(`mentora.casoRequiereRevision:${caso.id}`) === '1') {
      return true;
    }

    return (caso.totalEscenarios ?? 0) === 0 || (caso.totalPreguntas ?? 0) === 0;
  }

  eliminarBorrador(caso: CasoDocente): void {
    if (caso.estado !== 'draft' || this.deletingCasoId()) {
      return;
    }

    const confirmed = window.confirm(
      `¿Quieres eliminar el borrador "${caso.titulo}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    this.deletingCasoId.set(caso.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.simulacionService.eliminarBorrador(caso.id).subscribe({
      next: (response) => {
        this.deletingCasoId.set(null);
        this.successMessage.set(response.message || 'Borrador eliminado correctamente.');
        this.cargarCasos(false);
      },
      error: (error) => {
        this.deletingCasoId.set(null);
        this.errorMessage.set(
          getErrorMessage(
            error,
            'No fue posible eliminar el borrador. Verifica que no tenga sesiones, evidencias o asignaciones asociadas.',
          ),
        );
      },
    });
  }

  protected pageTitle(): string {
    return this.isAdmin() ? 'Casos institucionales' : 'Casos de simulación';
  }

  protected pageSubtitle(): string {
    if (this.isAdmin()) {
      return 'Consulta casos creados por docentes y su estado institucional.';
    }
    if (!this.canCreateCases()) {
      return 'Tu perfil está configurado para aplicar casos institucionales publicados.';
    }
    return 'Organiza, edita y publica experiencias psicológicas construidas por escenas.';
  }
}
