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
import { CreateOpcionRespuestaDto } from './dto/create-opcion-respuesta.dto';
import { CreatePreguntaDecisionDto } from './dto/create-pregunta-decision.dto';
import { UpdatePreguntaDecisionDto } from './dto/update-pregunta-decision.dto';
import { UpdateOpcionRespuestaDto } from './dto/update-opcion-respuesta.dto';
import { CasoRecord } from './entities/caso.entity';
import { OpcionRespuesta, OpcionRespuestaRecord } from './entities/opcion-respuesta.entity';
import {
  PreguntaDecision,
  PreguntaDecisionRecord,
} from './entities/pregunta-decision.entity';
import { EscenarioRecord } from './entities/escenario.entity';

@Injectable()
export class DecisionesService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
  ) {}

  async createPregunta(
    escenarioId: string,
    dto: CreatePreguntaDecisionDto,
    currentUser: AuthenticatedUser,
  ): Promise<PreguntaDecision> {
    this.assertDocenteRole(currentUser);

    const escenario = await this.findEscenarioById(escenarioId);
    const caso = await this.casosService.findCasoById(escenario.caso_id);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);
    this.assertCaseEditable(caso);

    const orden = dto.orden ?? (await this.getNextPreguntaOrden(escenarioId));
    await this.ensureUniquePreguntaOrder(escenarioId, orden);

    const payload = {
      escenario_id: escenarioId,
      orden,
      enunciado: dto.enunciado.trim(),
      tipo: dto.tipo ?? 'single_choice',
      puntaje_maximo: dto.puntajeMaximo ?? 5,
    };

    try {
      const created = await this.postgrest.insert<PreguntaDecisionRecord>(
        'preguntas_decision',
        payload,
        { select: '*' },
      );

      return this.toPregunta(created);
    } catch (error) {
      this.rethrowConflict(
        error,
        'Ya existe una pregunta con ese orden en el escenario.',
      );
      throw error;
    }
  }

  async createOpcion(
    preguntaId: string,
    dto: CreateOpcionRespuestaDto,
    currentUser: AuthenticatedUser,
  ): Promise<OpcionRespuesta> {
    this.assertDocenteRole(currentUser);

    const context = await this.getPreguntaContext(preguntaId);
    this.casosService.assertCanAccessCasoDocente(context.caso, currentUser);
    this.assertCaseEditable(context.caso);
    await this.ensureUniqueOptionOrder(preguntaId, dto.orden);
    this.assertPuntajeOpcionCoherente(dto.puntaje, context.pregunta);
    await this.assertEscenarioDestinoValido(
      dto.escenarioDestinoId,
      context.caso.id,
    );

    const payload: Record<string, string | number | boolean | null> = {
      pregunta_id: preguntaId,
      texto: dto.texto.trim(),
      orden: dto.orden,
      puntaje: dto.puntaje,
      is_correcta: dto.isCorrecta ?? false,
    };

    if (dto.escenarioDestinoId) {
      payload.escenario_destino_id = dto.escenarioDestinoId;
    }

    try {
      const created = await this.postgrest.insert<OpcionRespuestaRecord>(
        'opciones_respuesta',
        payload,
        { select: '*' },
      );
      return this.toOpcion(created);
    } catch (error) {
      this.rethrowConflict(
        error,
        'Ya existe una opcion con ese orden en la pregunta.',
      );
      throw error;
    }
  }

  async updatePregunta(
    preguntaId: string,
    dto: UpdatePreguntaDecisionDto,
    currentUser: AuthenticatedUser,
  ): Promise<PreguntaDecision> {
    this.assertDocenteRole(currentUser);

    const context = await this.getPreguntaContext(preguntaId);
    this.casosService.assertCanAccessCasoDocente(context.caso, currentUser);
    this.assertCaseEditable(context.caso);

    const payload: Record<string, string | number> = {};

    if (dto.orden !== undefined && dto.orden !== context.pregunta.orden) {
      await this.ensureUniquePreguntaOrder(
        context.escenario.id,
        dto.orden,
        preguntaId,
      );
      payload.orden = dto.orden;
    }

    if (dto.enunciado !== undefined) {
      payload.enunciado = dto.enunciado.trim();
    }

    if (dto.tipo !== undefined) {
      payload.tipo = dto.tipo;
    }

    if (dto.puntajeMaximo !== undefined) {
      await this.assertPuntajePreguntaCompatible(
        preguntaId,
        dto.puntajeMaximo,
      );
      payload.puntaje_maximo = dto.puntajeMaximo;
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    const [updated] = await this.postgrest.update<PreguntaDecisionRecord>(
      'preguntas_decision',
      payload,
      {
        filters: { id: preguntaId },
        select: '*',
      },
    );

    if (!updated) {
      throw new NotFoundException('Pregunta de decision no encontrada.');
    }

    return this.toPregunta(updated);
  }

  async removePregunta(preguntaId: string, currentUser: AuthenticatedUser) {
    this.assertDocenteRole(currentUser);

    const context = await this.getPreguntaContext(preguntaId);
    this.casosService.assertCanAccessCasoDocente(context.caso, currentUser);
    this.assertCaseEditable(context.caso);

    const [respuesta] = await this.postgrest.select<{ id: string }>(
      'respuestas_estudiante',
      {
        filters: { pregunta_id: preguntaId },
        select: 'id',
        limit: 1,
      },
    );

    if (respuesta) {
      throw new ConflictException(
        'No se puede eliminar esta pregunta porque ya tiene respuestas registradas.',
      );
    }

    await this.postgrest.remove('preguntas_decision', {
      filters: { id: preguntaId },
    });

    return { message: 'Pregunta eliminada correctamente.' };
  }

  async updateOpcion(
    opcionId: string,
    dto: UpdateOpcionRespuestaDto,
    currentUser: AuthenticatedUser,
  ): Promise<OpcionRespuesta> {
    this.assertDocenteRole(currentUser);

    const opcion = await this.findOpcionById(opcionId);
    const context = await this.getPreguntaContext(opcion.pregunta_id);
    this.casosService.assertCanAccessCasoDocente(context.caso, currentUser);
    this.assertCaseEditable(context.caso);

    if (dto.orden !== undefined && dto.orden !== opcion.orden) {
      await this.ensureUniqueOptionOrder(opcion.pregunta_id, dto.orden);
    }

    const payload: Record<string, string | number | boolean | null> = {};

    if (dto.texto !== undefined) {
      payload.texto = dto.texto.trim();
    }
    if (dto.orden !== undefined) {
      payload.orden = dto.orden;
    }
    if (dto.puntaje !== undefined) {
      this.assertPuntajeOpcionCoherente(dto.puntaje, context.pregunta);
      payload.puntaje = dto.puntaje;
    }
    if (dto.isCorrecta !== undefined) {
      payload.is_correcta = dto.isCorrecta;
    }
    if (dto.escenarioDestinoId !== undefined) {
      await this.assertEscenarioDestinoValido(
        dto.escenarioDestinoId,
        context.caso.id,
      );
      payload.escenario_destino_id = dto.escenarioDestinoId;
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    try {
      const [updated] = await this.postgrest.update<OpcionRespuestaRecord>(
        'opciones_respuesta',
        payload,
        {
          filters: { id: opcionId },
          select: '*',
        },
      );

      if (!updated) {
        throw new NotFoundException('Opcion no encontrada.');
      }

      return this.toOpcion(updated);
    } catch (error) {
      this.rethrowConflict(
        error,
        'Ya existe una opcion con ese orden en la pregunta.',
      );
      throw error;
    }
  }

  async removeOpcion(opcionId: string, currentUser: AuthenticatedUser) {
    this.assertDocenteRole(currentUser);

    const opcion = await this.findOpcionById(opcionId);
    const context = await this.getPreguntaContext(opcion.pregunta_id);
    this.casosService.assertCanAccessCasoDocente(context.caso, currentUser);
    this.assertCaseEditable(context.caso);

    await this.postgrest.remove('opciones_respuesta', {
      filters: { id: opcionId },
    });

    return { message: 'Opcion eliminada correctamente.' };
  }

  async findPreguntaById(id: string): Promise<PreguntaDecisionRecord> {
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

  async findOpcionById(id: string): Promise<OpcionRespuestaRecord> {
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

  async getPreguntaContext(preguntaId: string): Promise<{
    pregunta: PreguntaDecisionRecord;
    escenario: EscenarioRecord;
    caso: CasoRecord;
  }> {
    const pregunta = await this.findPreguntaById(preguntaId);
    const escenario = await this.findEscenarioById(pregunta.escenario_id);
    const caso = await this.casosService.findCasoById(escenario.caso_id);

    return { pregunta, escenario, caso };
  }

  private async findEscenarioById(id: string): Promise<EscenarioRecord> {
    const [escenario] = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { id },
      limit: 1,
    });

    if (!escenario) {
      throw new NotFoundException('Escenario no encontrado.');
    }

    return escenario;
  }

  private async ensureUniqueOptionOrder(
    preguntaId: string,
    orden: number,
  ): Promise<void> {
    const [existing] = await this.postgrest.select<OpcionRespuestaRecord>(
      'opciones_respuesta',
      {
        filters: { pregunta_id: preguntaId, orden },
        limit: 1,
      },
    );

    if (existing) {
      throw new ConflictException(
        'Ya existe una opcion con ese orden en la pregunta.',
      );
    }
  }

  private async assertEscenarioDestinoValido(
    escenarioDestinoId: string | null | undefined,
    casoId: string,
  ): Promise<void> {
    if (escenarioDestinoId === undefined || escenarioDestinoId === null) {
      return;
    }

    const destino = await this.findEscenarioById(escenarioDestinoId);

    if (destino.caso_id !== casoId) {
      throw new BadRequestException(
        'El escenario destino debe pertenecer al mismo caso.',
      );
    }
  }

  private assertPuntajeOpcionCoherente(
    puntaje: number,
    pregunta: PreguntaDecisionRecord,
  ): void {
    if (puntaje < 0 || puntaje > 5) {
      throw new BadRequestException(
        'La nota de la respuesta debe estar entre 0.0 y 5.0.',
      );
    }

    if (puntaje > pregunta.puntaje_maximo) {
      throw new BadRequestException(
        'La nota de la respuesta no puede superar la nota maxima de la pregunta.',
      );
    }
  }

  private async getNextPreguntaOrden(escenarioId: string): Promise<number> {
    const preguntas = await this.postgrest.select<Pick<PreguntaDecisionRecord, 'orden'>>(
      'preguntas_decision',
      {
        filters: { escenario_id: escenarioId },
        select: 'orden',
      },
    );

    if (preguntas.length === 0) {
      return 1;
    }

    return Math.max(...preguntas.map((pregunta) => pregunta.orden ?? 1)) + 1;
  }

  private async ensureUniquePreguntaOrder(
    escenarioId: string,
    orden: number,
    ignorePreguntaId?: string,
  ): Promise<void> {
    const [existing] = await this.postgrest.select<PreguntaDecisionRecord>(
      'preguntas_decision',
      {
        filters: { escenario_id: escenarioId, orden },
        limit: 1,
      },
    );

    if (existing && existing.id !== ignorePreguntaId) {
      throw new ConflictException(
        'Ya existe una pregunta con ese orden en el escenario.',
      );
    }
  }

  private async assertPuntajePreguntaCompatible(
    preguntaId: string,
    puntajeMaximo: number,
  ): Promise<void> {
    const opciones = await this.postgrest.select<OpcionRespuestaRecord>(
      'opciones_respuesta',
      {
        filters: { pregunta_id: preguntaId },
      },
    );

    const mayorPuntaje = opciones.reduce(
      (max, opcion) => Math.max(max, opcion.puntaje),
      0,
    );

    if (mayorPuntaje > puntajeMaximo) {
      throw new BadRequestException(
        'El puntaje maximo de la pregunta no puede ser menor al mayor puntaje asignado en sus respuestas.',
      );
    }
  }

  private assertDocenteRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role === Role.PROFESOR || currentUser.role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenException(
      'Solo docentes o administradores pueden configurar decisiones.',
    );
  }

  private assertCaseEditable(caso: CasoRecord): void {
    if (caso.estado !== 'draft') {
      throw new ConflictException(
        'Solo se permite configurar decisiones en casos draft.',
      );
    }
  }

  private toPregunta(record: PreguntaDecisionRecord): PreguntaDecision {
    return {
      id: record.id,
      escenarioId: record.escenario_id,
      orden: record.orden,
      enunciado: record.enunciado,
      tipo: record.tipo,
      puntajeMaximo: record.puntaje_maximo,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private toOpcion(record: OpcionRespuestaRecord): OpcionRespuesta {
    return {
      id: record.id,
      preguntaId: record.pregunta_id,
      texto: record.texto,
      orden: record.orden,
      puntaje: record.puntaje,
      isCorrecta: record.is_correcta,
      escenarioDestinoId: record.escenario_destino_id ?? null,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private rethrowConflict(error: unknown, message: string) {
    if (error instanceof Error && error.message.includes('23505')) {
      throw new ConflictException(message);
    }
  }
}
