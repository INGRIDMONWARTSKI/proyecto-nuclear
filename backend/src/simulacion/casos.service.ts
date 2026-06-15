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
import { UpdateCasoDto } from './dto/update-caso.dto';
import { CreateCasoDto } from './dto/create-caso.dto';
import { Caso, CasoRecord } from './entities/caso.entity';
import { Escenario, EscenarioRecord } from './entities/escenario.entity';

@Injectable()
export class CasosService {
  constructor(private readonly postgrest: PostgrestService) {}

  async create(
    createCasoDto: CreateCasoDto,
    currentUser: AuthenticatedUser,
  ): Promise<Caso> {
    this.assertDocenteRole(currentUser);

    const payload = {
      titulo: createCasoDto.titulo.trim(),
      descripcion: createCasoDto.descripcion?.trim() || null,
      objetivo_aprendizaje: createCasoDto.objetivoAprendizaje?.trim() || null,
      autor_docente_id: currentUser.sub,
      estado: 'draft' as const,
      is_active: true,
    };

    const casoCreado = await this.postgrest.insert<CasoRecord>('casos', payload, {
      select: '*',
    });

    return this.toCaso(casoCreado);
  }

  async findAllDocente(currentUser: AuthenticatedUser): Promise<Caso[]> {
    this.assertDocenteRole(currentUser);

    const filters =
      currentUser.role === Role.ADMIN ? undefined : { autor_docente_id: currentUser.sub };

    const casos = await this.postgrest.select<CasoRecord>('casos', {
      filters,
      order: 'created_at.desc',
    });

    return casos.map((caso) => this.toCaso(caso));
  }

