import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { MailService } from '../mail/mail.service';
import { PostgrestService } from '../postgrest/postgrest.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ChangeTemporaryPasswordDto } from './dto/change-temporary-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly postgrest: PostgrestService,
    private readonly mailService: MailService,
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

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const genericMessage =
      'Si el correo existe en el sistema, se generaron instrucciones para restablecer la contrasena.';

    const user = await this.usuariosService.findByEmail(forgotPasswordDto.email);

    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    await this.invalidateOutstandingResetTokens(user.id);

    const verificationCode = this.generateVerificationCode();
    const tokenHash = this.hashResetToken(verificationCode);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

    await this.postgrest.insert<PasswordResetToken>(
      'password_reset_tokens',
      {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      { select: '*' },
    );

    const emailSent = await this.mailService.sendPasswordResetEmail(
      user.email,
      verificationCode,
    );

    return {
      message: emailSent
        ? genericMessage
        : `${genericMessage} No fue posible enviar el codigo al correo en este momento.`,
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const code = resetPasswordDto.code.trim();
    const email = resetPasswordDto.email.trim();

    if (!code) {
      throw new BadRequestException('El codigo de recuperacion es obligatorio.');
    }

    const user = await this.usuariosService.findByEmail(email);

    if (!user || !user.isActive) {
      throw new BadRequestException(
        'El codigo de verificacion no es valido o ya expiro.',
      );
    }

    const tokenRecord = await this.findValidResetToken(user.id, code);

    if (!tokenRecord) {
      throw new BadRequestException(
        'El codigo de verificacion no es valido o ya expiro.',
      );
    }

    await this.usuariosService.updatePassword(user.id, resetPasswordDto.newPassword);

    await this.postgrest.update<PasswordResetToken>(
      'password_reset_tokens',
      {
        consumedAt: new Date().toISOString(),
      },
      {
        filters: { id: tokenRecord.id },
        select: 'id',
      },
    );

    await this.invalidateOutstandingResetTokens(user.id);

    return {
      message: 'Contrasena restablecida correctamente.',
    };
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

  async changeTemporaryPassword(
    currentUser: AuthenticatedUser,
    dto: ChangeTemporaryPasswordDto,
  ) {
    const user = await this.usuariosService.findById(currentUser.sub);

    if (!user.isActive) {
      throw new ForbiddenException('Tu cuenta no esta activa.');
    }

    if (!user.mustChangePassword) {
      throw new BadRequestException(
        'Tu cuenta no requiere cambio de contraseña inicial.',
      );
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden.');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta a la temporal.',
      );
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException('La contraseña temporal no es valida.');
    }

    await this.usuariosService.updatePassword(user.id, dto.newPassword);

    return this.buildAuthResponse(user.id);
  }

  private async buildAuthResponse(userId: string) {
    const user = await this.usuariosService.findById(userId);
    const sanitized = this.usuariosService.sanitizeUser(user);

    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      tokenVersion: user.tokenVersion,
      puedeCrearCasos: user.puedeCrearCasos,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1d'),
      user: sanitized,
      mustChangePassword: sanitized.mustChangePassword,
    };
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async findValidResetToken(
    userId: string,
    rawToken: string,
  ): Promise<PasswordResetToken | null> {
    const tokenHash = this.hashResetToken(rawToken);
    const tokens = await this.postgrest.select<PasswordResetToken>(
      'password_reset_tokens',
      {
        filters: { userId, tokenHash },
        order: 'createdAt.desc',
      },
    );

    const token = tokens.find(
      (item) =>
        !item.consumedAt &&
        new Date(item.expiresAt).getTime() > Date.now(),
    );

    return token ?? null;
  }

  private generateVerificationCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private async invalidateOutstandingResetTokens(userId: string): Promise<void> {
    const activeTokens = await this.postgrest.select<PasswordResetToken>(
      'password_reset_tokens',
      {
        filters: { userId },
      },
    );

    const pendientes = activeTokens.filter((item) => !item.consumedAt);

    if (pendientes.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    await this.postgrest.update<PasswordResetToken>(
      'password_reset_tokens',
      {
        consumedAt: now,
      },
      {
        filters: { id: pendientes.map((item) => item.id) },
        select: 'id',
      },
    );
  }
}
