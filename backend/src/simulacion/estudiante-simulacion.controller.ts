import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { normalizeLayout } from './editor-layout.util';
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    let sesion = await this.sesionesService.findSesionById(sesionId);
    this.sesionesService.assertSesionBelongsToStudent(sesion, currentUser);

    if (sesion.estado === 'in_progress') {
      sesion = await this.sesionesService.ensureSessionCompletedIfNoPending(sesion);
    }

    if (sesion.estado !== 'in_progress') {
      return {
        sesionId: sesion.id,
        casoId: sesion.caso_id,
        completed: true,
        progreso: {
          totalPreguntas: sesion.total_preguntas,
          respondidas: sesion.respondidas,
        },
      };
    }

    const pending = await this.sesionesService.findPendingScenarioForSession(sesion);

    if (!pending) {
      sesion = await this.sesionesService.ensureSessionCompletedIfNoPending(sesion);

      return {
        sesionId: sesion.id,
        casoId: sesion.caso_id,
        completed: true,
        progreso: {
          totalPreguntas: sesion.total_preguntas,
          respondidas: sesion.respondidas,
        },
      };
    }

    const elementos = await this.sesionesService.listElementosByEscenario(
      pending.escenario.id,
    );
    const opciones = await this.sesionesService.listOpcionesPublicasByPregunta(
      pending.pregunta.id,
    );
    const layout = normalizeLayout(
      pending.escenario.layout_data,
      pending.escenario,
      elementos,
    );

    return {
      sesionId: sesion.id,
      casoId: sesion.caso_id,
      escenario: {
        id: pending.escenario.id,
        orden: pending.escenario.orden,
        titulo: pending.escenario.titulo,
        situacionTexto: pending.escenario.situacion_texto,
        fondoCodigo: pending.escenario.fondo_codigo,
        layout,
        elementos: elementos.map((el) => ({
          id: el.id,
          tipo: el.tipo,
          assetCodigo: el.asset_codigo,
          textoContenido: el.texto_contenido,
          posX: el.pos_x,
          posY: el.pos_y,
          ancho: el.ancho,
          alto: el.alto,
          rotacion: el.rotacion,
          zIndex: el.z_index,
        })),
        pregunta: {
          id: pending.pregunta.id,
          enunciado: pending.pregunta.enunciado,
          tipo: pending.pregunta.tipo,
          opciones: opciones,
        },
      },
      progreso: {
        totalPreguntas: sesion.total_preguntas,
        respondidas: sesion.respondidas,
      },
    };
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
