import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasosService } from './casos.service';
import { StartSesionSimulacionDto } from './dto/start-sesion-simulacion.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CasoGrupo } from './entities/caso-grupo.entity';
import { CasoRecord } from './entities/caso.entity';
import { EscenarioRecord } from './entities/escenario.entity';
import {
  EvidenciaDocente,
  HistorialIntentoEstudiante,
} from './entities/historial-intento.entity';
import { PreguntaDecisionRecord } from './entities/pregunta-decision.entity';
import { OpcionRespuestaRecord } from './entities/opcion-respuesta.entity';
import { RespuestaEstudianteRecord } from './entities/respuesta-estudiante.entity';
import { SesionSimulacionRecord } from './entities/sesion-simulacion.entity';

interface ElementoEscenaRecord {
  id: string;
  tipo: 'personaje' | 'objeto' | 'texto';
  asset_codigo: string | null;
  texto_contenido: string | null;
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
  rotacion: number;
  z_index: number;
}

export interface OpcionSafeRecord {
  id: string;
  texto: string;
  orden: number;
}

@Injectable()
export class SesionesSimulacionService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
  ) {}

  async start(
    dto: StartSesionSimulacionDto,
    currentUser: AuthenticatedUser,
  ): Promise<{
    sesionId: string;
    caso: {
      id: string;
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    };
    primerEscenario: {
      id: string;
      orden: number;
      titulo: string;
      situacionTexto: string;
      fondoCodigo: string;
      isFinal: boolean;
    };
  }> {
    this.assertStudentRole(currentUser);

    const caso = await this.casosService.findCasoById(dto.casoId);
    if (caso.estado !== 'published' || !caso.is_active) {
      throw new ConflictException(
        'Solo se pueden iniciar simulaciones de casos publicados y activos.',
      );
    }

    const asignado = await this.casosService.isCasoAsignadoAEstudiante(
      caso.id,
      currentUser.sub,
    );
    if (!asignado) {
      throw new ForbiddenException(
        'Este caso no está asignado a ninguno de tus grupos.',
      );
    }

    const escenarios = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: caso.id },
      order: 'orden.asc',
    });

    if (escenarios.length === 0) {
      throw new ConflictException('El caso no tiene escenarios para simular.');
    }

    const preguntas = await this.postgrest.select<PreguntaDecisionRecord>(
      'preguntas_decision',
      {
        filters: { escenario_id: escenarios.map((s) => s.id) },
      },
    );

    const sesion = await this.postgrest.insert<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        caso_id: caso.id,
        estudiante_id: currentUser.sub,
        estado: 'in_progress',
        puntaje_total: 0,
        total_preguntas: preguntas.length,
        respondidas: 0,
      },
      { select: '*' },
    );

    const primerEscenario = escenarios[0];

    return {
      sesionId: sesion.id,
      caso: {
        id: caso.id,
        titulo: caso.titulo,
        descripcion: caso.descripcion,
        objetivoAprendizaje: caso.objetivo_aprendizaje,
      },
      primerEscenario: {
        id: primerEscenario.id,
        orden: primerEscenario.orden,
        titulo: primerEscenario.titulo,
        situacionTexto: primerEscenario.situacion_texto,
        fondoCodigo: primerEscenario.fondo_codigo,
        isFinal: primerEscenario.is_final,
      },
    };
  }

  async findSesionById(sesionId: string): Promise<SesionSimulacionRecord> {
    const [sesion] = await this.postgrest.select<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        filters: { id: sesionId },
        limit: 1,
      },
    );

    if (!sesion) {
      throw new NotFoundException('Sesion de simulacion no encontrada.');
    }

    return sesion;
  }

  assertSesionBelongsToStudent(
    sesion: SesionSimulacionRecord,
    currentUser: AuthenticatedUser,
  ): void {
    if (currentUser.role !== Role.ESTUDIANTE) {
      throw new ForbiddenException(
        'Solo estudiantes pueden acceder a sesiones de simulacion.',
      );
    }

    if (sesion.estudiante_id !== currentUser.sub) {
      throw new ForbiddenException('No puedes acceder a sesiones de otro estudiante.');
    }
  }

  async findHistorialEstudiante(
    currentUser: AuthenticatedUser,
  ): Promise<HistorialIntentoEstudiante[]> {
    this.assertStudentRole(currentUser);

    const sesiones = await this.postgrest.select<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        filters: {
          estudiante_id: currentUser.sub,
          estado: 'completed',
        },
        order: 'finished_at.desc',
      },
    );

    if (sesiones.length === 0) {
      return [];
    }

    const casoIds = [...new Set(sesiones.map((sesion) => sesion.caso_id))];
    const casos = await this.postgrest.select<{ id: string; titulo: string }>(
      'casos',
      {
        filters: { id: casoIds },
      },
    );
    const casoById = new Map(casos.map((caso) => [caso.id, caso]));

    return sesiones.map((sesion) => ({
      sesionId: sesion.id,
      casoId: sesion.caso_id,
      casoTitulo: casoById.get(sesion.caso_id)?.titulo ?? 'Caso',
      estado: 'completed' as const,
      puntajeTotal: sesion.puntaje_total,
      fechaInicio: sesion.started_at,
      fechaFinalizacion: sesion.finished_at,
    }));
  }

  async findEvidenciasDocente(
    currentUser: AuthenticatedUser,
  ): Promise<EvidenciaDocente[]> {
    this.assertDocenteRole(currentUser);

    const allowedPairs = await this.buildAllowedCasoEstudiantePairs(currentUser);

    if (allowedPairs.size === 0) {
      return [];
    }

    const casoIds = [...new Set([...allowedPairs].map((key) => key.split(':')[0]))];
    const sesiones = await this.postgrest.select<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        filters: {
          caso_id: casoIds,
          estado: 'completed',
        },
        order: 'finished_at.desc',
      },
    );

    const sesionesFiltradas = sesiones.filter((sesion) =>
      allowedPairs.has(`${sesion.caso_id}:${sesion.estudiante_id}`),
    );

    if (sesionesFiltradas.length === 0) {
      return [];
    }

    const casos = await this.postgrest.select<{ id: string; titulo: string }>(
      'casos',
      {
        filters: { id: casoIds },
      },
    );
    const casoById = new Map(casos.map((caso) => [caso.id, caso]));

    const estudianteIds = [
      ...new Set(sesionesFiltradas.map((sesion) => sesion.estudiante_id)),
    ];
    const usuarios = await this.postgrest.select<Pick<Usuario, 'id' | 'fullName' | 'email'>>(
      'usuarios',
      {
        filters: { id: estudianteIds },
      },
    );
    const usuarioById = new Map(usuarios.map((usuario) => [usuario.id, usuario]));

    return sesionesFiltradas.map((sesion) => {
      const estudiante = usuarioById.get(sesion.estudiante_id);

      return {
        sesionId: sesion.id,
        casoId: sesion.caso_id,
        casoTitulo: casoById.get(sesion.caso_id)?.titulo ?? 'Caso',
        estudianteId: sesion.estudiante_id,
        estudianteNombre: estudiante?.fullName ?? 'Estudiante',
        estudianteEmail: estudiante?.email ?? '',
        estado: 'completed' as const,
        puntajeTotal: sesion.puntaje_total,
        fechaInicio: sesion.started_at,
        fechaFinalizacion: sesion.finished_at,
      };
    });
  }

  async assertDocenteCanReviewSesion(
    sesion: SesionSimulacionRecord,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    this.assertDocenteRole(currentUser);

    if (sesion.estado !== 'completed') {
      throw new ConflictException(
        'La sesion debe estar finalizada para revisar el intento.',
      );
    }

    const caso = await this.casosService.findCasoById(sesion.caso_id);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    const allowed = await this.isEstudianteAsignadoAlCasoEnGruposDocente(
      sesion.caso_id,
      sesion.estudiante_id,
      currentUser,
    );

    if (!allowed) {
      throw new ForbiddenException(
        'No tienes permisos para revisar este intento.',
      );
    }
  }

  async findEvidenciasByCaso(
    casoId: string,
    currentUser: AuthenticatedUser,
  ): Promise<
    Array<{
      sesionId: string;
      estudianteId: string;
      estado: 'in_progress' | 'completed' | 'abandoned';
      puntajeTotal: number;
      totalPreguntas: number;
      respondidas: number;
      startedAt: string;
      finishedAt: string | null;
    }>
  > {
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);
    const allowedPairs = await this.buildAllowedCasoEstudiantePairs(currentUser);

    if (allowedPairs.size === 0) {
      return [];
    }

    const sesiones = await this.postgrest.select<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        filters: { caso_id: casoId },
        order: 'started_at.desc',
      },
    );

    return sesiones
      .filter((sesion) => allowedPairs.has(`${sesion.caso_id}:${sesion.estudiante_id}`))
      .map((sesion) => ({
        sesionId: sesion.id,
        estudianteId: sesion.estudiante_id,
        estado: sesion.estado,
        puntajeTotal: sesion.puntaje_total,
        totalPreguntas: sesion.total_preguntas,
        respondidas: sesion.respondidas,
        startedAt: sesion.started_at,
        finishedAt: sesion.finished_at,
      }));
  }

  async findPendingScenarioForSession(sesion: SesionSimulacionRecord): Promise<{
    escenario: EscenarioRecord;
    pregunta: PreguntaDecisionRecord;
    respondidas: number;
    totalPreguntas: number;
  } | null> {
    if (sesion.estado === 'completed') {
      return null;
    }

    const escenarios = await this.listEscenariosByCaso(sesion.caso_id);

    if (escenarios.length === 0) {
      return null;
    }

    const preguntas = await this.postgrest.select<PreguntaDecisionRecord>(
      'preguntas_decision',
      {
        filters: { escenario_id: escenarios.map((esc) => esc.id) },
      },
    );
    const preguntasByEscenarioId = new Map(
      preguntas.map((pregunta) => [pregunta.escenario_id, pregunta]),
    );

    const respuestas = await this.postgrest.select<RespuestaEstudianteRecord>(
      'respuestas_estudiante',
      {
        filters: { sesion_id: sesion.id },
        order: 'respondida_at.asc',
      },
    );

    let escenarioPendiente: EscenarioRecord | null = null;

    if (respuestas.length === 0) {
      escenarioPendiente = escenarios[0] ?? null;
    } else {
      const ultimaRespuesta = respuestas[respuestas.length - 1];
      const escenarioActual = escenarios.find(
        (escenario) => escenario.id === ultimaRespuesta.escenario_id,
      );

      if (!escenarioActual || escenarioActual.is_final) {
        return null;
      }

      const opcion = await this.findOpcionById(ultimaRespuesta.opcion_id);
      escenarioPendiente = this.resolveNextEscenario(
        sesion.caso_id,
        escenarioActual,
        opcion,
        escenarios,
      );
    }

    if (!escenarioPendiente) {
      return null;
    }

    const pregunta = preguntasByEscenarioId.get(escenarioPendiente.id);

    if (!pregunta) {
      return null;
    }

    const answeredQuestionIds = new Set(respuestas.map((r) => r.pregunta_id));

    if (answeredQuestionIds.has(pregunta.id)) {
      return null;
    }

    return {
      escenario: escenarioPendiente,
      pregunta,
      respondidas: sesion.respondidas,
      totalPreguntas: sesion.total_preguntas,
    };
  }

  resolveNextEscenario(
    casoId: string,
    escenarioActual: EscenarioRecord,
    opcion: Pick<OpcionRespuestaRecord, 'escenario_destino_id'>,
    escenarios: EscenarioRecord[],
  ): EscenarioRecord | null {
    if (escenarioActual.is_final) {
      return null;
    }

    if (opcion.escenario_destino_id) {
      const destino = escenarios.find(
        (escenario) => escenario.id === opcion.escenario_destino_id,
      );

      if (!destino || destino.caso_id !== casoId) {
        throw new BadRequestException(
          'El escenario destino de la opcion no es valido para este caso.',
        );
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

  async resolveNextAfterAnswer(
    sesion: SesionSimulacionRecord,
    escenarioActual: EscenarioRecord,
    opcion: OpcionRespuestaRecord,
  ): Promise<EscenarioRecord | null> {
    const escenarios = await this.listEscenariosByCaso(sesion.caso_id);
    return this.resolveNextEscenario(
      sesion.caso_id,
      escenarioActual,
      opcion,
      escenarios,
    );
  }

  async assertPreguntaIsCurrentForSession(
    sesion: SesionSimulacionRecord,
    preguntaId: string,
  ): Promise<void> {
    const pending = await this.findPendingScenarioForSession(sesion);

    if (!pending || pending.pregunta.id !== preguntaId) {
      throw new BadRequestException(
        'La pregunta no corresponde al escenario actual de la sesion.',
      );
    }
  }

  async recordAnswerProgress(
    sesion: SesionSimulacionRecord,
    puntos: number,
  ): Promise<SesionSimulacionRecord> {
    const [updated] = await this.postgrest.update<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        puntaje_total: sesion.puntaje_total + puntos,
        respondidas: sesion.respondidas + 1,
      },
      {
        filters: { id: sesion.id },
        select: '*',
      },
    );

    return updated;
  }

  async completeSessionAfterAnswer(
    sesion: SesionSimulacionRecord,
    puntos: number,
  ): Promise<SesionSimulacionRecord> {
    const [updated] = await this.postgrest.update<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        puntaje_total: sesion.puntaje_total + puntos,
        respondidas: sesion.respondidas + 1,
        estado: 'completed',
        finished_at: new Date().toISOString(),
      },
      {
        filters: { id: sesion.id },
        select: '*',
      },
    );

    return updated;
  }

  async ensureSessionCompletedIfNoPending(
    sesion: SesionSimulacionRecord,
  ): Promise<SesionSimulacionRecord> {
    if (sesion.estado !== 'in_progress') {
      return sesion;
    }

    const pending = await this.findPendingScenarioForSession(sesion);

    if (pending || sesion.respondidas === 0) {
      return sesion;
    }

    const [updated] = await this.postgrest.update<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        estado: 'completed',
        finished_at: new Date().toISOString(),
      },
      {
        filters: { id: sesion.id },
        select: '*',
      },
    );

    return updated;
  }

  async markCompletedIfNeeded(
    sesionId: string,
    nextRespondidas: number,
    totalPreguntas: number,
  ): Promise<SesionSimulacionRecord> {
    const shouldComplete = totalPreguntas > 0 && nextRespondidas >= totalPreguntas;

    const [updated] = await this.postgrest.update<SesionSimulacionRecord>(
      'sesiones_simulacion',
      shouldComplete
        ? {
            respondidas: nextRespondidas,
            estado: 'completed',
            finished_at: new Date().toISOString(),
          }
        : {
            respondidas: nextRespondidas,
          },
      {
        filters: { id: sesionId },
        select: '*',
      },
    );

    return updated;
  }

  async listElementosByEscenario(escenarioId: string): Promise<ElementoEscenaRecord[]> {
    return this.postgrest.select<ElementoEscenaRecord>('elementos_escena', {
      filters: { escenario_id: escenarioId },
      order: 'z_index.asc',
    });
  }

  async listOpcionesPublicasByPregunta(
    preguntaId: string,
  ): Promise<OpcionSafeRecord[]> {
    return this.postgrest.select<OpcionSafeRecord>('opciones_respuesta', {
      filters: { pregunta_id: preguntaId },
      order: 'orden.asc',
      select: 'id,texto,orden',
    });
  }

  async incrementScoreAndProgress(
    sesion: SesionSimulacionRecord,
    puntos: number,
  ): Promise<SesionSimulacionRecord> {
    return this.recordAnswerProgress(sesion, puntos);
  }

  async finalize(
    sesionId: string,
    currentUser: AuthenticatedUser,
  ): Promise<SesionSimulacionRecord> {
    this.assertStudentRole(currentUser);

    const sesion = await this.findSesionById(sesionId);
    this.assertSesionBelongsToStudent(sesion, currentUser);

    if (sesion.estado === 'completed') {
      return sesion;
    }

    const pending = await this.findPendingScenarioForSession(sesion);

    if (pending) {
      throw new ConflictException(
        'No se puede finalizar la simulacion porque hay escenarios pendientes.',
      );
    }

    if (sesion.respondidas === 0) {
      throw new ConflictException(
        'No se puede finalizar la simulacion sin responder al menos una pregunta.',
      );
    }

    const [updated] = await this.postgrest.update<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        estado: 'completed',
        finished_at: new Date().toISOString(),
      },
      {
        filters: { id: sesionId },
        select: '*',
      },
    );

    return updated;
  }

  private async buildAllowedCasoEstudiantePairs(
    currentUser: AuthenticatedUser,
  ): Promise<Set<string>> {
    const asignaciones = await this.listAsignacionesVisibles(currentUser);

    if (asignaciones.length === 0) {
      return new Set();
    }

    const grupoIds = [...new Set(asignaciones.map((item) => item.grupoId))];
    const membresias = await this.postgrest.select<{
      grupoId: string;
      estudianteId: string;
    }>('estudiante_grupo', {
      filters: { grupoId: grupoIds },
    });

    const estudiantesByGrupo = new Map<string, Set<string>>();

    for (const membresia of membresias) {
      const actuales = estudiantesByGrupo.get(membresia.grupoId) ?? new Set<string>();
      actuales.add(membresia.estudianteId);
      estudiantesByGrupo.set(membresia.grupoId, actuales);
    }

    const allowedPairs = new Set<string>();

    for (const asignacion of asignaciones) {
      const estudiantes = estudiantesByGrupo.get(asignacion.grupoId);

      if (!estudiantes) {
        continue;
      }

      for (const estudianteId of estudiantes) {
        allowedPairs.add(`${asignacion.casoId}:${estudianteId}`);
      }
    }

    return allowedPairs;
  }

  private async listAsignacionesVisibles(
    currentUser: AuthenticatedUser,
  ): Promise<CasoGrupo[]> {
    if (currentUser.role === Role.ADMIN) {
      return this.postgrest.select<CasoGrupo>('caso_grupo', {
        order: 'createdAt.desc',
      });
    }

    const casos = await this.postgrest.select<CasoRecord>('casos', {
      filters: { autor_docente_id: currentUser.sub },
    });

    if (casos.length === 0) {
      return [];
    }

    const asignaciones = await this.postgrest.select<CasoGrupo>('caso_grupo', {
      filters: { casoId: casos.map((caso) => caso.id) },
      order: 'createdAt.desc',
    });

    const grupos = await this.postgrest.select<{ id: string; profesorId: string }>(
      'grupos',
      {
        filters: {
          id: [...new Set(asignaciones.map((item) => item.grupoId))],
          profesorId: currentUser.sub,
        },
      },
    );
    const grupoIdsPermitidos = new Set(grupos.map((grupo) => grupo.id));

    return asignaciones.filter((asignacion) =>
      grupoIdsPermitidos.has(asignacion.grupoId),
    );
  }

  private async isEstudianteAsignadoAlCasoEnGruposDocente(
    casoId: string,
    estudianteId: string,
    currentUser: AuthenticatedUser,
  ): Promise<boolean> {
    const asignaciones = await this.postgrest.select<CasoGrupo>('caso_grupo', {
      filters: { casoId },
    });

    if (asignaciones.length === 0) {
      return false;
    }

    let grupoIds = asignaciones.map((item) => item.grupoId);

    if (currentUser.role === Role.PROFESOR) {
      const grupos = await this.postgrest.select<{ id: string }>('grupos', {
        filters: {
          id: grupoIds,
          profesorId: currentUser.sub,
        },
      });
      grupoIds = grupos.map((grupo) => grupo.id);
    }

    if (grupoIds.length === 0) {
      return false;
    }

    const [membresia] = await this.postgrest.select<{ estudianteId: string }>(
      'estudiante_grupo',
      {
        filters: {
          grupoId: grupoIds,
          estudianteId,
        },
        limit: 1,
      },
    );

    return Boolean(membresia);
  }

  private async listEscenariosByCaso(casoId: string): Promise<EscenarioRecord[]> {
    return this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: casoId },
      order: 'orden.asc',
    });
  }

  private async findOpcionById(id: string): Promise<OpcionRespuestaRecord> {
    const [opcion] = await this.postgrest.select<OpcionRespuestaRecord>(
      'opciones_respuesta',
      {
        filters: { id },
        limit: 1,
      },
    );

    if (!opcion) {
      throw new NotFoundException('Opcion no encontrada.');
    }

    return opcion;
  }

  private assertStudentRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role !== Role.ESTUDIANTE) {
      throw new ForbiddenException(
        'Solo estudiantes pueden ejecutar simulaciones.',
      );
    }
  }

  private assertDocenteRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role === Role.PROFESOR || currentUser.role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenException(
      'Solo docentes o administradores pueden consultar evidencias.',
    );
  }

}
