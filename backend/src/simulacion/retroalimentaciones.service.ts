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
import { CreateRetroalimentacionDto } from './dto/create-retroalimentacion.dto';
import { UpdateRetroalimentacionDto } from './dto/update-retroalimentacion.dto';
import { CasoRecord } from './entities/caso.entity';
import { Retroalimentacion, RetroalimentacionRecord } from './entities/retroalimentacion.entity';
import { DecisionesService } from './decisiones.service';

@Injectable()
export class RetroalimentacionesService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
    private readonly decisionesService: DecisionesService,
  ) {}

  async create(
    opcionId: string,
    dto: CreateRetroalimentacionDto,
    currentUser: AuthenticatedUser,
  ): Promise<Retroalimentacion> {
    this.assertDocenteRole(currentUser);

    const opcion = await this.decisionesService.findOpcionById(opcionId);
    const context = await this.decisionesService.getPreguntaContext(opcion.pregunta_id);
    this.casosService.assertCanAccessCasoDocente(context.caso, currentUser);
    this.assertCaseEditable(context.caso);

    const [existing] = await this.postgrest.select<RetroalimentacionRecord>(
      'retroalimentaciones',
      {
        filters: { opcion_id: opcionId },
        limit: 1,
      },
    );

    if (existing) {
      throw new ConflictException(
        'La opcion ya tiene una retroalimentacion registrada.',
      );
    }

    const payload = {
      opcion_id: opcionId,
      mensaje: dto.mensaje.trim(),
      tipo: dto.tipo ?? 'pedagogica',
      referencia_teorica: dto.referenciaTeorica?.trim() || null,
    };

    try {
      const created = await this.postgrest.insert<RetroalimentacionRecord>(
        'retroalimentaciones',
        payload,
        { select: '*' },
      );
      return this.toRetroalimentacion(created);
    } catch (error) {
      this.rethrowConflict(
        error,
        'La opcion ya tiene una retroalimentacion registrada.',
      );
      throw error;
    }
  }

  async update(
    retroalimentacionId: string,
    dto: UpdateRetroalimentacionDto,
    currentUser: AuthenticatedUser,
  ): Promise<Retroalimentacion> {
    this.assertDocenteRole(currentUser);

    const retro = await this.findById(retroalimentacionId);
    const opcion = await this.decisionesService.findOpcionById(retro.opcion_id);
    const context = await this.decisionesService.getPreguntaContext(opcion.pregunta_id);
    this.casosService.assertCanAccessCasoDocente(context.caso, currentUser);
    this.assertCaseEditable(context.caso);

    const payload: Record<string, string | null> = {};
    if (dto.mensaje !== undefined) {
      payload.mensaje = dto.mensaje.trim();
    }
    if (dto.tipo !== undefined) {
      payload.tipo = dto.tipo;
    }
    if (dto.referenciaTeorica !== undefined) {
      payload.referencia_teorica = dto.referenciaTeorica.trim() || null;
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    const [updated] = await this.postgrest.update<RetroalimentacionRecord>(
      'retroalimentaciones',
      payload,
      {
        filters: { id: retroalimentacionId },
        select: '*',
      },
    );

    if (!updated) {
      throw new NotFoundException('Retroalimentacion no encontrada.');
    }

    return this.toRetroalimentacion(updated);
  }

  async remove(retroalimentacionId: string, currentUser: AuthenticatedUser) {
    this.assertDocenteRole(currentUser);

    const retro = await this.findById(retroalimentacionId);
    const opcion = await this.decisionesService.findOpcionById(retro.opcion_id);
    const context = await this.decisionesService.getPreguntaContext(opcion.pregunta_id);
    this.casosService.assertCanAccessCasoDocente(context.caso, currentUser);
    this.assertCaseEditable(context.caso);

    await this.postgrest.remove('retroalimentaciones', {
      filters: { id: retroalimentacionId },
    });

    return { message: 'Retroalimentacion eliminada correctamente.' };
  }

  async findById(retroalimentacionId: string): Promise<RetroalimentacionRecord> {
    const [retro] = await this.postgrest.select<RetroalimentacionRecord>(
      'retroalimentaciones',
      {
        filters: { id: retroalimentacionId },
        limit: 1,
      },
    );

    if (!retro) {
      throw new NotFoundException('Retroalimentacion no encontrada.');
    }

    return retro;
  }

  private assertDocenteRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role === Role.PROFESOR || currentUser.role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenException(
      'Solo docentes o administradores pueden configurar retroalimentaciones.',
    );
  }

  private assertCaseEditable(caso: CasoRecord): void {
    if (caso.estado !== 'draft') {
      throw new ConflictException(
        'Solo se permite configurar retroalimentaciones en casos draft.',
      );
    }
  }

  private toRetroalimentacion(record: RetroalimentacionRecord): Retroalimentacion {
    return {
      id: record.id,
      opcionId: record.opcion_id,
      mensaje: record.mensaje,
      tipo: record.tipo,
      referenciaTeorica: record.referencia_teorica,
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
