import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const usuario = await this.usuariosService.create(registerDto);
    return this.buildAuthResponse(usuario.id);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usuariosService.findByEmail(loginDto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    return this.buildAuthResponse(user.id);
  }

  async logout(currentUser: AuthenticatedUser) {
    await this.usuariosService.incrementTokenVersion(currentUser.sub);

    return {
      message: 'Sesion cerrada correctamente.',
    };
  }

  async me(currentUser: AuthenticatedUser) {
    const user = await this.usuariosService.findById(currentUser.sub);
    return this.usuariosService.sanitizeUser(user);
  }

  private async buildAuthResponse(userId: string) {
    const user = await this.usuariosService.findById(userId);

    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      tokenVersion: user.tokenVersion,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1d'),
      user: this.usuariosService.sanitizeUser(user),
    };
  }
}
