import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PostgrestService } from '../postgrest/postgrest.service';
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

    const passwordHash = await bcrypt.hash(crearUsuarioDto.password, 10);

    try {
      return await this.postgrest.insert<Usuario>(
        'usuarios',
        {
          fullName: crearUsuarioDto.fullName,
          email: crearUsuarioDto.email,
          passwordHash,
          role: crearUsuarioDto.role,
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

  async findAll(): Promise<UsuarioSeguro[]> {
    const usuarios = await this.postgrest.select<Usuario>('usuarios', {
      order: 'createdAt.desc',
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

  sanitizeUser(usuario: Usuario): UsuarioSeguro {
    const { passwordHash, ...usuarioSeguro } = usuario;
    return usuarioSeguro;
  }

  private rethrowConflict(error: unknown) {
    if (error instanceof Error && error.message.includes('23505')) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }
  }
}
