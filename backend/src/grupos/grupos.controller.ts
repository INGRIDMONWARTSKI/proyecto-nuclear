import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ActualizarGrupoDto } from './dto/actualizar-grupo.dto';
import { AsignarEstudiantesDto } from './dto/asignar-estudiantes.dto';
import { CrearGrupoDto } from './dto/crear-grupo.dto';
import { GruposService } from './grupos.service';
import type { UploadedImportFile } from './interfaces/uploaded-import-file.interface';

@Controller('grupos')
@UseGuards(JwtAuthGuard)
export class GruposController {
  constructor(private readonly gruposService: GruposService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  create(
    @Body() crearGrupoDto: CrearGrupoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.gruposService.create(crearGrupoDto, currentUser);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  findAll(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.gruposService.findAll(currentUser);
  }

  @Get(':id/estudiantes')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  listStudents(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.gruposService.listStudents(id, currentUser);
  }

  @Get(':id/estudiantes-disponibles')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  listAvailableStudents(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.gruposService.listAvailableStudents(id, currentUser);
  }

  @Post(':id/estudiantes')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  assignStudents(
    @Param('id') id: string,
    @Body() asignarEstudiantesDto: AsignarEstudiantesDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.gruposService.assignStudents(
      id,
      asignarEstudiantesDto,
      currentUser,
    );
  }

  @Post(':id/importar-estudiantes')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  importarEstudiantes(
    @Param('id') id: string,
    @UploadedFile() file: UploadedImportFile,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.gruposService.importarEstudiantes(id, file, currentUser);
  }

  @Delete(':id/estudiantes/:estudianteId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  removeStudent(
    @Param('id') id: string,
    @Param('estudianteId') estudianteId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.gruposService.removeStudent(id, estudianteId, currentUser);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.gruposService.findOne(id, currentUser);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  update(
    @Param('id') id: string,
    @Body() actualizarGrupoDto: ActualizarGrupoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.gruposService.update(id, actualizarGrupoDto, currentUser);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.PROFESOR)
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.gruposService.remove(id, currentUser);
  }
}
