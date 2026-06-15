import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import { generateTemporaryPassword } from '../common/utils/generate-temporary-password.util';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { Usuario, UsuarioSeguro } from './entities/usuario.entity';

@Injectable()
export class UsuariosService {
  constructor(private readonly postgrest: PostgrestService) {}

  async create(crearUsuarioDto: CrearUsuarioDto): Promise<Usuario> {
    const usuarioExistente = await this.findByEmail(crearUsuarioDto.email);

    if (usuarioExistente) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    if (!crearUsuarioDto.password) {
      throw new BadRequestException('La contraseña es obligatoria.');
    }

    const passwordHash = await bcrypt.hash(crearUsuarioDto.password, 10);

    try {
      return await this.postgrest.insert<Usuario>(
        'usuarios',
        {
          fullName: crearUsuarioDto.fullName.trim(),
          email: crearUsuarioDto.email.trim().toLowerCase(),
          passwordHash,
          role: crearUsuarioDto.role,
          puedeCrearCasos: this.resolvePuedeCrearCasos(
            crearUsuarioDto.role,
            crearUsuarioDto.puedeCrearCasos,
          ),
          mustChangePassword: false,
        },
        {
          select: '*',
        },
      );
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
  }

  async createWithTemporaryPassword(params: {
    fullName: string;
    email: string;
    role: Role;
    puedeCrearCasos?: boolean;
  }): Promise<{ usuario: Usuario; temporaryPassword: string }> {
    const usuarioExistente = await this.findByEmail(params.email);

    if (usuarioExistente) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    try {
      const usuario = await this.postgrest.insert<Usuario>(
        'usuarios',
        {
          fullName: params.fullName.trim(),
          email: params.email.trim().toLowerCase(),
          passwordHash,
          role: params.role,
          puedeCrearCasos: this.resolvePuedeCrearCasos(
            params.role,
            params.puedeCrearCasos,
          ),
          mustChangePassword: true,
        },
        {
          select: '*',
        },
      );

      return { usuario, temporaryPassword };
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
  }

  async createEstudiante(
    fullName: string,
    email: string,
    password: string,
  ): Promise<Usuario> {
    return this.create({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: Role.ESTUDIANTE,
    });
  }

  async createEstudianteWithTemporaryPassword(
    fullName: string,
    email: string,
  ): Promise<{ usuario: Usuario; temporaryPassword: string }> {
    return this.createWithTemporaryPassword({
      fullName,
      email,
      role: Role.ESTUDIANTE,
    });
  }

  async update(
    id: string,
    actualizarUsuarioDto: ActualizarUsuarioDto,
    currentUser: AuthenticatedUser,
  ): Promise<UsuarioSeguro> {
    const usuario = await this.findById(id);

    const payload: Partial<Pick<Usuario, 'fullName' | 'role' | 'puedeCrearCasos'>> =
      {};

    if (actualizarUsuarioDto.fullName !== undefined) {
      payload.fullName = actualizarUsuarioDto.fullName.trim();
    }

    let roleChanged = false;

    if (
      actualizarUsuarioDto.role !== undefined &&
      actualizarUsuarioDto.role !== usuario.role
    ) {
      if (
        currentUser.sub === id &&
        usuario.role === Role.ADMIN &&
        actualizarUsuarioDto.role !== Role.ADMIN
      ) {
        throw new ForbiddenException(
          'Un administrador no puede quitarse su propio rol ADMIN.',
        );
      }

      payload.role = actualizarUsuarioDto.role;
      roleChanged = true;
    }

    const nextRole = payload.role ?? usuario.role;
    const shouldEvaluatePuedeCrearCasos =
      actualizarUsuarioDto.puedeCrearCasos !== undefined || roleChanged;

    if (shouldEvaluatePuedeCrearCasos) {
      const nextPuedeCrearCasos = this.resolvePuedeCrearCasos(
        nextRole,
        actualizarUsuarioDto.puedeCrearCasos,
        usuario.puedeCrearCasos,
      );
      if (nextPuedeCrearCasos !== usuario.puedeCrearCasos) {
        payload.puedeCrearCasos = nextPuedeCrearCasos;
      }
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No se enviaron campos para actualizar.');
    }

    const [usuarioActualizado] = await this.postgrest.update<Usuario>(
      'usuarios',
      payload,
      {
        filters: { id },
        select: '*',
      },
    );

    if (!usuarioActualizado) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (roleChanged || payload.puedeCrearCasos !== undefined) {
      await this.incrementTokenVersion(id);
    }

    return this.sanitizeUser(usuarioActualizado);
  }

  async setActivo(
    id: string,
    cambiarEstadoDto: CambiarEstadoUsuarioDto,
    currentUser: AuthenticatedUser,
  ): Promise<UsuarioSeguro> {
    const usuario = await this.findById(id);

    if (currentUser.sub === id && cambiarEstadoDto.isActive === false) {
      throw new ForbiddenException('No puedes archivar tu propia cuenta.');
    }

    if (
      cambiarEstadoDto.isActive === false &&
      usuario.role === Role.ADMIN
    ) {
      const adminsActivos = await this.postgrest.select<Usuario>('usuarios', {
        filters: { role: Role.ADMIN, isActive: true },
      });

      if (adminsActivos.length <= 1 && adminsActivos.some((admin) => admin.id === id)) {
        throw new ForbiddenException(
          'Debe existir al menos un administrador activo.',
        );
      }
    }

    const estadoCambia = usuario.isActive !== cambiarEstadoDto.isActive;

    const [usuarioActualizado] = await this.postgrest.update<Usuario>(
      'usuarios',
      { isActive: cambiarEstadoDto.isActive },
      {
        filters: { id },
        select: '*',
      },
    );

    if (!usuarioActualizado) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (estadoCambia) {
      await this.incrementTokenVersion(id);
    }

    return this.sanitizeUser(usuarioActualizado);
  }

  async findAll(): Promise<UsuarioSeguro[]> {
    const usuarios = await this.postgrest.select<Usuario>('usuarios', {
      order: 'createdAt.desc',
    });

    return usuarios.map((usuario) => this.sanitizeUser(usuario));
  }

  async findActiveStudents(): Promise<UsuarioSeguro[]> {
    const usuarios = await this.postgrest.select<Usuario>('usuarios', {
      filters: { role: Role.ESTUDIANTE, isActive: true },
      order: 'fullName.asc',
    });

    return usuarios.map((usuario) => this.sanitizeUser(usuario));
  }

  async findById(id: string): Promise<Usuario> {
    const [usuario] = await this.postgrest.select<Usuario>('usuarios', {
      filters: { id },
      limit: 1,
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return usuario;
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    const [usuario] = await this.postgrest.select<Usuario>('usuarios', {
      filters: { email },
      limit: 1,
    });

    return usuario ?? null;
  }

  async incrementTokenVersion(id: string): Promise<void> {
    const usuario = await this.findById(id);

    await this.postgrest.update<Usuario>(
      'usuarios',
      {
        tokenVersion: usuario.tokenVersion + 1,
      },
      {
        filters: { id },
        select: 'id',
      },
    );
  }

  async updatePassword(id: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await this.findById(id);

    await this.postgrest.update<Usuario>(
      'usuarios',
      {
        passwordHash,
        mustChangePassword: false,
        tokenVersion: usuario.tokenVersion + 1,
      },
      {
        filters: { id },
        select: 'id',
      },
    );
  }

  sanitizeUser(usuario: Usuario): UsuarioSeguro {
    const { passwordHash, ...usuarioSeguro } = usuario;
    return usuarioSeguro;
  }

  private rethrowConflict(error: unknown) {
    if (error instanceof Error && error.message.includes('23505')) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }
  }

  private resolvePuedeCrearCasos(
    role: Role,
    requested?: boolean,
    current?: boolean,
  ): boolean {
    if (role === Role.ADMIN) {
      return true;
    }

    if (role !== Role.PROFESOR) {
      return false;
    }

    if (requested !== undefined) {
      return requested;
    }

    if (current !== undefined) {
      return current;
    }

    return true;
  }
}
