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

@Controller('usuarios')
@UseGuards(JwtAuthGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  async findOne(@Param('id') id: string) {
    const usuario = await this.usuariosService.findById(id);
    return this.usuariosService.sanitizeUser(usuario);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() crearUsuarioDto: CrearUsuarioDto) {
    const usuario = await this.usuariosService.create(crearUsuarioDto);
    return this.usuariosService.sanitizeUser(usuario);
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
