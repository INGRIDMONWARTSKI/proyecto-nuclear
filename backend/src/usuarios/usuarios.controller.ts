import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { UsuariosService } from './usuarios.service';
import { MailService } from '../mail/mail.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Controller('usuarios')
@UseGuards(JwtAuthGuard)
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly mailService: MailService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: string) {
    const usuario = await this.usuariosService.findById(id);
    return this.usuariosService.sanitizeUser(usuario);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() crearUsuarioDto: CrearUsuarioDto) {
    const { usuario, temporaryPassword } =
      await this.usuariosService.createWithTemporaryPassword({
        fullName: crearUsuarioDto.fullName,
        email: crearUsuarioDto.email,
        role: crearUsuarioDto.role,
        puedeCrearCasos: crearUsuarioDto.puedeCrearCasos,
        password: crearUsuarioDto.password,
      });

    const emailSent = await this.mailService.sendWelcomeEmail(
      usuario.fullName,
      usuario.email,
      temporaryPassword,
    );

    if (usuario.role === Role.ESTUDIANTE) {
      await this.notificacionesService.crearParaAdmins({
        tipo: 'ESTUDIANTE_CREADO',
        titulo: 'Estudiante creado',
        mensaje: `Se creó la cuenta del estudiante ${usuario.fullName}.`,
        entidad_tipo: 'USUARIO',
        entidad_id: usuario.id,
      });
    }

    return {
      user: this.usuariosService.sanitizeUser(usuario),
      emailSent,
      temporaryPassword,
      ...(emailSent
        ? {}
        : {
            warning:
              'Usuario creado, pero no se pudo enviar el correo. Entrega la contraseña temporal manualmente.',
          }),
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() actualizarUsuarioDto: ActualizarUsuarioDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usuariosService.update(id, actualizarUsuarioDto, currentUser);
  }

  @Patch(':id/estado')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  cambiarEstado(
    @Param('id') id: string,
    @Body() cambiarEstadoDto: CambiarEstadoUsuarioDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usuariosService.setActivo(id, cambiarEstadoDto, currentUser);
  }
}
