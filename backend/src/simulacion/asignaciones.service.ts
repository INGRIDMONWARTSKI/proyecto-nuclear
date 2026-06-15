import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Grupo } from '../grupos/entities/grupo.entity';
import { EstudianteGrupo } from '../grupos/entities/estudiante-grupo.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PostgrestService } from '../postgrest/postgrest.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CasosService } from './casos.service';
import { CreateAsignacionDto } from './dto/create-asignacion.dto';
import { CasoGrupo } from './entities/caso-grupo.entity';
import { CasoRecord } from './entities/caso.entity';

@Injectable()
export class AsignacionesService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
    private readonly notificacionesService: NotificacionesService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async assign(
    casoId: string,
    dto: CreateAsignacionDto,
    currentUser: AuthenticatedUser,
  ) {
    const caso = await this.casosService.findCasoById(casoId);
    this.assertCanAssignCase(caso, currentUser);

    if (caso.estado !== 'published') {
      throw new ConflictException(
        'Solo se pueden asignar casos publicados a grupos.',
      );
    }

    const grupoIds = [...new Set(dto.grupoIds)];
    const gruposById = new Map<string, Grupo>();
    const gruposNotificados: Grupo[] = [];

    // Validacion previa de todos los grupos antes de insertar.
    for (const grupoId of grupoIds) {
      const grupo = await this.findGrupoById(grupoId);
      this.assertCanManageGrupo(grupo, currentUser);
      gruposById.set(grupoId, grupo);
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
        const grupo = gruposById.get(grupoId);
        if (grupo) {
          gruposNotificados.push(grupo);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('23505')) {
          continue;
        }
        throw error;
      }
    }

    await this.notificarCasoAsignado(caso.titulo, casoId, gruposNotificados);
    await this.notificarAdminsCasoAsignado(caso.titulo, casoId, gruposNotificados, currentUser);

    return this.listGruposByCaso(casoId, currentUser);
  }

  async listGruposByCaso(casoId: string, currentUser: AuthenticatedUser) {
    const caso = await this.casosService.findCasoById(casoId);
    this.assertCanAssignCase(caso, currentUser);

    const asignaciones = await this.postgrest.select<CasoGrupo>('caso_grupo', {
      filters: { casoId },
      order: 'createdAt.asc',
    });

    if (asignaciones.length === 0) {
      return [];
    }

    let filteredAsignaciones = asignaciones;
    if (currentUser.role === Role.PROFESOR) {
      const gruposDocente = await this.postgrest.select<Pick<Grupo, 'id'>>('grupos', {
        filters: {
          id: [...new Set(asignaciones.map((item) => item.grupoId))],
          profesorId: currentUser.sub,
        },
        select: 'id',
      });
      const grupoIdsDocente = new Set(gruposDocente.map((grupo) => grupo.id));
      filteredAsignaciones = asignaciones.filter((item) =>
        grupoIdsDocente.has(item.grupoId),
      );
    }

    const grupoIds = [...new Set(filteredAsignaciones.map((item) => item.grupoId))];
    if (grupoIds.length === 0) {
      return [];
    }
    const grupos = await this.postgrest.select<Grupo>('grupos', {
      filters: { id: grupoIds },
    });
    const grupoById = new Map(grupos.map((grupo) => [grupo.id, grupo]));

    return filteredAsignaciones.map((asignacion) => {
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
    this.assertCanAssignCase(caso, currentUser);

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

  private async notificarCasoAsignado(
    casoTitulo: string,
    casoId: string,
    grupos: Grupo[],
  ): Promise<void> {
    const estudiantesNotificados = new Set<string>();

    for (const grupo of grupos) {
      const membresias = await this.postgrest.select<EstudianteGrupo>(
        'estudiante_grupo',
        {
          filters: { grupoId: grupo.id },
        },
      );

      if (membresias.length === 0) {
        continue;
      }

      const estudianteIds = [
        ...new Set(
          membresias
            .map((membresia) => membresia.estudianteId)
            .filter((id) => !estudiantesNotificados.has(id)),
        ),
      ];

      if (estudianteIds.length === 0) {
        continue;
      }

      const estudiantes = await this.postgrest.select<Pick<Usuario, 'id'>>(
        'usuarios',
        {
          filters: {
            id: estudianteIds,
            role: Role.ESTUDIANTE,
            isActive: true,
          },
          select: 'id',
        },
      );

      for (const estudiante of estudiantes) {
        estudiantesNotificados.add(estudiante.id);
        await this.notificacionesService.crearParaUsuario(estudiante.id, {
          tipo: 'CASO_ASIGNADO',
          titulo: 'Nuevo caso asignado',
          mensaje: `El caso ${casoTitulo} fue asignado a tu comunidad académica ${grupo.nombre}.`,
          entidad_tipo: 'CASO',
          entidad_id: casoId,
        });
      }
    }
  }

  private async notificarAdminsCasoAsignado(
    casoTitulo: string,
    casoId: string,
    grupos: Grupo[],
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (grupos.length === 0 || currentUser.role !== Role.PROFESOR) {
      return;
    }

    const usuario = await this.usuariosService.findById(currentUser.sub);

    for (const grupo of grupos) {
      await this.notificacionesService.crearParaAdmins({
        tipo: 'CASO_ASIGNADO_GRUPO',
        titulo: 'Caso asignado a comunidad',
        mensaje: `El docente ${usuario.fullName} asignó el caso ${casoTitulo} a la comunidad académica ${grupo.nombre}.`,
        entidad_tipo: 'CASO',
        entidad_id: casoId,
      });
    }
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

  private assertCanAssignCase(
    caso: CasoRecord,
    currentUser: AuthenticatedUser,
  ): void {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.PROFESOR) {
      if (caso.estado === 'published') {
        return;
      }

      this.casosService.assertCanAccessCasoDocente(caso, currentUser);
      return;
    }

    throw new ForbiddenException(
      'No tienes permisos para gestionar asignaciones de casos.',
    );
  }
}
