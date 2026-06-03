import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import {
  CasoPreview,
  EscenarioPreview,
  OpcionPreview,
} from '../../../../simulacion/models/docente/caso-preview.model';
import { SimulacionDocenteService } from '../../../../simulacion/services/simulacion-docente.service';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SiepStatusBadge,
  StatusBadgeComponent,
} from '../../../../../shared/ui/status-badge/status-badge.component';

export interface ConexionFlujoCanvas {
  origenOrden: number;
  origenTitulo: string;
  opcionOrden: number;
  opcionTexto: string;
  destinoOrden: number | null;
  destinoTitulo: string;
  tipo: 'explicito' | 'orden' | 'fin';
}

@Component({
  selector: 'app-docente-caso-canvas',
  standalone: true,
  imports: [
    RouterLink,
    AlertMessageComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './docente-caso-canvas.component.html',
  styleUrl: './docente-caso-canvas.component.scss',
})
export class DocenteCasoCanvasComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly simulacionService = inject(SimulacionDocenteService);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly preview = signal<CasoPreview | null>(null);

  protected casoId = '';

  protected readonly escenarios = computed(
    () => this.preview()?.escenarios ?? [],
  );

  protected readonly conexiones = computed(() => {
    const escenarios = this.escenarios();
    const items: ConexionFlujoCanvas[] = [];

    for (const escenario of escenarios) {
      const opciones = escenario.pregunta?.opciones ?? [];

      for (const opcion of opciones) {
        items.push(this.buildConexion(escenario, opcion, escenarios));
      }
    }

    return items;
  });

  ngOnInit(): void {
    this.casoId = this.route.snapshot.paramMap.get('casoId') ?? '';

    if (!this.casoId) {
      this.errorMessage.set('No se encontro el identificador del caso.');
      this.loading.set(false);
      return;
    }

    this.cargarPreview();
  }

  cargarPreview(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.simulacionService.obtenerPreview(this.casoId).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar el flujo del caso.'),
        );
        this.loading.set(false);
      },
    });
  }

  destinoLabel(
    escenario: EscenarioPreview,
    opcion: OpcionPreview,
  ): { texto: string; tipo: 'explicito' | 'orden' | 'fin' } {
    const conexion = this.buildConexion(escenario, opcion, this.escenarios());

    if (conexion.tipo === 'fin') {
      return { texto: 'Fin de la simulacion', tipo: 'fin' };
    }

    if (conexion.tipo === 'explicito') {
      return {
        texto: `${conexion.destinoOrden}. ${conexion.destinoTitulo}`,
        tipo: 'explicito',
      };
    }

    return {
      texto: `Siguiente por orden (${conexion.destinoOrden}. ${conexion.destinoTitulo})`,
      tipo: 'orden',
    };
  }

  escenarioCardId(escenarioId: string): string {
    return `canvas-node-${escenarioId}`;
  }

  pageSubtitle(): string {
    const titulo = this.preview()?.titulo;
    const base =
      'Explora escenarios, decisiones y rutas configuradas para esta simulación.';
    return titulo ? `${titulo} — ${base}` : base;
  }

  destinoBadgeStatus(tipo: ConexionFlujoCanvas['tipo']): SiepStatusBadge {
    switch (tipo) {
      case 'explicito':
        return 'success';
      case 'orden':
        return 'warning';
      default:
        return 'inactive';
    }
  }

  destinoBadgeLabel(tipo: ConexionFlujoCanvas['tipo']): string {
    switch (tipo) {
      case 'explicito':
        return 'Destino explícito';
      case 'orden':
        return 'Siguiente por orden';
      default:
        return 'Fin';
    }
  }

  private buildConexion(
    escenario: EscenarioPreview,
    opcion: OpcionPreview,
    escenarios: EscenarioPreview[],
  ): ConexionFlujoCanvas {
    if (escenario.isFinal) {
      return {
        origenOrden: escenario.orden,
        origenTitulo: escenario.titulo,
        opcionOrden: opcion.orden,
        opcionTexto: opcion.texto,
        destinoOrden: null,
        destinoTitulo: 'Fin de la simulacion',
        tipo: 'fin',
      };
    }

    const destino = this.resolveDestinoVisual(escenario, opcion, escenarios);

    if (!destino) {
      return {
        origenOrden: escenario.orden,
        origenTitulo: escenario.titulo,
        opcionOrden: opcion.orden,
        opcionTexto: opcion.texto,
        destinoOrden: null,
        destinoTitulo: 'Fin de la simulacion',
        tipo: 'fin',
      };
    }

    if (opcion.escenarioDestinoId) {
      return {
        origenOrden: escenario.orden,
        origenTitulo: escenario.titulo,
        opcionOrden: opcion.orden,
        opcionTexto: opcion.texto,
        destinoOrden: destino.orden,
        destinoTitulo: destino.titulo,
        tipo: 'explicito',
      };
    }

    return {
      origenOrden: escenario.orden,
      origenTitulo: escenario.titulo,
      opcionOrden: opcion.orden,
      opcionTexto: opcion.texto,
      destinoOrden: destino.orden,
      destinoTitulo: destino.titulo,
      tipo: 'orden',
    };
  }

  /** Proyeccion visual del destino configurado en preview (escenarioDestinoId u orden). */
  private resolveDestinoVisual(
    escenarioOrigen: EscenarioPreview,
    opcion: OpcionPreview,
    escenarios: EscenarioPreview[],
  ): EscenarioPreview | null {
    if (escenarioOrigen.isFinal) {
      return null;
    }

    if (opcion.escenarioDestinoId) {
      return escenarios.find((item) => item.id === opcion.escenarioDestinoId) ?? null;
    }

    const indice = escenarios.findIndex((item) => item.id === escenarioOrigen.id);

    if (indice === -1 || indice >= escenarios.length - 1) {
      return null;
    }

    return escenarios[indice + 1];
  }
}
