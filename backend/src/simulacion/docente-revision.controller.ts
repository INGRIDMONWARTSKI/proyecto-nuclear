import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ResultadosService } from './resultados.service';
import { SesionesSimulacionService } from './sesiones-simulacion.service';

@Controller('simulacion/docente')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PROFESOR)
export class DocenteRevisionController {
  constructor(
    private readonly sesionesService: SesionesSimulacionService,
    private readonly resultadosService: ResultadosService,
  ) {}

  @Get('evidencias')
  listEvidencias(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.sesionesService.findEvidenciasDocente(currentUser);
  }

  @Get('sesiones/:sesionId/revision')
  getRevision(
    @Param('sesionId') sesionId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.resultadosService.getRevisionDocente(sesionId, currentUser);
  }
}
