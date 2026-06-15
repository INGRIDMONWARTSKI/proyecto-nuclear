import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { StartSesionSimulacionDto } from './dto/start-sesion-simulacion.dto';
import { SubmitRespuestaDto } from './dto/submit-respuesta.dto';
import { RespuestasEstudianteService } from './respuestas-estudiante.service';
import { SesionesSimulacionService } from './sesiones-simulacion.service';

@Controller('simulacion/estudiante/sesiones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ESTUDIANTE)
export class EstudianteSimulacionController {
  constructor(
    private readonly sesionesService: SesionesSimulacionService,
    private readonly respuestasService: RespuestasEstudianteService,
  ) {}

  @Post()
  start(
    @Body() dto: StartSesionSimulacionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.sesionesService.start(dto, currentUser);
  }

  @Get(':sesionId/escenario-actual')
  async getEscenarioActual(
    @Param('sesionId') sesionId: string,
    @Query('preguntaId') preguntaId: string | undefined,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<unknown> {
    const sesion = await this.sesionesService.findSesionById(sesionId);
    this.sesionesService.assertSesionBelongsToStudent(sesion, currentUser);
    return this.sesionesService.buildPlayerState(sesion, preguntaId);
  }

  @Post(':sesionId/respuestas')
  submitRespuesta(
    @Param('sesionId') sesionId: string,
    @Body() dto: SubmitRespuestaDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.respuestasService.submit(sesionId, dto, currentUser);
  }

  @Post(':sesionId/finalizar')
  finalize(
    @Param('sesionId') sesionId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.sesionesService.finalize(sesionId, currentUser);
  }
}
