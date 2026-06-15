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
import { SubmitRespuestaDto } from './dto/submit-respuesta.dto';
import { OpcionRespuestaRecord } from './entities/opcion-respuesta.entity';
import { PreguntaDecisionRecord } from './entities/pregunta-decision.entity';
import { EscenarioRecord } from './entities/escenario.entity';
import { RespuestaEstudianteRecord } from './entities/respuesta-estudiante.entity';
import { SesionSimulacionRecord } from './entities/sesion-simulacion.entity';
import { SesionesSimulacionService } from './sesiones-simulacion.service';

@Injectable()
export class RespuestasEstudianteService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly sesionesService: SesionesSimulacionService,
  ) {}

  async submit(
    sesionId: string,
    dto: SubmitRespuestaDto,
    currentUser: AuthenticatedUser,
  ): Promise<{
    respuestaId: string;
    puntajeObtenido: number;
    completed: boolean;
    respondidas: number;
    totalPreguntas: number;
    mensaje: string;
    resultadoUrl?: string;
  }> {
    this.assertStudentRole(currentUser);

    const sesion = await this.sesionesService.findSesionById(sesionId);
    this.sesionesService.assertSesionBelongsToStudent(sesion, currentUser);

    const validSesion =
      await this.sesionesService.ensureSessionCompletedIfTimeExpired(sesion);

    if (validSesion.estado !== 'in_progress') {
      throw new ConflictException('La sesion no se encuentra en progreso.');
    }

    const pregunta = await this.findPreguntaById(dto.preguntaId);
    const opcion = await this.findOpcionById(dto.opcionId);

    if (opcion.pregunta_id !== pregunta.id) {
      throw new BadRequestException(
        'La opcion seleccionada no pertenece a la pregunta enviada.',
      );
    }

    const escenario = await this.findEscenarioById(pregunta.escenario_id);
    if (escenario.caso_id !== sesion.caso_id) {
      throw new BadRequestException(
        'La pregunta no pertenece al caso asociado a la sesion.',
      );
    }

    const [alreadyAnswered] = await this.postgrest.select<RespuestaEstudianteRecord>(
      'respuestas_estudiante',
      {
        filters: { sesion_id: sesionId, pregunta_id: pregunta.id },
        limit: 1,
      },
    );

    let respuesta: RespuestaEstudianteRecord;
    let sesionActualizada: SesionSimulacionRecord;

    if (alreadyAnswered) {
      const [updatedAnswer] = await this.postgrest.update<RespuestaEstudianteRecord>(
        'respuestas_estudiante',
        {
          opcion_id: opcion.id,
          escenario_id: escenario.id,
          puntaje_obtenido: opcion.puntaje,
          respondida_at: new Date().toISOString(),
        },
        {
          filters: { id: alreadyAnswered.id },
          select: '*',
        },
      );
      respuesta = updatedAnswer;

      const delta = opcion.puntaje - alreadyAnswered.puntaje_obtenido;
      const [updatedSession] = await this.postgrest.update<SesionSimulacionRecord>(
        'sesiones_simulacion',
        {
          puntaje_total: validSesion.puntaje_total + delta,
        },
        {
          filters: { id: validSesion.id },
          select: '*',
        },
      );
      sesionActualizada = updatedSession;
    } else {
      respuesta = await this.postgrest.insert<RespuestaEstudianteRecord>(
        'respuestas_estudiante',
        {
          sesion_id: sesionId,
          pregunta_id: pregunta.id,
          opcion_id: opcion.id,
          escenario_id: escenario.id,
          puntaje_obtenido: opcion.puntaje,
        },
        { select: '*' },
      );
      sesionActualizada = await this.sesionesService.recordAnswerProgress(
        validSesion,
        opcion.puntaje,
      );
    }

    const completed = sesionActualizada.estado === 'completed';
    return {
      respuestaId: respuesta.id,
      puntajeObtenido: respuesta.puntaje_obtenido,
      completed,
      respondidas: sesionActualizada.respondidas,
      totalPreguntas: sesionActualizada.total_preguntas,
      mensaje: completed
        ? 'Participación finalizada. Puedes revisar tu resultado.'
        : 'Respuesta registrada. Podrás revisar la retroalimentación al finalizar.',
      ...(completed
        ? {
            resultadoUrl: `/api/simulacion/estudiante/sesiones/${sesionId}/resultado`,
          }
        : {}),
    };
  }

  async findRespuestasBySesion(
    sesionId: string,
  ): Promise<RespuestaEstudianteRecord[]> {
    return this.postgrest.select<RespuestaEstudianteRecord>('respuestas_estudiante', {
      filters: { sesion_id: sesionId },
      order: 'respondida_at.asc',
    });
  }

  private async findPreguntaById(id: string): Promise<PreguntaDecisionRecord> {
    const [pregunta] = await this.postgrest.select<PreguntaDecisionRecord>(
      'preguntas_decision',
      {
        filters: { id },
        limit: 1,
      },
    );

    if (!pregunta) {
      throw new NotFoundException('Pregunta de decision no encontrada.');
    }

    return pregunta;
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

  private async findEscenarioById(id: string): Promise<EscenarioRecord> {
    const [escenario] = await this.postgrest.select<EscenarioRecord>(
      'escenarios',
      {
        filters: { id },
        limit: 1,
      },
    );

    if (!escenario) {
      throw new NotFoundException('Escenario no encontrado.');
    }

    return escenario;
  }

  private assertStudentRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role !== Role.ESTUDIANTE) {
      throw new ForbiddenException(
        'Solo estudiantes pueden responder simulaciones.',
      );
    }
  }

}
