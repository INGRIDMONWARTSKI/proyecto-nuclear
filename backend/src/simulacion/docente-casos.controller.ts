import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CasoEditorBuilderService } from './caso-editor-builder.service';
import { CasosService } from './casos.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { CreateRubricaCriterioDto } from './dto/create-rubrica-criterio.dto';
import { GenerateCasoIaDto } from './dto/generate-caso-ia.dto';
import { UpdateCasoDto } from './dto/update-caso.dto';
import { UpdateRubricaCriterioDto } from './dto/update-rubrica-criterio.dto';
import { GeneracionCasosIaService } from './generacion-casos-ia.service';
import { PublicacionService } from './publicacion.service';
import { RubricaService } from './rubrica.service';

@Controller('simulacion/docente/casos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PROFESOR)
export class DocenteCasosController {
  constructor(
    private readonly casosService: CasosService,
    private readonly generacionCasosIaService: GeneracionCasosIaService,
    private readonly casoEditorBuilder: CasoEditorBuilderService,
    private readonly publicacionService: PublicacionService,
    private readonly rubricaService: RubricaService,
  ) {}

  @Post()
  create(
    @Body() createCasoDto: CreateCasoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.casosService.create(createCasoDto, currentUser);
  }

  @Post('generar')
  generateWithIa(
    @Body() generateCasoIaDto: GenerateCasoIaDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.generacionCasosIaService.generarCaso(
      generateCasoIaDto,
      currentUser,
    );
  }

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.casosService.findAllDocente(currentUser);
  }

  @Get('biblioteca')
  findBiblioteca(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.casosService.findBibliotecaDocente(currentUser);
  }

  @Patch('rubrica/:criterioId')
  actualizarCriterioRubrica(
    @Param('criterioId') criterioId: string,
    @Body() dto: UpdateRubricaCriterioDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.rubricaService.actualizar(criterioId, dto, currentUser);
  }

  @Delete('rubrica/:criterioId')
  eliminarCriterioRubrica(
    @Param('criterioId') criterioId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.rubricaService.eliminar(criterioId, currentUser);
  }

  @Get(':casoId/rubrica')
  listarRubrica(@Param('casoId') casoId: string) {
    return this.rubricaService.listar(casoId);
  }

  @Post(':casoId/rubrica')
  crearCriterioRubrica(
    @Param('casoId') casoId: string,
    @Body() dto: CreateRubricaCriterioDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.rubricaService.crear(casoId, dto, currentUser);
  }

  @Get(':casoId')
  findOne(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.casosService.findOneDocente(casoId, currentUser);
  }

  @Get(':casoId/editor')
  async getEditor(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);
    const validationErrors =
      caso.estado === 'draft'
        ? await this.publicacionService.validateCaseCompletenessById(casoId)
        : [];
    return this.casoEditorBuilder.build(caso, validationErrors);
  }

  @Patch(':casoId')
  update(
    @Param('casoId') casoId: string,
    @Body() updateCasoDto: UpdateCasoDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.casosService.update(casoId, updateCasoDto, currentUser);
  }

  @Delete(':casoId')
  removeDraft(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.casosService.removeDraft(casoId, currentUser);
  }
}
