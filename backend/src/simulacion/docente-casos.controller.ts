import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CasosService } from './casos.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { UpdateCasoDto } from './dto/update-caso.dto';

@Controller('simulacion/docente/casos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PROFESOR)
export class DocenteCasosController {
  constructor(private readonly casosService: CasosService) {}

  @Post()
  create(
    @Body() createCasoDto: CreateCasoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.casosService.create(createCasoDto, currentUser);
  }

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.casosService.findAllDocente(currentUser);
  }

  @Get(':casoId')
  findOne(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.casosService.findOneDocente(casoId, currentUser);
  }

  @Patch(':casoId')
  update(
    @Param('casoId') casoId: string,
    @Body() updateCasoDto: UpdateCasoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.casosService.update(casoId, updateCasoDto, currentUser);
  }
}
