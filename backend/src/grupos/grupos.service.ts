import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { UsuarioSeguro } from '../usuarios/entities/usuario.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ActualizarGrupoDto } from './dto/actualizar-grupo.dto';
import { AsignarEstudiantesDto } from './dto/asignar-estudiantes.dto';
import { CrearGrupoDto } from './dto/crear-grupo.dto';
import { EstudianteGrupo } from './entities/estudiante-grupo.entity';
import { Grupo } from './entities/grupo.entity';

@Injectable()
export class GruposService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async create(crearGrupoDto: CrearGrupoDto, currentUser: AuthenticatedUser) {
    const profesorId = await this.resolveProfesorIdForCreate(
      crearGrupoDto.profesorId,
      currentUser,
    );

    try {
      return await this.postgrest.insert<Grupo>(
        'grupos',
        {
          nombre: crearGrupoDto.nombre,
          descripcion: crearGrupoDto.descripcion ?? null,
          profesorId,
        },
        { select: '*' },
      );
    } catch (error) {
      this.rethrowConflict(error, 'No fue posible crear el grupo.');
      throw error;
    }
  }

  async findAll(currentUser: AuthenticatedUser): Promise<Grupo[]> {
    if (currentUser.role === Role.ADMIN) {
      return this.postgrest.select<Grupo>('grupos', {
        order: 'createdAt.desc',
      });
    }

    if (currentUser.role === Role.PROFESOR) {
      return this.postgrest.select<Grupo>('grupos', {
        filters: {
          profesorId: currentUser.sub,
        },
        order: 'createdAt.desc',
      });
    }

    const membresias = await this.postgrest.select<EstudianteGrupo>(
      'estudiante_grupo',
      {
        filters: { estudianteId: currentUser.sub },
      },
    );

    if (membresias.length === 0) {
      return [];
    }

    const grupoIds = [...new Set(membresias.map((item) => item.grupoId))];

    const grupos = await this.postgrest.select<Grupo>('grupos', {
      filters: { id: grupoIds, isActive: true },
      order: 'createdAt.desc',
    });

    return grupos;
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const grupo = await this.findGrupoById(id);
    await this.assertCanViewGrupo(grupo, currentUser);
    return grupo;
  }

  async update(
    id: string,
    actualizarGrupoDto: ActualizarGrupoDto,
    currentUser: AuthenticatedUser,
  ) {
    const grupo = await this.findGrupoById(id);
    this.assertCanManageGrupo(grupo, currentUser);

    if (actualizarGrupoDto.profesorId !== undefined) {
      if (currentUser.role !== Role.ADMIN) {
        throw new ForbiddenException(
          'Solo un administrador puede reasignar el profesor del grupo.',
        );
      }

      await this.assertProfesorValido(actualizarGrupoDto.profesorId);
    }

    const payload = this.buildUpdatePayload(actualizarGrupoDto);

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    const [grupoActualizado] = await this.postgrest.update<Grupo>(
      'grupos',
      payload,
      {
        filters: { id },
        select: '*',
      },
    );

    return grupoActualizado;
  }

  async remove(id: string, currentUser: AuthenticatedUser) {
    const grupo = await this.findGrupoById(id);
    this.assertCanManageGrupo(grupo, currentUser);

    if (!grupo.isActive) {
      throw new BadRequestException('El grupo ya se encuentra desactivado.');
    }

    const [grupoDesactivado] = await this.postgrest.update<Grupo>(
      'grupos',
      { isActive: false },
      {
        filters: { id },
        select: '*',
      },
    );

    return {
      message: 'Grupo desactivado correctamente.',
      grupo: grupoDesactivado,
    };
  }

  async assignStudents(
    grupoId: string,
    asignarEstudiantesDto: AsignarEstudiantesDto,
    currentUser: AuthenticatedUser,
  ) {
    const grupo = await this.findGrupoById(grupoId);
    this.assertCanManageGrupo(grupo, currentUser);

    if (!grupo.isActive) {
      throw new BadRequestException(
        'No se pueden asignar estudiantes a un grupo inactivo.',
      );
    }

    const uniqueIds = [...new Set(asignarEstudiantesDto.estudianteIds)];

    for (const estudianteId of uniqueIds) {
      await this.assertEstudianteAsignable(estudianteId);

      const yaAsignado = await this.findMembership(grupoId, estudianteId);

      if (yaAsignado) {
        throw new ConflictException(
          'Uno o mas estudiantes ya pertenecen a este grupo.',
        );
      }

      try {
        await this.postgrest.insert<EstudianteGrupo>(
          'estudiante_grupo',
          {
            grupoId,
            estudianteId,
          },
          { select: '*' },
        );
      } catch (error) {
        this.rethrowConflict(
          error,
          'Uno o mas estudiantes ya pertenecen a este grupo.',
        );
        throw error;
      }
    }

    return this.listStudents(grupoId, currentUser);
  }

  async removeStudent(
    grupoId: string,
    estudianteId: string,
    currentUser: AuthenticatedUser,
  ) {
    const grupo = await this.findGrupoById(grupoId);
    this.assertCanManageGrupo(grupo, currentUser);

    const membresia = await this.findMembership(grupoId, estudianteId);

    if (!membresia) {
      throw new NotFoundException(
        'El estudiante no pertenece a este grupo.',
      );
    }

    await this.postgrest.remove('estudiante_grupo', {
      filters: { id: membresia.id },
    });

    return {
      message: 'Estudiante removido del grupo correctamente.',
    };
  }

  async listAvailableStudents(
    grupoId: string,
    currentUser: AuthenticatedUser,
  ): Promise<UsuarioSeguro[]> {
    const grupo = await this.findGrupoById(grupoId);
    this.assertCanManageGrupo(grupo, currentUser);

    const membresias = await this.postgrest.select<EstudianteGrupo>(
      'estudiante_grupo',
      {
        filters: { grupoId },
      },
    );

    const asignados = new Set(membresias.map((item) => item.estudianteId));
    const estudiantes = await this.usuariosService.findActiveStudents();

    return estudiantes.filter((estudiante) => !asignados.has(estudiante.id));
  }

  async listStudents(
    grupoId: string,
    currentUser: AuthenticatedUser,
  ): Promise<UsuarioSeguro[]> {
    const grupo = await this.findGrupoById(grupoId);
    await this.assertCanViewGrupo(grupo, currentUser);

    const membresias = await this.postgrest.select<EstudianteGrupo>(
      'estudiante_grupo',
      {
        filters: { grupoId },
        order: 'createdAt.asc',
      },
    );

    const estudiantes: UsuarioSeguro[] = [];

    for (const membresia of membresias) {
      const usuario = await this.usuariosService.findById(membresia.estudianteId);
      estudiantes.push(this.usuariosService.sanitizeUser(usuario));
    }

    return estudiantes;
  }

  private async resolveProfesorIdForCreate(
    profesorIdFromDto: string | undefined,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.role === Role.PROFESOR) {
      await this.assertProfesorValido(currentUser.sub);
      return currentUser.sub;
    }

    if (currentUser.role === Role.ADMIN) {
      if (!profesorIdFromDto) {
        throw new BadRequestException(
          'Debes indicar el profesor asociado al grupo.',
        );
      }

      await this.assertProfesorValido(profesorIdFromDto);
      return profesorIdFromDto;
    }

    throw new ForbiddenException(
      'No tienes permisos para crear grupos academicos.',
    );
  }

  private async assertProfesorValido(profesorId: string) {
    const profesor = await this.usuariosService.findById(profesorId);

    if (!profesor.isActive || profesor.role !== Role.PROFESOR) {
      throw new BadRequestException(
        'El profesor indicado no es valido o no esta activo.',
      );
    }
  }

  private async assertEstudianteAsignable(estudianteId: string) {
    const estudiante = await this.usuariosService.findById(estudianteId);

    if (!estudiante.isActive || estudiante.role !== Role.ESTUDIANTE) {
      throw new BadRequestException(
        'Solo usuarios activos con rol ESTUDIANTE pueden ser asignados.',
      );
    }
  }

  private async findGrupoById(id: string): Promise<Grupo> {
    const [grupo] = await this.postgrest.select<Grupo>('grupos', {
      filters: { id },
      limit: 1,
    });

    if (!grupo) {
      throw new NotFoundException('Grupo no encontrado.');
    }

    return grupo;
  }

  private async findMembership(grupoId: string, estudianteId: string) {
    const [membresia] = await this.postgrest.select<EstudianteGrupo>(
      'estudiante_grupo',
      {
        filters: { grupoId, estudianteId },
        limit: 1,
      },
    );

    return membresia ?? null;
  }

  private async isMember(grupoId: string, estudianteId: string) {
    return Boolean(await this.findMembership(grupoId, estudianteId));
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
      'No tienes permisos para administrar este grupo.',
    );
  }

  private async assertCanViewGrupo(
    grupo: Grupo,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.role === Role.ADMIN) {
      return;
    }

    if (
      currentUser.role === Role.PROFESOR &&
      grupo.profesorId === currentUser.sub
    ) {
      return;
    }

    if (currentUser.role === Role.ESTUDIANTE) {
      if (!grupo.isActive) {
        throw new NotFoundException('Grupo no encontrado.');
      }

      const member = await this.isMember(grupo.id, currentUser.sub);

      if (member) {
        return;
      }
    }

    throw new ForbiddenException(
      'No tienes permisos para ver este grupo.',
    );
  }

  private buildUpdatePayload(actualizarGrupoDto: ActualizarGrupoDto) {
    const payload: Record<string, string | boolean | null> = {};

    if (actualizarGrupoDto.nombre !== undefined) {
      payload.nombre = actualizarGrupoDto.nombre;
    }

    if (actualizarGrupoDto.descripcion !== undefined) {
      payload.descripcion = actualizarGrupoDto.descripcion;
    }

    if (actualizarGrupoDto.profesorId !== undefined) {
      payload.profesorId = actualizarGrupoDto.profesorId;
    }

    if (actualizarGrupoDto.isActive !== undefined) {
      payload.isActive = actualizarGrupoDto.isActive;
    }

    return payload;
  }

  private rethrowConflict(error: unknown, message: string) {
    if (error instanceof Error && error.message.includes('23505')) {
      throw new ConflictException(message);
    }
  }
}
