import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PostgrestModule } from '../postgrest/postgrest.module';
import { AsignacionesService } from './asignaciones.service';
import { CasoPreviewBuilderService } from './caso-preview-builder.service';
import { CasosService } from './casos.service';
import { DocenteAsignacionesController } from './docente-asignaciones.controller';
import { DocenteCasosController } from './docente-casos.controller';
import { DocenteDecisionesController } from './docente-decisiones.controller';
import { DocenteEscenariosController } from './docente-escenarios.controller';
import { DocentePublicacionController } from './docente-publicacion.controller';
import { DocenteRevisionController } from './docente-revision.controller';
import { DecisionesService } from './decisiones.service';
import { EscenariosService } from './escenarios.service';
import { EstudianteCasosController } from './estudiante-casos.controller';
import {
  EstudianteHistorialController,
  EstudianteResultadosController,
} from './estudiante-resultados.controller';
import { EstudianteSimulacionController } from './estudiante-simulacion.controller';
import { GeminiService } from './gemini.service';
import { GeneracionCasosIaService } from './generacion-casos-ia.service';
import { PublicacionService } from './publicacion.service';
import { RespuestasEstudianteService } from './respuestas-estudiante.service';
import { ResultadosService } from './resultados.service';
import { RetroalimentacionesService } from './retroalimentaciones.service';
import { SesionesSimulacionService } from './sesiones-simulacion.service';

@Module({
  imports: [PostgrestModule],
  controllers: [
    DocenteCasosController,
    DocenteAsignacionesController,
    DocenteEscenariosController,
    DocenteDecisionesController,
    DocentePublicacionController,
    DocenteRevisionController,
    EstudianteCasosController,
    EstudianteSimulacionController,
    EstudianteResultadosController,
    EstudianteHistorialController,
  ],
  providers: [
    CasosService,
    AsignacionesService,
    CasoPreviewBuilderService,
    EscenariosService,
    DecisionesService,
    RetroalimentacionesService,
    PublicacionService,
    GeminiService,
    GeneracionCasosIaService,
    SesionesSimulacionService,
    RespuestasEstudianteService,
    ResultadosService,
    RolesGuard,
  ],
})
export class SimulacionModule {}
