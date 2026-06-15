import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasosService } from './casos.service';
import { CreateRubricaCriterioDto } from './dto/create-rubrica-criterio.dto';
import { UpdateRubricaCriterioDto } from './dto/update-rubrica-criterio.dto';
import {
  RubricaCriterio,
  RubricaCriterioRecord,
} from './entities/rubrica-criterio.entity';

@Injectable()
export class RubricaService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
  ) {}

  async listar(casoId: string): Promise<RubricaCriterio[]> {
    const records = await this.postgrest.select<RubricaCriterioRecord>(
      'rubrica_criterios',
      {
        filters: { caso_id: casoId },
        order: 'orden.asc',
      },
    );

    return records.map((record) => this.toCriterio(record));
  }

  async crear(
    casoId: string,
    dto: CreateRubricaCriterioDto,
    currentUser: AuthenticatedUser,
  ): Promise<RubricaCriterio> {
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    const orden = dto.orden ?? (await this.getNextOrden(casoId));
    await this.ensureUniqueOrden(casoId, orden);

    const created = await this.postgrest.insert<RubricaCriterioRecord>(
      'rubrica_criterios',
      {
        caso_id: casoId,
        criterio: dto.criterio.trim(),
        descripcion: dto.descripcion.trim(),
        nivel_esperado: dto.nivelEsperado?.trim() || null,
        peso: dto.peso ?? null,
        orden,
      },
      { select: '*' },
    );

    return this.toCriterio(created);
  }

  async actualizar(
    criterioId: string,
    dto: UpdateRubricaCriterioDto,
    currentUser: AuthenticatedUser,
  ): Promise<RubricaCriterio> {
    const criterio = await this.findRecord(criterioId);
    const caso = await this.casosService.findCasoById(criterio.caso_id);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    if (dto.orden !== undefined && dto.orden !== criterio.orden) {
      await this.ensureUniqueOrden(criterio.caso_id, dto.orden);
    }

    const payload: Record<string, string | number | null> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.criterio !== undefined) {
      payload.criterio = dto.criterio.trim();
    }
    if (dto.descripcion !== undefined) {
      payload.descripcion = dto.descripcion.trim();
    }
    if (dto.nivelEsperado !== undefined) {
      payload.nivel_esperado = dto.nivelEsperado.trim() || null;
    }
    if (dto.peso !== undefined) {
      payload.peso = dto.peso;
    }
    if (dto.orden !== undefined) {
      payload.orden = dto.orden;
    }

    if (Object.keys(payload).length === 1) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    const [updated] = await this.postgrest.update<RubricaCriterioRecord>(
      'rubrica_criterios',
      payload,
      { filters: { id: criterioId }, select: '*' },
    );

    return this.toCriterio(updated);
  }

  async eliminar(criterioId: string, currentUser: AuthenticatedUser) {
    const criterio = await this.findRecord(criterioId);
    const caso = await this.casosService.findCasoById(criterio.caso_id);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    await this.postgrest.remove('rubrica_criterios', {
      filters: { id: criterioId },
    });

    return { message: 'Criterio de rubrica eliminado correctamente.' };
  }

  private async findRecord(criterioId: string): Promise<RubricaCriterioRecord> {
    const [record] = await this.postgrest.select<RubricaCriterioRecord>(
      'rubrica_criterios',
      {
        filters: { id: criterioId },
        limit: 1,
      },
    );

    if (!record) {
      throw new NotFoundException('Criterio de rubrica no encontrado.');
    }

    return record;
  }

  private async getNextOrden(casoId: string): Promise<number> {
    const records = await this.postgrest.select<Pick<RubricaCriterioRecord, 'orden'>>(
      'rubrica_criterios',
      {
        filters: { caso_id: casoId },
        select: 'orden',
        order: 'orden.desc',
        limit: 1,
      },
    );

    return (records[0]?.orden ?? 0) + 1;
  }

  private async ensureUniqueOrden(casoId: string, orden: number): Promise<void> {
    const [existing] = await this.postgrest.select<Pick<RubricaCriterioRecord, 'id'>>(
      'rubrica_criterios',
      {
        filters: { caso_id: casoId, orden },
        select: 'id',
        limit: 1,
      },
    );

    if (existing) {
      throw new ConflictException('Ya existe un criterio de rubrica con ese orden.');
    }
  }

  private toCriterio(record: RubricaCriterioRecord): RubricaCriterio {
    return {
      id: record.id,
      casoId: record.caso_id,
      criterio: record.criterio,
      descripcion: record.descripcion,
      nivelEsperado: record.nivel_esperado,
      peso: record.peso,
      orden: record.orden,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}