  async findOneDocente(casoId: string, currentUser: AuthenticatedUser) {
    this.assertDocenteRole(currentUser);

    const caso = await this.findCasoById(casoId);
    this.assertCanAccessCasoDocente(caso, currentUser);

    const escenarios = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: casoId },
      order: 'orden.asc',
    });

    return {
      ...this.toCaso(caso),
      escenarios: escenarios.map((escenario) => this.toEscenario(escenario)),
    };
  }

  async update(
    casoId: string,
    updateCasoDto: UpdateCasoDto,
    currentUser: AuthenticatedUser,
  ): Promise<Caso> {
    this.assertDocenteRole(currentUser);

    const caso = await this.findCasoById(casoId);
    this.assertCanAccessCasoDocente(caso, currentUser);

    if (caso.estado === 'published') {
      throw new ConflictException(
        'No se permite editar un caso publicado en esta fase.',
      );
    }

    if (caso.estado === 'archived') {
      throw new ConflictException(
        'No se permite editar un caso archivado.',
      );
    }

    const payload: Record<string, string | boolean | null> = {};

    if (updateCasoDto.titulo !== undefined) {
      payload.titulo = updateCasoDto.titulo.trim();
    }

    if (updateCasoDto.descripcion !== undefined) {
      payload.descripcion = updateCasoDto.descripcion.trim() || null;
    }

    if (updateCasoDto.objetivoAprendizaje !== undefined) {
      payload.objetivo_aprendizaje =
        updateCasoDto.objetivoAprendizaje.trim() || null;
    }

    if (updateCasoDto.isActive !== undefined) {
      payload.is_active = updateCasoDto.isActive;
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    const [casoActualizado] = await this.postgrest.update<CasoRecord>(
      'casos',
      payload,
      {
        filters: { id: casoId },
        select: '*',
      },
    );

    if (!casoActualizado) {
      throw new NotFoundException('Caso no encontrado.');
    }

    return this.toCaso(casoActualizado);
  }

  async removeDraft(casoId: string, currentUser: AuthenticatedUser) {
    this.assertDocenteRole(currentUser);

    const caso = await this.findCasoById(casoId);
    this.assertCanAccessCasoDocente(caso, currentUser);

    if (caso.estado !== 'draft') {
      throw new ConflictException('Solo se pueden eliminar casos en borrador.');
    }

    const [sesion] = await this.postgrest.select<{ id: string }>(
      'sesiones_simulacion',
      {
        filters: { caso_id: casoId },
        select: 'id',
        limit: 1,
      },
    );

    if (sesion) {
      throw new ConflictException(
        'No se puede eliminar este borrador porque tiene sesiones o evidencias asociadas.',
      );
    }

    const [asignacion] = await this.postgrest.select<{ id: string }>(
      'caso_grupo',
      {
        filters: { casoId },
        select: 'id',
        limit: 1,
      },
    );

    if (asignacion) {
      throw new ConflictException(
        'No se puede eliminar este borrador porque tiene asignaciones asociadas.',
      );
    }

    await this.postgrest.remove('casos', {
      filters: { id: casoId },
    });

    return { message: 'Borrador eliminado correctamente.' };
  }

  async findPublishedForStudent(estudianteId: string): Promise<
    Array<{
      id: string;
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
      totalEscenarios: number;
      publishedAt: string | null;
      tieneReintentoAutorizado: boolean;
    }>
  > {
    const casoIds = await this.findCasoIdsAsignadosAEstudiante(estudianteId);

    if (casoIds.length === 0) {
      return [];
    }

    const casos = await this.postgrest.select<CasoRecord>('casos', {
      filters: {
        id: casoIds,
        estado: 'published',
        is_active: true,
      },
      order: 'published_at.desc',
    });

    const result: Array<{
      id: string;
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
      totalEscenarios: number;
      publishedAt: string | null;
      tieneReintentoAutorizado: boolean;
    }> = [];

    for (const caso of casos) {
      const escenarios = await this.postgrest.select<EscenarioRecord>('escenarios', {
        filters: { caso_id: caso.id },
      });
      const [reintento] = await this.postgrest.select<{ id: string }>(
        'reintentos_autorizados',
        {
          filters: {
            caso_id: caso.id,
            estudiante_id: estudianteId,
            usado: false,
          },
          select: 'id',
          limit: 1,
        },
      );

      result.push({
        id: caso.id,
        titulo: caso.titulo,
        descripcion: caso.descripcion,
        objetivoAprendizaje: caso.objetivo_aprendizaje,
        totalEscenarios: escenarios.length,
        publishedAt: caso.published_at,
        tieneReintentoAutorizado: Boolean(reintento),
      });
    }

    return result;
  }

  async findCasoIdsAsignadosAEstudiante(
    estudianteId: string,
  ): Promise<string[]> {
    const membresias = await this.postgrest.select<{ grupoId: string }>(
      'estudiante_grupo',
      { filters: { estudianteId } },
    );

    if (membresias.length === 0) {
      return [];
    }

    const grupoIds = [...new Set(membresias.map((item) => item.grupoId))];

    const asignaciones = await this.postgrest.select<{ casoId: string }>(
      'caso_grupo',
      { filters: { grupoId: grupoIds } },
    );

    return [...new Set(asignaciones.map((item) => item.casoId))];
  }

  async isCasoAsignadoAEstudiante(
    casoId: string,
    estudianteId: string,
  ): Promise<boolean> {
    const membresias = await this.postgrest.select<{ grupoId: string }>(
      'estudiante_grupo',
      { filters: { estudianteId } },
    );

    if (membresias.length === 0) {
      return false;
    }

    const grupoIds = [...new Set(membresias.map((item) => item.grupoId))];

    const asignaciones = await this.postgrest.select<{ casoId: string }>(
      'caso_grupo',
      { filters: { casoId, grupoId: grupoIds } },
    );

    return asignaciones.length > 0;
  }

  async findCasoById(casoId: string): Promise<CasoRecord> {
    const [caso] = await this.postgrest.select<CasoRecord>('casos', {
      filters: { id: casoId },
      limit: 1,
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado.');
    }

    return caso;
  }

  assertCanAccessCasoDocente(
    caso: CasoRecord,
    currentUser: AuthenticatedUser,
  ): void {
    if (currentUser.role === Role.ADMIN) {
      return;
    }

    if (
      currentUser.role === Role.PROFESOR &&
      caso.autor_docente_id === currentUser.sub
    ) {
      return;
    }

    throw new ForbiddenException('No tienes permisos para acceder a este caso.');
  }

  private assertDocenteRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role === Role.PROFESOR || currentUser.role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenException(
      'Solo docentes o administradores pueden operar casos.',
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
}
