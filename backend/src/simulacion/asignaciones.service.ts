import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Grupo } from '../grupos/entities/grupo.entity';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasosService } from './casos.service';
import { CreateAsignacionDto } from './dto/create-asignacion.dto';
import { CasoGrupo } from './entities/caso-grupo.entity';

@Injectable()
export class AsignacionesService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
  ) {}

  async assign(
    casoId: string,
    dto: CreateAsignacionDto,
    currentUser: AuthenticatedUser,
  ) {
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    if (caso.estado !== 'published') {
      throw new ConflictException(
        'Solo se pueden asignar casos publicados a grupos.',
      );
    }

    const grupoIds = [...new Set(dto.grupoIds)];

    // Validacion previa de todos los grupos antes de insertar.
    for (const grupoId of grupoIds) {
      const grupo = await this.findGrupoById(grupoId);
      this.assertCanManageGrupo(grupo, currentUser);
    }

    for (const grupoId of grupoIds) {
      const yaAsignado = await this.findAsignacion(casoId, grupoId);

      if (yaAsignado) {
        continue;
      }

      try {
        await this.postgrest.insert<CasoGrupo>(
          'caso_grupo',
          {
            casoId,
            grupoId,
            asignadoPor: currentUser.sub,
          },
          { select: '*' },
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('23505')) {
          continue;
        }
        throw error;
      }
    }

    return this.listGruposByCaso(casoId, currentUser);
  }

  async listGruposByCaso(casoId: string, currentUser: AuthenticatedUser) {
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    const asignaciones = await this.postgrest.select<CasoGrupo>('caso_grupo', {
      filters: { casoId },
      order: 'createdAt.asc',
    });

    if (asignaciones.length === 0) {
      return [];
    }

    const grupoIds = [...new Set(asignaciones.map((item) => item.grupoId))];
    const grupos = await this.postgrest.select<Grupo>('grupos', {
      filters: { id: grupoIds },
    });
    const grupoById = new Map(grupos.map((grupo) => [grupo.id, grupo]));

    return asignaciones.map((asignacion) => {
      const grupo = grupoById.get(asignacion.grupoId);
      return {
        grupoId: asignacion.grupoId,
        nombre: grupo?.nombre ?? null,
        isActive: grupo?.isActive ?? null,
        asignadoPor: asignacion.asignadoPor,
        createdAt: asignacion.createdAt,
      };
    });
  }

  async unassign(
    casoId: string,
    grupoId: string,
    currentUser: AuthenticatedUser,
  ) {
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    const grupo = await this.findGrupoById(grupoId);
    this.assertCanManageGrupo(grupo, currentUser);

    const asignacion = await this.findAsignacion(casoId, grupoId);

    if (!asignacion) {
      throw new NotFoundException(
        'El caso no está asignado a este grupo.',
      );
    }

    await this.postgrest.remove('caso_grupo', {
      filters: { id: asignacion.id },
    });

    return { message: 'Asignación eliminada correctamente.' };
  }

  private async findGrupoById(grupoId: string): Promise<Grupo> {
    const [grupo] = await this.postgrest.select<Grupo>('grupos', {
      filters: { id: grupoId },
      limit: 1,
    });

    if (!grupo) {
      throw new NotFoundException('Grupo no encontrado.');
    }

    return grupo;
  }

  private async findAsignacion(casoId: string, grupoId: string) {
    const [asignacion] = await this.postgrest.select<CasoGrupo>('caso_grupo', {
      filters: { casoId, grupoId },
      limit: 1,
    });

    return asignacion ?? null;
  }

  private assertCanManageGrupo(grupo: Grupo, currentUser: AuthenticatedUser) {
    if (currentUser.role === Role.ADMIN) {
      return;
    }

    if (
      currentUser.role === Role.PROFESOR &&
      grupo.profesorId === currentUser.sub
    ) {
      return;
    }

    throw new ForbiddenException(
      'No tienes permisos para asignar casos a este grupo.',
    );
  }
}
