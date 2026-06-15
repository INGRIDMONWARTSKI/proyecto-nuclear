import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ALLOWED_BACKGROUND_CODES } from './constants/backgrounds.constant';
import { CasoPreviewBuilderService } from './caso-preview-builder.service';
import { CasosService } from './casos.service';
import { normalizeLayout } from './editor-layout.util';
import { Caso, CasoRecord } from './entities/caso.entity';
import { EscenarioRecord } from './entities/escenario.entity';
import { OpcionRespuestaRecord } from './entities/opcion-respuesta.entity';
import { PreguntaDecisionRecord } from './entities/pregunta-decision.entity';
import { RetroalimentacionRecord } from './entities/retroalimentacion.entity';

@Injectable()
export class PublicacionService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
    private readonly previewBuilder: CasoPreviewBuilderService,
    private readonly notificacionesService: NotificacionesService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async preview(casoId: string, currentUser: AuthenticatedUser) {
    this.assertDocenteRole(currentUser);
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);
    return this.previewBuilder.build(caso);
  }

  async publish(casoId: string, currentUser: AuthenticatedUser) {
    this.assertDocenteRole(currentUser);
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    if (caso.estado === 'published') {
      throw new ConflictException('El caso ya se encuentra publicado.');
    }

    if (caso.estado === 'archived') {
      throw new ConflictException('No se puede publicar un caso archivado.');
    }

    if (caso.estado !== 'draft') {
      throw new ConflictException('Solo se pueden publicar casos en estado draft.');
    }

    const errors = await this.validateCaseCompleteness(caso);

    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: 'El caso no cumple los requisitos minimos para publicarse.',
        errors,
      });
    }

    const [updated] = await this.postgrest.update<CasoRecord>(
      'casos',
      {
        estado: 'published',
        published_at: new Date().toISOString(),
      },
      {
        filters: { id: casoId },
        select: '*',
      },
    );

    const publicado = this.toCaso(updated);

    if (currentUser.role === Role.PROFESOR) {
      const profesor = await this.usuariosService.findById(currentUser.sub);
      await this.notificacionesService.crearParaAdmins({
        tipo: 'CASO_PUBLICADO',
        titulo: 'Caso publicado',
        mensaje: `El docente ${profesor.fullName} publicó el caso ${publicado.titulo}.`,
        entidad_tipo: 'CASO',
        entidad_id: publicado.id,
      });
    }

    return publicado;
  }

  async validateCaseCompletenessById(casoId: string): Promise<string[]> {
    const caso = await this.casosService.findCasoById(casoId);
    return this.validateCaseCompleteness(caso);
  }

  private async validateCaseCompleteness(caso: CasoRecord): Promise<string[]> {
    const errors: string[] = [];

    if (!caso.titulo || caso.titulo.trim().length < 3) {
      errors.push('El caso debe tener un titulo valido.');
    }

    const escenarios = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: caso.id },
      order: 'orden.asc',
    });

    if (escenarios.length === 0) {
      errors.push('El caso debe tener minimo un escenario.');
      return errors;
    }

    const escenarioById = new Map(escenarios.map((escenario) => [escenario.id, escenario]));
    const preguntas = await this.postgrest.select<PreguntaDecisionRecord>(
      'preguntas_decision',
      {
        filters: { escenario_id: escenarios.map((escenario) => escenario.id) },
      },
    );
    const preguntasByEscenarioId = new Map(
      preguntas.map((pregunta) => [pregunta.escenario_id, pregunta]),
    );

    let opciones: OpcionRespuestaRecord[] = [];

    if (preguntas.length > 0) {
      opciones = await this.postgrest.select<OpcionRespuestaRecord>(
        'opciones_respuesta',
        {
          filters: { pregunta_id: preguntas.map((pregunta) => pregunta.id) },
          order: 'orden.asc',
        },
      );
    }

    const opcionesByPreguntaId = new Map<string, OpcionRespuestaRecord[]>();

    for (const opcion of opciones) {
      const actuales = opcionesByPreguntaId.get(opcion.pregunta_id) ?? [];
      actuales.push(opcion);
      opcionesByPreguntaId.set(opcion.pregunta_id, actuales);
    }

    for (const escenario of escenarios) {
      if (
        !ALLOWED_BACKGROUND_CODES.includes(
          escenario.fondo_codigo as (typeof ALLOWED_BACKGROUND_CODES)[number],
        )
      ) {
        errors.push(
          `El escenario ${escenario.orden} tiene un fondoCodigo invalido.`,
        );
      }

      if (!escenario.situacion_texto || escenario.situacion_texto.trim().length < 10) {
        errors.push(
          `El escenario ${escenario.orden} debe tener situacionTexto valido.`,
        );
      }

      const layout = normalizeLayout(escenario.layout_data, escenario);
      const hasBackground = layout.elements.some((item) => item.type === 'background');
      if (!hasBackground) {
        errors.push(`El escenario ${escenario.orden} debe incluir un fondo en el layout.`);
      }

      const charactersWithoutDialog = layout.elements.filter((item) => {
        if (item.type !== 'character') {
          return false;
        }

        const dialogo = item.content['dialogo'];
        return typeof dialogo !== 'string' || dialogo.trim().length === 0;
      });

      if (charactersWithoutDialog.length > 0) {
        errors.push(
          `El escenario ${escenario.orden} tiene personajes sin dialogo asociado.`,
        );
      }

      const pregunta = preguntasByEscenarioId.get(escenario.id);
      const escenarioPreguntas = preguntas.filter(
        (item) => item.escenario_id === escenario.id,
      );

      if (escenario.is_final) {
        if (escenarioPreguntas.length > 1) {
          errors.push(
            `El escenario final ${escenario.orden} no debe tener mas de una pregunta.`,
          );
        }
        continue;
      }

      if (escenarioPreguntas.length !== 1) {
        errors.push(
          `El escenario ${escenario.orden} debe tener exactamente una pregunta.`,
        );
        continue;
      }

      const opcionesEscenario = opcionesByPreguntaId.get(pregunta!.id) ?? [];

      if (opcionesEscenario.length < 2) {
        errors.push(
          `La pregunta del escenario ${escenario.orden} debe tener minimo 2 opciones.`,
        );
      }

      for (const opcion of opcionesEscenario) {
        const [retro] = await this.postgrest.select<RetroalimentacionRecord>(
          'retroalimentaciones',
          {
            filters: { opcion_id: opcion.id },
            limit: 1,
          },
        );

        if (!retro) {
          errors.push(
            `La opcion ${opcion.orden} del escenario ${escenario.orden} no tiene retroalimentacion.`,
          );
        }

        if (opcion.escenario_destino_id) {
          const destino = escenarioById.get(opcion.escenario_destino_id);

          if (!destino || destino.caso_id !== caso.id) {
            errors.push(
              `La opcion ${opcion.orden} del escenario ${escenario.orden} apunta a un escenario que no pertenece al caso.`,
            );
          }
        }
      }
    }

    const escenarioInicial = escenarios[0];
    const preguntaInicial = preguntasByEscenarioId.get(escenarioInicial.id);
    const opcionesIniciales = preguntaInicial
      ? (opcionesByPreguntaId.get(preguntaInicial.id) ?? [])
      : [];

    if (!preguntaInicial || opcionesIniciales.length < 2) {
      errors.push(
        'El escenario inicial debe tener pregunta y al menos dos opciones.',
      );
    }

    if (errors.length > 0) {
      return errors;
    }

    errors.push(
      ...this.validateCaseFlow(
        caso.id,
        escenarios,
        preguntasByEscenarioId,
        opcionesByPreguntaId,
      ),
    );

    return errors;
  }

  private validateCaseFlow(
    casoId: string,
    escenarios: EscenarioRecord[],
    preguntasByEscenarioId: Map<string, PreguntaDecisionRecord>,
    opcionesByPreguntaId: Map<string, OpcionRespuestaRecord[]>,
  ): string[] {
    const errors: string[] = [];
    const escenarioById = new Map(escenarios.map((escenario) => [escenario.id, escenario]));
    const escenarioInicial = escenarios[0];
    const canReachTerminalMemo = new Map<string, boolean>();
    const visiting = new Set<string>();

    const canReachTerminal = (escenarioId: string): boolean => {
      const cached = canReachTerminalMemo.get(escenarioId);

      if (cached !== undefined) {
        return cached;
      }

      if (visiting.has(escenarioId)) {
        return false;
      }

      const escenario = escenarioById.get(escenarioId);

      if (!escenario) {
        canReachTerminalMemo.set(escenarioId, false);
        return false;
      }

      if (escenario.is_final) {
        canReachTerminalMemo.set(escenarioId, true);
        return true;
      }

      const pregunta = preguntasByEscenarioId.get(escenarioId);
      const opciones = pregunta
        ? (opcionesByPreguntaId.get(pregunta.id) ?? [])
        : [];

      if (opciones.length === 0) {
        canReachTerminalMemo.set(escenarioId, false);
        return false;
      }

      visiting.add(escenarioId);

      let puedeFinalizar = false;

      for (const opcion of opciones) {
        const siguiente = this.resolveNextEscenarioForFlow(
          casoId,
          escenario,
          opcion,
          escenarios,
          escenarioById,
        );

        if (!siguiente) {
          puedeFinalizar = true;
          continue;
        }

        if (canReachTerminal(siguiente.id)) {
          puedeFinalizar = true;
        }
      }

      visiting.delete(escenarioId);
      canReachTerminalMemo.set(escenarioId, puedeFinalizar);
      return puedeFinalizar;
    };

    const alcanzables = this.collectReachableEscenarios(
      escenarioInicial.id,
      escenarios,
      preguntasByEscenarioId,
      opcionesByPreguntaId,
      casoId,
      escenarioById,
    );

    for (const escenario of escenarios) {
      if (!alcanzables.has(escenario.id)) {
        errors.push(
          `El escenario ${escenario.orden} (${escenario.titulo}) no es alcanzable desde el inicio.`,
        );
      }
    }

    for (const escenarioId of alcanzables) {
      canReachTerminal(escenarioId);
    }

    if (!canReachTerminal(escenarioInicial.id)) {
      errors.push('El flujo del caso no tiene una ruta de finalizacion.');
    }

    const cicloSinSalida = this.hasCycleWithoutTerminalExit(
      escenarios,
      preguntasByEscenarioId,
      opcionesByPreguntaId,
      casoId,
      escenarioById,
      canReachTerminalMemo,
      alcanzables,
    );

    if (cicloSinSalida) {
      errors.push(
        'Se detecto un ciclo sin salida hacia un escenario final.',
      );
    } else {
      for (const escenario of escenarios) {
        if (!alcanzables.has(escenario.id)) {
          continue;
        }

        if (canReachTerminalMemo.get(escenario.id) === false) {
          errors.push(
            `El escenario ${escenario.orden} (${escenario.titulo}) no conduce a una finalizacion valida.`,
          );
        }
      }
    }

    return errors;
  }

  private resolveNextEscenarioForFlow(
    casoId: string,
    escenarioActual: EscenarioRecord,
    opcion: OpcionRespuestaRecord,
    escenarios: EscenarioRecord[],
    escenarioById: Map<string, EscenarioRecord>,
  ): EscenarioRecord | null {
    if (escenarioActual.is_final) {
      return null;
    }

    if (opcion.escenario_destino_id) {
      const destino = escenarioById.get(opcion.escenario_destino_id);

      if (!destino || destino.caso_id !== casoId) {
        return null;
      }

      return destino;
    }

    const indiceActual = escenarios.findIndex(
      (escenario) => escenario.id === escenarioActual.id,
    );

    if (indiceActual === -1 || indiceActual >= escenarios.length - 1) {
      return null;
    }

    return escenarios[indiceActual + 1];
  }

  private collectReachableEscenarios(
    escenarioInicialId: string,
    escenarios: EscenarioRecord[],
    preguntasByEscenarioId: Map<string, PreguntaDecisionRecord>,
    opcionesByPreguntaId: Map<string, OpcionRespuestaRecord[]>,
    casoId: string,
    escenarioById: Map<string, EscenarioRecord>,
  ): Set<string> {
    const alcanzables = new Set<string>();
    const pendientes = [escenarioInicialId];

    while (pendientes.length > 0) {
      const escenarioId = pendientes.pop()!;

      if (alcanzables.has(escenarioId)) {
        continue;
      }

      alcanzables.add(escenarioId);

      const escenario = escenarioById.get(escenarioId);

      if (!escenario || escenario.is_final) {
        continue;
      }

      const pregunta = preguntasByEscenarioId.get(escenarioId);
      const opciones = pregunta
        ? (opcionesByPreguntaId.get(pregunta.id) ?? [])
        : [];

      for (const opcion of opciones) {
        const siguiente = this.resolveNextEscenarioForFlow(
          casoId,
          escenario,
          opcion,
          escenarios,
          escenarioById,
        );

        if (siguiente && !alcanzables.has(siguiente.id)) {
          pendientes.push(siguiente.id);
        }
      }
    }

    return alcanzables;
  }

  private hasCycleWithoutTerminalExit(
    escenarios: EscenarioRecord[],
    preguntasByEscenarioId: Map<string, PreguntaDecisionRecord>,
    opcionesByPreguntaId: Map<string, OpcionRespuestaRecord[]>,
    casoId: string,
    escenarioById: Map<string, EscenarioRecord>,
    canReachTerminalMemo: Map<string, boolean>,
    alcanzables: Set<string>,
  ): boolean {
    const visitados = new Set<string>();
    const pila = new Set<string>();

    const dfs = (escenarioId: string): boolean => {
      if (pila.has(escenarioId)) {
        return canReachTerminalMemo.get(escenarioId) !== true;
      }

      if (visitados.has(escenarioId)) {
        return false;
      }

      visitados.add(escenarioId);
      pila.add(escenarioId);

      const escenario = escenarioById.get(escenarioId);

      if (!escenario || escenario.is_final) {
        pila.delete(escenarioId);
        return false;
      }

      const pregunta = preguntasByEscenarioId.get(escenarioId);
      const opciones = pregunta
        ? (opcionesByPreguntaId.get(pregunta.id) ?? [])
        : [];

      for (const opcion of opciones) {
        const siguiente = this.resolveNextEscenarioForFlow(
          casoId,
          escenario,
          opcion,
          escenarios,
          escenarioById,
        );

        if (!siguiente) {
          continue;
        }

        if (dfs(siguiente.id)) {
          return true;
        }
      }

      pila.delete(escenarioId);
      return false;
    };

    for (const escenarioId of alcanzables) {
      if (dfs(escenarioId)) {
        return true;
      }
    }

    return false;
  }

  private assertDocenteRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role === Role.PROFESOR || currentUser.role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenException(
      'Solo docentes o administradores pueden previsualizar o publicar casos.',
    );
  }

  private toCaso(record: CasoRecord): Caso {
    return {
      id: record.id,
      titulo: record.titulo,
      descripcion: record.descripcion,
      objetivoAprendizaje: record.objetivo_aprendizaje,
      autorDocenteId: record.autor_docente_id,
      estado: record.estado,
      isActive: record.is_active,
      publishedAt: record.published_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}
