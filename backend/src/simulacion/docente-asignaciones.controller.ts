import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AsignacionesService } from './asignaciones.service';
import { CreateAsignacionDto } from './dto/create-asignacion.dto';

@Controller('simulacion/docente/casos/:casoId/grupos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PROFESOR)
export class DocenteAsignacionesController {
  constructor(private readonly asignacionesService: AsignacionesService) {}

  @Post()
  assign(
    @Param('casoId') casoId: string,
    @Body() dto: CreateAsignacionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.asignacionesService.assign(casoId, dto, currentUser);
  }

  @Get()
  list(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.asignacionesService.listGruposByCaso(casoId, currentUser);
  }

  @Delete(':grupoId')
  unassign(
    @Param('casoId') casoId: string,
    @Param('grupoId') grupoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.asignacionesService.unassign(casoId, grupoId, currentUser);
  }
}
