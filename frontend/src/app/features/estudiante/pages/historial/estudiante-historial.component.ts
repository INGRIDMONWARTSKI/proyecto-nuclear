import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

export interface CasoHistorialGroup {
  casoId: string;
  casoTitulo: string;
  intentos: HistorialIntento[];
  mejorNota: number;
  ultimaNota: number;
  ultimaFecha: string;
  totalIntentos: number;
}

type FiltroHistorial = 'todos' | 'mejor' | 'recientes';

@Component({
  selector: 'app-estudiante-historial',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
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
  protected readonly filtro = signal<FiltroHistorial>('recientes');
  protected readonly abiertos = signal(new Set<string>());

  protected readonly casosAgrupados = computed<CasoHistorialGroup[]>(() => {
    const map = new Map<string, CasoHistorialGroup>();

    for (const intento of this.intentos()) {
      if (!map.has(intento.casoId)) {
        map.set(intento.casoId, {
          casoId: intento.casoId,
          casoTitulo: intento.casoTitulo,
          intentos: [],
          mejorNota: 0,
          ultimaNota: 0,
          ultimaFecha: intento.fechaInicio,
          totalIntentos: 0,
        });
      }
      const group = map.get(intento.casoId)!;
      group.intentos.push(intento);
      if (intento.puntajeTotal > group.mejorNota) {
        group.mejorNota = intento.puntajeTotal;
      }
    }

    for (const group of map.values()) {
      group.intentos.sort(
        (a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime(),
      );
      group.ultimaNota = group.intentos[0].puntajeTotal;
      group.ultimaFecha = group.intentos[0].fechaInicio;
      group.totalIntentos = group.intentos.length;
    }

    const grupos = Array.from(map.values());

    const f = this.filtro();
    if (f === 'mejor') {
      return [...grupos].sort((a, b) => b.mejorNota - a.mejorNota);
    }
    // 'recientes' y 'todos' — por fecha de último intento, más reciente primero
    return grupos.sort(
      (a, b) => new Date(b.ultimaFecha).getTime() - new Date(a.ultimaFecha).getTime(),
    );
  });

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

  protected setFiltro(f: FiltroHistorial): void {
    this.filtro.set(f);
  }

  protected toggleCaso(casoId: string): void {
    this.abiertos.update((s) => {
      const next = new Set(s);
      if (next.has(casoId)) {
        next.delete(casoId);
      } else {
        next.add(casoId);
      }
      return next;
    });
  }

  protected esAbierto(casoId: string): boolean {
    return this.abiertos().has(casoId);
  }

  estadoLabel(estado: HistorialIntento['estado']): string {
    if (estado === 'completed') return 'Finalizado';
    return estado;
  }

  estadoBadge(estado: HistorialIntento['estado']): SiepStatusBadge {
    if (estado === 'completed') return 'success';
    return 'inactive';
  }

  protected irACasos(): void {
    void this.router.navigate(['/estudiante/casos']);
  }
}
