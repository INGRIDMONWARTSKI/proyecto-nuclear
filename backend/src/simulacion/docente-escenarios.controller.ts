import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateEscenarioDto } from './dto/create-escenario.dto';
import { UpdateEscenarioLayoutDto } from './dto/update-escenario-layout.dto';
import { UpdateEscenarioDto } from './dto/update-escenario.dto';
import { EscenariosService } from './escenarios.service';

@Controller('simulacion/docente')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PROFESOR)
export class DocenteEscenariosController {
  constructor(private readonly escenariosService: EscenariosService) {}

  @Post('casos/:casoId/escenarios')
  create(
    @Param('casoId') casoId: string,
    @Body() createEscenarioDto: CreateEscenarioDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.escenariosService.create(casoId, createEscenarioDto, currentUser);
  }

  @Patch('escenarios/:escenarioId')
  update(
    @Param('escenarioId') escenarioId: string,
    @Body() updateEscenarioDto: UpdateEscenarioDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.escenariosService.update(
      escenarioId,
      updateEscenarioDto,
      currentUser,
    );
  }

  @Patch('escenarios/:escenarioId/layout')
  updateLayout(
    @Param('escenarioId') escenarioId: string,
    @Body() updateEscenarioLayoutDto: UpdateEscenarioLayoutDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.escenariosService.updateLayout(
      escenarioId,
      updateEscenarioLayoutDto,
      currentUser,
    );
  }

  @Post('escenarios/:escenarioId/duplicate')
  duplicate(
    @Param('escenarioId') escenarioId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.escenariosService.duplicate(escenarioId, currentUser);
  }

  @Delete('casos/:casoId/escenarios/:escenarioId')
  remove(
    @Param('casoId') casoId: string,
    @Param('escenarioId') escenarioId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.escenariosService.remove(casoId, escenarioId, currentUser);
  }

  @Get('casos/:casoId/escenarios')
  findByCaso(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.escenariosService.listByCaso(casoId, currentUser);
  }
}
