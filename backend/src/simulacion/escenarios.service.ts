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
import { ALLOWED_BACKGROUND_CODES } from './constants/backgrounds.constant';
import { CreateEscenarioDto } from './dto/create-escenario.dto';
import { UpdateEscenarioDto } from './dto/update-escenario.dto';
import { UpdateEscenarioLayoutDto } from './dto/update-escenario-layout.dto';
import { normalizeLayout } from './editor-layout.util';
import { CasoRecord } from './entities/caso.entity';
import { Escenario, EscenarioRecord } from './entities/escenario.entity';

@Injectable()
export class EscenariosService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
  ) {}

  async create(
    casoId: string,
    createEscenarioDto: CreateEscenarioDto,
    currentUser: AuthenticatedUser,
  ): Promise<Escenario> {
    this.assertDocenteRole(currentUser);
    this.assertBackgroundCode(createEscenarioDto.fondoCodigo);

    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);
    this.assertCaseEditable(caso);

    await this.ensureUniqueOrder(casoId, createEscenarioDto.orden);

    const payload = {
      caso_id: casoId,
      orden: createEscenarioDto.orden,
      titulo: createEscenarioDto.titulo.trim(),
      situacion_texto: createEscenarioDto.situacionTexto.trim(),
      fondo_codigo: createEscenarioDto.fondoCodigo,
      is_final: createEscenarioDto.isFinal ?? false,
    };

    try {
      const escenario = await this.postgrest.insert<EscenarioRecord>(
        'escenarios',
        payload,
        {
          select: '*',
        },
      );

      return this.toEscenario(escenario);
    } catch (error) {
      this.rethrowConflict(error, 'Ya existe un escenario con ese orden en el caso.');
      throw error;
    }
  }

  async update(
    escenarioId: string,
    updateEscenarioDto: UpdateEscenarioDto,
    currentUser: AuthenticatedUser,
  ): Promise<Escenario> {
    this.assertDocenteRole(currentUser);
    const escenario = await this.findEscenarioById(escenarioId);
    const caso = await this.casosService.findCasoById(escenario.caso_id);

    this.casosService.assertCanAccessCasoDocente(caso, currentUser);
    this.assertCaseEditable(caso);

    if (updateEscenarioDto.fondoCodigo !== undefined) {
      this.assertBackgroundCode(updateEscenarioDto.fondoCodigo);
    }

    if (
      updateEscenarioDto.orden !== undefined &&
      updateEscenarioDto.orden !== escenario.orden
    ) {
      await this.ensureUniqueOrder(escenario.caso_id, updateEscenarioDto.orden);
    }

    const payload: Record<string, string | number | boolean> = {};

    if (updateEscenarioDto.orden !== undefined) {
      payload.orden = updateEscenarioDto.orden;
    }

    if (updateEscenarioDto.titulo !== undefined) {
      payload.titulo = updateEscenarioDto.titulo.trim();
    }

    if (updateEscenarioDto.situacionTexto !== undefined) {
      payload.situacion_texto = updateEscenarioDto.situacionTexto.trim();
    }

    if (updateEscenarioDto.fondoCodigo !== undefined) {
      payload.fondo_codigo = updateEscenarioDto.fondoCodigo;
    }

    if (updateEscenarioDto.isFinal !== undefined) {
      payload.is_final = updateEscenarioDto.isFinal;
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    try {
      const [escenarioActualizado] = await this.postgrest.update<EscenarioRecord>(
        'escenarios',
        payload,
        {
          filters: { id: escenarioId },
          select: '*',
        },
      );

      if (!escenarioActualizado) {
        throw new NotFoundException('Escenario no encontrado.');
      }

      return this.toEscenario(escenarioActualizado);
    } catch (error) {
      this.rethrowConflict(error, 'Ya existe un escenario con ese orden en el caso.');
      throw error;
    }
  }

  async updateLayout(
    escenarioId: string,
    dto: UpdateEscenarioLayoutDto,
    currentUser: AuthenticatedUser,
  ) {
    this.assertDocenteRole(currentUser);
    const escenario = await this.findEscenarioById(escenarioId);
    const caso = await this.casosService.findCasoById(escenario.caso_id);

    this.casosService.assertCanAccessCasoDocente(caso, currentUser);
    this.assertCaseEditable(caso);

    const layout = normalizeLayout(
      {
        version: dto.version ?? 1,
        elements: dto.elements,
      },
      escenario,
    );

    const [escenarioActualizado] = await this.postgrest.update<EscenarioRecord>(
      'escenarios',
      {
        layout_version: layout.version,
        layout_data: layout,
      },
      {
        filters: { id: escenarioId },
        select: '*',
      },
    );

    if (!escenarioActualizado) {
      throw new NotFoundException('Escenario no encontrado.');
    }

    return this.toEscenario(escenarioActualizado);
  }

  async duplicate(
    escenarioId: string,
    currentUser: AuthenticatedUser,
  ): Promise<Escenario> {
    this.assertDocenteRole(currentUser);
    const escenario = await this.findEscenarioById(escenarioId);
    const caso = await this.casosService.findCasoById(escenario.caso_id);

    this.casosService.assertCanAccessCasoDocente(caso, currentUser);
    this.assertCaseEditable(caso);

    const escenarios = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: escenario.caso_id },
      order: 'orden.asc',
    });

    const nextOrder = Math.max(...escenarios.map((item) => item.orden), 0) + 1;

    const payload = {
      caso_id: escenario.caso_id,
      orden: nextOrder,
      titulo: `${escenario.titulo} (copia)`,
      situacion_texto: escenario.situacion_texto,
      fondo_codigo: escenario.fondo_codigo,
      is_final: escenario.is_final,
      layout_version: escenario.layout_version ?? 1,
      layout_data:
        escenario.layout_data ??
        normalizeLayout(null, escenario),
    };

    const created = await this.postgrest.insert<EscenarioRecord>('escenarios', payload, {
      select: '*',
    });

    return this.toEscenario(created);
  }

  async remove(
    casoId: string,
    escenarioId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{
    success: true;
    deletedScenarioId: string;
    remainingScenarios: Escenario[];
  }> {
    this.assertDocenteRole(currentUser);
    const escenario = await this.findEscenarioById(escenarioId);

    if (escenario.caso_id !== casoId) {
      throw new BadRequestException(
        'El escenario indicado no pertenece al caso seleccionado.',
      );
    }

    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    if (caso.estado === 'published') {
      throw new ConflictException(
        'No puedes eliminar escenas de un caso publicado. Crea una nueva versión o despublica el caso si el sistema lo permite.',
      );
    }

    if (caso.estado === 'archived') {
      throw new ConflictException(
        'No se permiten cambios en escenarios de un caso archivado.',
      );
    }

    const escenarios = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: casoId },
      order: 'orden.asc',
    });

    const sesiones = await this.postgrest.select<{ id: string }>('sesiones_simulacion', {
      filters: { caso_id: casoId },
      limit: 1,
    });

    if (sesiones.length > 0) {
      throw new ConflictException(
        'No se puede eliminar la escena porque el caso tiene sesiones registradas.',
      );
    }

    await this.postgrest.remove('escenarios', {
      filters: { id: escenarioId },
    });

    const remaining = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: casoId },
      order: 'orden.asc',
    });

    return {
      success: true,
      deletedScenarioId: escenarioId,
      remainingScenarios: remaining.map((item) => this.toEscenario(item)),
    };
  }

  async listByCaso(casoId: string, currentUser: AuthenticatedUser): Promise<Escenario[]> {
    this.assertDocenteRole(currentUser);
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    const escenarios = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: casoId },
      order: 'orden.asc',
    });

    return escenarios.map((escenario) => this.toEscenario(escenario));
  }

  private async findEscenarioById(escenarioId: string): Promise<EscenarioRecord> {
    const [escenario] = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { id: escenarioId },
      limit: 1,
    });

    if (!escenario) {
      throw new NotFoundException('Escenario no encontrado.');
    }

    return escenario;
  }

  private assertCaseEditable(caso: CasoRecord): void {
    if (caso.estado === 'archived') {
      throw new ConflictException(
        'No se permiten cambios en escenarios de un caso archivado.',
      );
    }
  }

  private assertBackgroundCode(code: string): void {
    if (!ALLOWED_BACKGROUND_CODES.includes(code as (typeof ALLOWED_BACKGROUND_CODES)[number])) {
      throw new BadRequestException('El fondoCodigo no pertenece al catalogo permitido.');
    }
  }

  private assertDocenteRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role === Role.PROFESOR || currentUser.role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenException(
      'Solo docentes o administradores pueden operar escenarios.',
    );
  }

  private async ensureUniqueOrder(casoId: string, orden: number): Promise<void> {
    const [existing] = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: casoId, orden },
      limit: 1,
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un escenario con ese orden en el caso.',
      );
    }
  }

  private toEscenario(record: EscenarioRecord): Escenario {
    return {
      id: record.id,
      casoId: record.caso_id,
      orden: record.orden,
      titulo: record.titulo,
      situacionTexto: record.situacion_texto,
      fondoCodigo: record.fondo_codigo,
      isFinal: record.is_final,
      layoutVersion: record.layout_version,
      layoutData: record.layout_data,
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
