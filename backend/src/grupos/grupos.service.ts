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
import type {
  ImportEstudianteItem,
  ImportarEstudiantesResponse,
} from './interfaces/importar-estudiantes.interface';
import type { UploadedImportFile } from './interfaces/uploaded-import-file.interface';
import { MailService } from '../mail/mail.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  isValidEmail,
  parseEstudiantesFile,
} from './utils/parse-estudiantes-file.util';

@Injectable()
export class GruposService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly usuariosService: UsuariosService,
    private readonly mailService: MailService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async create(crearGrupoDto: CrearGrupoDto, currentUser: AuthenticatedUser) {
    const profesorId = await this.resolveProfesorIdForCreate(
      crearGrupoDto.profesorId,
      currentUser,
    );

    try {
      const grupo = await this.postgrest.insert<Grupo>(
        'grupos',
        {
          nombre: crearGrupoDto.nombre,
          descripcion: crearGrupoDto.descripcion ?? null,
          semestre: crearGrupoDto.semestre ?? null,
          profesorId,
        },
        { select: '*' },
      );

      if (currentUser.role === Role.PROFESOR) {
        const profesor = await this.usuariosService.findById(currentUser.sub);
        await this.notificacionesService.crearParaAdmins({
          tipo: 'GRUPO_CREADO',
          titulo: 'Nuevo grupo creado',
          mensaje: `El docente ${profesor.fullName} creó la comunidad académica ${grupo.nombre}.`,
          entidad_tipo: 'GRUPO',
          entidad_id: grupo.id,
        });
      }

      return grupo;
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

  async importarEstudiantes(
    grupoId: string,
    file: UploadedImportFile,
    currentUser: AuthenticatedUser,
  ): Promise<ImportarEstudiantesResponse> {
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo para importar.');
    }

    const grupo = await this.findGrupoById(grupoId);
    this.assertCanManageGrupo(grupo, currentUser);

    if (!grupo.isActive) {
      throw new BadRequestException(
        'No se pueden importar estudiantes a un grupo inactivo.',
      );
    }

    const rows = parseEstudiantesFile(file.buffer, file.originalname);
    const response: ImportarEstudiantesResponse = {
      totalFilas: rows.length,
      creados: [],
      existentesAsignados: [],
      duplicados: [],
      errores: [],
      reporteCredenciales: [],
    };

    const emailsEnArchivo = new Set<string>();

    for (const row of rows) {
      const fullName = row.fullName.trim();
      const email = row.email.trim().toLowerCase();

      if (!fullName || !email) {
        response.errores.push({
          fullName: fullName || '(sin nombre)',
          email: email || '(sin correo)',
          estado: 'error',
          observacion: `Fila ${row.rowNumber}: nombre y correo son obligatorios.`,
        });
        continue;
      }

      if (fullName.length < 3) {
        response.errores.push({
          fullName,
          email,
          estado: 'error',
          observacion: `Fila ${row.rowNumber}: el nombre debe tener al menos 3 caracteres.`,
        });
        continue;
      }

      if (!isValidEmail(email)) {
        response.errores.push({
          fullName,
          email,
          estado: 'error',
          observacion: `Fila ${row.rowNumber}: correo con formato invalido.`,
        });
        continue;
      }

      if (emailsEnArchivo.has(email)) {
        response.duplicados.push({
          fullName,
          email,
          estado: 'duplicado',
          observacion: `Fila ${row.rowNumber}: correo repetido en el archivo.`,
        });
        continue;
      }

      emailsEnArchivo.add(email);

      try {
        await this.processImportRow({
          grupoId,
          fullName,
          email,
          rowNumber: row.rowNumber,
          response,
        });
      } catch (error) {
        response.errores.push({
          fullName,
          email,
          estado: 'error',
          observacion:
            error instanceof Error
              ? error.message
              : `Fila ${row.rowNumber}: no fue posible procesar la fila.`,
        });
      }
    }

    const cantidad =
      response.creados.length + response.existentesAsignados.length;

    if (cantidad > 0) {
      await this.notificacionesService.crearParaAdmins({
        tipo: 'ESTUDIANTES_IMPORTADOS',
        titulo: 'Estudiantes importados',
        mensaje: `Se importaron ${cantidad} estudiantes a la comunidad académica ${grupo.nombre}.`,
        entidad_tipo: 'GRUPO',
        entidad_id: grupo.id,
      });
    }

    return response;
  }

  private async processImportRow(params: {
    grupoId: string;
    fullName: string;
    email: string;
    rowNumber: number;
    response: ImportarEstudiantesResponse;
  }) {
    const { grupoId, fullName, email, rowNumber, response } = params;
    const existing = await this.usuariosService.findByEmail(email);

    if (existing) {
      if (existing.role !== Role.ESTUDIANTE) {
        response.errores.push({
          fullName,
          email,
          estado: 'error',
          observacion: `Fila ${rowNumber}: el correo pertenece a un usuario ${existing.role}.`,
        });
        return;
      }

      if (!existing.isActive) {
        response.errores.push({
          fullName,
          email,
          estado: 'error',
          observacion: `Fila ${rowNumber}: el estudiante existe pero esta inactivo.`,
        });
        return;
      }

      const yaAsignado = await this.findMembership(grupoId, existing.id);
      if (yaAsignado) {
        response.duplicados.push({
          fullName: existing.fullName,
          email,
          estado: 'duplicado',
          observacion: `Fila ${rowNumber}: el estudiante ya pertenece al grupo.`,
        });
        return;
      }

      await this.postgrest.insert<EstudianteGrupo>(
        'estudiante_grupo',
        {
          grupoId,
          estudianteId: existing.id,
        },
        { select: '*' },
      );

      const item: ImportEstudianteItem = {
        fullName: existing.fullName,
        email,
        estado: 'existente_asignado',
        observacion: `Fila ${rowNumber}: estudiante existente asignado al grupo.`,
      };
      response.existentesAsignados.push(item);
      return;
    }

    const { usuario: created, temporaryPassword } =
      await this.usuariosService.createEstudianteWithTemporaryPassword(
        fullName,
        email,
      );

    const correoEnviado = await this.mailService.sendWelcomeEmail(
      created.fullName,
      created.email,
      temporaryPassword,
    );

    await this.postgrest.insert<EstudianteGrupo>(
      'estudiante_grupo',
      {
        grupoId,
        estudianteId: created.id,
      },
      { select: '*' },
    );

    const item: ImportEstudianteItem = {
      fullName: created.fullName,
      email,
      estado: 'creado',
      observacion: correoEnviado
        ? `Fila ${rowNumber}: estudiante creado, asignado al grupo y correo enviado.`
        : `Fila ${rowNumber}: estudiante creado y asignado al grupo. No se pudo enviar el correo.`,
      correoEnviado,
      temporaryPassword: correoEnviado ? undefined : temporaryPassword,
    };

    response.creados.push(item);
    response.reporteCredenciales.push({
      fullName: created.fullName,
      email,
      temporaryPassword: correoEnviado ? 'Enviado por correo' : temporaryPassword,
      estado: 'creado',
      correoEnviado,
    });
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

    if (actualizarGrupoDto.semestre !== undefined) {
      payload.semestre = actualizarGrupoDto.semestre;
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
