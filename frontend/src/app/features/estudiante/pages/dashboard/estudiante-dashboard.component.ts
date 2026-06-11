import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SesionActiva } from '../../../simulacion/models/sesion-activa.model';
import { SimulacionEstudianteService } from '../../../simulacion/services/simulacion-estudiante.service';
import { obtenerSesionActivaReciente } from '../../utils/estudiante-sesion-estado.util';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'app-estudiante-dashboard',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent],
  templateUrl: './estudiante-dashboard.component.html',
  styleUrl: './estudiante-dashboard.component.scss',
})
export class EstudianteDashboardComponent implements OnInit {
  private readonly simulacionService = inject(SimulacionEstudianteService);

  protected readonly loadingContinuar = signal(true);

  private readonly sesionesActivas = signal<SesionActiva[]>([]);

  protected readonly sesionActivaReciente = computed(() =>
    obtenerSesionActivaReciente(this.sesionesActivas()),
  );

  protected readonly continuarLink = computed(() => {
    const sesion = this.sesionActivaReciente();
    return sesion ? ['/estudiante/sesiones', sesion.sesionId] : ['/estudiante/casos'];
  });

  protected readonly continuarTitulo = computed(() =>
    this.sesionActivaReciente() ? 'Continuar simulación' : 'Explorar casos',
  );

  protected readonly continuarDesc = computed(() => {
    const sesion = this.sesionActivaReciente();
    if (sesion) {
      return `Retoma "${sesion.casoTitulo}" donde lo dejaste.`;
    }
    return 'No tienes simulaciones en progreso. Elige un caso para comenzar.';
  });

  ngOnInit(): void {
    this.simulacionService.listarSesionesActivas().subscribe({
      next: (sesiones) => {
        this.sesionesActivas.set(sesiones);
        this.loadingContinuar.set(false);
      },
      error: () => {
        this.sesionesActivas.set([]);
        this.loadingContinuar.set(false);
      },
    });
  }
}
