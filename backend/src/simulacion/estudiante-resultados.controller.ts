import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';

import { CurrentUser } from '../common/decorators/current-user.decorator';

import { Roles } from '../common/decorators/roles.decorator';

import { Role } from '../common/enums/role.enum';

import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

import { ResultadosService } from './resultados.service';

import { SesionesSimulacionService } from './sesiones-simulacion.service';



@Controller('simulacion/estudiante/sesiones')

@UseGuards(JwtAuthGuard, RolesGuard)

@Roles(Role.ESTUDIANTE)

export class EstudianteResultadosController {

  constructor(private readonly resultadosService: ResultadosService) {}



  @Get(':sesionId/resultado')

  getResultado(

    @Param('sesionId') sesionId: string,

    @CurrentUser() currentUser: AuthenticatedUser,

  ) {

    return this.resultadosService.getResultado(sesionId, currentUser);

  }

}



@Controller('simulacion/estudiante')

@UseGuards(JwtAuthGuard, RolesGuard)

@Roles(Role.ESTUDIANTE)

export class EstudianteHistorialController {

  constructor(private readonly sesionesService: SesionesSimulacionService) {}



  @Get('historial')

  getHistorial(@CurrentUser() currentUser: AuthenticatedUser) {

    return this.sesionesService.findHistorialEstudiante(currentUser);

  }



  @Get('sesiones-activas')

  getSesionesActivas(@CurrentUser() currentUser: AuthenticatedUser) {

    return this.sesionesService.findSesionesActivasEstudiante(currentUser);

  }

}

