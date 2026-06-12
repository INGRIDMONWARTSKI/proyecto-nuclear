import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Grupo } from '../../../../core/models/grupo.model';
import { getErrorMessage } from '../../../../core/utils/http-error.util';
import { CasoDocente } from '../../../simulacion/models/docente/caso-docente.model';
import { EvidenciaDocente } from '../../../simulacion/models/docente/evidencia-docente.model';
import { SimulacionDocenteService } from '../../../simulacion/services/simulacion-docente.service';
import { GruposService } from '../../services/grupos.service';
import { AlertMessageComponent } from '../../../../shared/ui/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../../shared/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

interface OrientacionMentora {
  titulo: string;
  texto: string;
}

@Component({
  selector: 'app-profesor-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    PageHeaderComponent,
    LoadingStateComponent,
    AlertMessageComponent,
  ],
  templateUrl: './profesor-dashboard.component.html',
  styleUrl: './profesor-dashboard.component.scss',
})
export class ProfesorDashboardComponent implements OnInit {
  private readonly simulacionService = inject(SimulacionDocenteService);
  private readonly gruposService = inject(GruposService);

  private readonly orientaciones: OrientacionMentora[] = [
    {
      titulo: 'Revisa con intención pedagógica',
      texto:
        'Las evidencias muestran decisiones y retroalimentación. Úsalas para orientar el seguimiento, no solo para calificar.',
    },
    {
      titulo: 'Publica antes de asignar',
      texto:
        'Un caso en borrador no puede vincularse a grupos. Revísalo, publícalo y luego asigna la simulación.',
    },
    {
      titulo: 'Acompaña el proceso psicosocial',
      texto:
        'MENTORA favorece la reflexión guiada. Observa cómo avanzan tus estudiantes entre escenarios y decisiones.',
    },
    {
      titulo: 'Organiza por grupos',
      texto:
        'Agrupa estudiantes antes de publicar contenidos. Facilita el seguimiento y la asignación de casos.',
    },
    {
      titulo: 'Retroalimentación oportuna',
      texto:
        'Revisar evidencias recientes ayuda a detectar dificultades y reforzar aprendizajes clave del caso.',
    },
    {
      titulo: 'Diseña casos con claridad',
      texto:
        'Define objetivos de aprendizaje y escenarios coherentes para que la simulación guíe con sentido académico.',
    },
    {
      titulo: 'Cierra el ciclo docente',
      texto:
        'Crear, asignar, acompañar y revisar evidencias completa el acompañamiento del proceso formativo.',
    },
  ];

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly casos = signal<CasoDocente[]>([]);
  protected readonly grupos = signal<Grupo[]>([]);
  protected readonly evidencias = signal<EvidenciaDocente[]>([]);

  protected readonly casosActivos = computed(
    () =>
      this.casos().filter(
        (caso) => caso.isActive && caso.estado !== 'archived',
      ).length,
  );

  protected readonly gruposAsignados = computed(
    () => this.grupos().filter((grupo) => grupo.isActive).length,
  );

  protected readonly evidenciasPendientes = computed(() => this.evidencias().length);

  protected readonly estudiantesSeguimiento = computed(() => {
    const ids = new Set(this.evidencias().map((evidencia) => evidencia.estudianteId));
    return ids.size;
  });

  protected readonly evidenciasRecientes = computed(() =>
    [...this.evidencias()]
      .sort(
        (a, b) =>
          new Date(b.fechaFinalizacion ?? b.fechaInicio).getTime() -
          new Date(a.fechaFinalizacion ?? a.fechaInicio).getTime(),
      )
      .slice(0, 4),
  );

  protected readonly casosPublicadosRecientes = computed(() =>
    [...this.casos()]
      .filter((caso) => caso.estado === 'published')
      .sort(
        (a, b) =>
          new Date(b.publishedAt ?? b.updatedAt).getTime() -
          new Date(a.publishedAt ?? a.updatedAt).getTime(),
      )
      .slice(0, 4),
  );

  protected readonly estudiantesFinalizadosRecientes = computed(() => {
    const vistos = new Set<string>();
    const items: EvidenciaDocente[] = [];

    for (const evidencia of this.evidenciasRecientes()) {
      if (vistos.has(evidencia.estudianteId)) {
        continue;
      }
      vistos.add(evidencia.estudianteId);
      items.push(evidencia);
      if (items.length >= 4) {
        break;
      }
    }

    return items;
  });

  protected readonly orientacionActual = computed(() => {
    const indice = new Date().getDay() % this.orientaciones.length;
    return this.orientaciones[indice];
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      casos: this.simulacionService.listarCasos(),
      grupos: this.gruposService.listar(),
      evidencias: this.simulacionService.listarEvidencias(),
    }).subscribe({
      next: ({ casos, grupos, evidencias }) => {
        this.casos.set(casos);
        this.grupos.set(grupos);
        this.evidencias.set(evidencias);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar el panel del profesor.'),
        );
        this.loading.set(false);
      },
    });
  }
}
