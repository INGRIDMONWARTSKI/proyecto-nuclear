import {
  Body,
  Controller,
  Delete,
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
import { CreateOpcionRespuestaDto } from './dto/create-opcion-respuesta.dto';
import { CreatePreguntaDecisionDto } from './dto/create-pregunta-decision.dto';
import { CreateRetroalimentacionDto } from './dto/create-retroalimentacion.dto';
import { UpdateOpcionRespuestaDto } from './dto/update-opcion-respuesta.dto';
import { UpdateRetroalimentacionDto } from './dto/update-retroalimentacion.dto';
import { DecisionesService } from './decisiones.service';
import { RetroalimentacionesService } from './retroalimentaciones.service';

@Controller('simulacion/docente')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PROFESOR)
export class DocenteDecisionesController {
  constructor(
    private readonly decisionesService: DecisionesService,
    private readonly retroalimentacionesService: RetroalimentacionesService,
  ) {}

  @Post('escenarios/:escenarioId/pregunta')
  createPregunta(
    @Param('escenarioId') escenarioId: string,
    @Body() dto: CreatePreguntaDecisionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.decisionesService.createPregunta(escenarioId, dto, currentUser);
  }

  @Post('preguntas/:preguntaId/opciones')
  createOpcion(
    @Param('preguntaId') preguntaId: string,
    @Body() dto: CreateOpcionRespuestaDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.decisionesService.createOpcion(preguntaId, dto, currentUser);
  }

  @Patch('opciones/:opcionId')
  updateOpcion(
    @Param('opcionId') opcionId: string,
    @Body() dto: UpdateOpcionRespuestaDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.decisionesService.updateOpcion(opcionId, dto, currentUser);
  }

  @Delete('opciones/:opcionId')
  removeOpcion(
    @Param('opcionId') opcionId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.decisionesService.removeOpcion(opcionId, currentUser);
  }

  @Post('opciones/:opcionId/retroalimentacion')
  createRetroalimentacion(
    @Param('opcionId') opcionId: string,
    @Body() dto: CreateRetroalimentacionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.retroalimentacionesService.create(opcionId, dto, currentUser);
  }

  @Patch('retroalimentaciones/:retroalimentacionId')
  updateRetroalimentacion(
    @Param('retroalimentacionId') retroalimentacionId: string,
    @Body() dto: UpdateRetroalimentacionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.retroalimentacionesService.update(
      retroalimentacionId,
      dto,
      currentUser,
    );
  }

  @Delete('retroalimentaciones/:retroalimentacionId')
  removeRetroalimentacion(
    @Param('retroalimentacionId') retroalimentacionId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.retroalimentacionesService.remove(
      retroalimentacionId,
      currentUser,
    );
  }
}
