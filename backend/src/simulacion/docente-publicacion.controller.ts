import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PublicacionService } from './publicacion.service';
import { SesionesSimulacionService } from './sesiones-simulacion.service';

@Controller('simulacion/docente/casos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PROFESOR)
export class DocentePublicacionController {
  constructor(
    private readonly publicacionService: PublicacionService,
    private readonly sesionesService: SesionesSimulacionService,
  ) {}

  @Get(':casoId/preview')
  preview(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.publicacionService.preview(casoId, currentUser);
  }

  @Post(':casoId/publicar')
  publish(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.publicacionService.publish(casoId, currentUser);
  }

  @Get(':casoId/sesiones')
  evidencias(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.sesionesService.findEvidenciasByCaso(casoId, currentUser);
  }
}
