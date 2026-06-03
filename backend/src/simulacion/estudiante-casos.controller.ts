import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CasosService } from './casos.service';

@Controller('simulacion/estudiante/casos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ESTUDIANTE)
export class EstudianteCasosController {
  constructor(private readonly casosService: CasosService) {}

  @Get()
  findPublished(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.casosService.findPublishedForStudent(currentUser.sub);
  }
}
