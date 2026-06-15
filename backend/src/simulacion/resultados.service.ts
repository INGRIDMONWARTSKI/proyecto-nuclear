import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PostgrestService } from '../postgrest/postgrest.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { OpcionRespuestaRecord } from './entities/opcion-respuesta.entity';
import { PreguntaDecisionRecord } from './entities/pregunta-decision.entity';
import { RespuestaEstudianteRecord } from './entities/respuesta-estudiante.entity';
import { ResultadoSimulacion } from './entities/resultado-simulacion.entity';
import { RevisionSesionDocente } from './entities/revision-sesion-docente.entity';
import { RubricaCriterioRecord } from './entities/rubrica-criterio.entity';
import { SesionSimulacionRecord } from './entities/sesion-simulacion.entity';
import { SesionesSimulacionService } from './sesiones-simulacion.service';

interface CasoTitleRecord {
  id: string;
  titulo: string;
}

@Injectable()
export class ResultadosService {
  constructor(
    private readonly postgrest: PostgrestService,
    private readonly sesionesService: SesionesSimulacionService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async getResultado(
    sesionId: string,
    currentUser: AuthenticatedUser,
  ): Promise<ResultadoSimulacion> {
    this.assertStudentRole(currentUser);

    const sesion = await this.sesionesService.findSesionById(sesionId);
    this.sesionesService.assertSesionBelongsToStudent(sesion, currentUser);

    if (sesion.estado !== 'completed') {
      throw new ConflictException(
        'La sesion debe estar finalizada para consultar el resultado.',
      );
    }

    const caso = await this.findCasoTitle(sesion.caso_id);
    return this.buildResultado(sesion, caso);
  }

  async getRevisionDocente(
    sesionId: string,
    currentUser: AuthenticatedUser,
  ): Promise<RevisionSesionDocente> {
    this.assertDocenteRole(currentUser);

    const sesion = await this.sesionesService.findSesionById(sesionId);
    await this.sesionesService.assertDocenteCanReviewSesion(sesion, currentUser);

    const caso = await this.findCasoTitle(sesion.caso_id);
    const [estudiante] = await this.postgrest.select<
      Pick<Usuario, 'id' | 'fullName' | 'email'>
    >('usuarios', {
      filters: { id: sesion.estudiante_id },
      limit: 1,
    });

    if (!estudiante) {
      throw new NotFoundException('Estudiante no encontrado para la sesion.');
    }

    const resultado = await this.buildResultado(sesion, caso);

    return {
      ...resultado,
      estudiante: {
        id: estudiante.id,
        nombre: estudiante.fullName,
        email: estudiante.email,
      },
      fechaInicio: sesion.started_at,
      fechaFinalizacion: sesion.finished_at,
    };
  }

  async guardarRetroalimentacionDocente(
    sesionId: string,
    mensaje: string,
    currentUser: AuthenticatedUser,
  ): Promise<RevisionSesionDocente> {
    this.assertDocenteRole(currentUser);
    const sesion = await this.sesionesService.findSesionById(sesionId);
    await this.sesionesService.assertDocenteCanReviewSesion(sesion, currentUser);

    if (sesion.estado !== 'completed') {
      throw new ConflictException(
        'Solo puedes retroalimentar una participacion finalizada.',
      );
    }

    const texto = mensaje?.trim();
    if (!texto || texto.length < 5) {
      throw new BadRequestException(
        'Escribe una retroalimentacion general para orientar al estudiante.',
      );
    }

    await this.postgrest.update<SesionSimulacionRecord>(
      'sesiones_simulacion',
      {
        retroalimentacion_docente_general: texto,
        retroalimentacion_docente_at: new Date().toISOString(),
        retroalimentacion_docente_by: currentUser.sub,
      },
      { filters: { id: sesion.id }, select: 'id' },
    );

    const caso = await this.findCasoTitle(sesion.caso_id);
    await this.notificacionesService.crearParaUsuario(sesion.estudiante_id, {
      tipo: 'FEEDBACK_DOCENTE',
      titulo: 'Retroalimentacion docente',
      mensaje: `Tu docente agrego una retroalimentacion general a tu participacion en el caso ${caso.titulo}.`,
      entidad_tipo: 'SESION',
      entidad_id: sesion.id,
    });

    return this.getRevisionDocente(sesionId, currentUser);
  }

  async buildReporteSesionCsv(
    sesionId: string,
    currentUser: AuthenticatedUser,
  ): Promise<string> {
    const revision = await this.getRevisionDocente(sesionId, currentUser);
    const rows: string[][] = [
      ['Reporte individual de participacion'],
      ['Caso', revision.caso.titulo],
      ['Estudiante', revision.estudiante.nombre],
      ['Correo', revision.estudiante.email],
      ['Estado', 'completed'],
      ['Fecha inicio', revision.fechaInicio],
      ['Fecha finalizacion', revision.fechaFinalizacion ?? ''],
      ['Tipo de finalizacion', revision.finalizacionTipo ?? ''],
      ['Nota final', String(revision.puntajeTotal)],
      ['Nota maxima', String(revision.puntajeMaximo)],
      ['Preguntas totales', String(revision.totalPreguntas)],
      ['Respondidas', String(revision.respondidas)],
      ['No respondidas', String(revision.noRespondidas)],
      ['Acertadas', String(revision.respuestasAcertadas)],
      ['Parciales', String(revision.respuestasParciales)],
      ['Fallidas', String(revision.respuestasFallidas)],
      ['Retroalimentacion general docente', revision.retroalimentacionDocenteGeneral ?? ''],
      [],
      ['Rubrica de calificacion'],
      ['Orden', 'Criterio', 'Descripcion', 'Nivel esperado', 'Peso'],
      ...revision.rubrica.map((criterio) => [
        String(criterio.orden),
        criterio.criterio,
        criterio.descripcion,
        criterio.nivelEsperado ?? '',
        criterio.peso !== null ? String(criterio.peso) : '',
      ]),
      [],
      ['Detalle de respuestas'],
      [
        'Escenario',
        'Pregunta',
        'Respuesta seleccionada',
        'Nota obtenida',
        'Tipo respuesta',
        'Retroalimentacion',
      ],
      ...revision.respuestas.map((respuesta) => [
        `${respuesta.escenarioOrden}. ${respuesta.escenarioTitulo}`,
        respuesta.pregunta,
        respuesta.opcionSeleccionada,
        String(respuesta.puntajeObtenido),
        respuesta.tipoRespuesta,
        respuesta.retroalimentacion ?? '',
      ]),
    ];

    return `\uFEFF${rows.map((row) => row.map((cell) => this.csvCell(cell)).join(';')).join('\r\n')}`;
  }

  private async buildResultado(
    sesion: SesionSimulacionRecord,
    caso: CasoTitleRecord,
  ): Promise<ResultadoSimulacion> {
    const escenarios = await this.postgrest.select<{
      id: string;
      orden: number;
      titulo: string;
    }>('escenarios', {
      filters: { caso_id: sesion.caso_id },
    });
    const escenariosById = new Map(
      escenarios.map((escenario) => [escenario.id, escenario]),
    );

    const preguntas = await this.postgrest.select<PreguntaDecisionRecord>(
      'preguntas_decision',
      { filters: { escenario_id: escenarios.map((e) => e.id) } },
    );

    const opciones =
      preguntas.length > 0
        ? await this.postgrest.select<OpcionRespuestaRecord>('opciones_respuesta', {
            filters: { pregunta_id: preguntas.map((p) => p.id) },
          })
        : [];

    const respuestas = await this.postgrest.select<RespuestaEstudianteRecord>(
      'respuestas_estudiante',
      {
        filters: { sesion_id: sesion.id },
        order: 'respondida_at.asc',
      },
    );

    const rubrica = await this.postgrest.select<RubricaCriterioRecord>(
      'rubrica_criterios',
      {
        filters: { caso_id: caso.id },
        order: 'orden.asc',
      },
    );

    const puntajeMaximo = 5;
    const totalPreguntas = sesion.total_preguntas || preguntas.length;
    const puntajeTotalNormalizado = this.normalizePuntajeTotal(
      sesion.puntaje_total,
      totalPreguntas,
    );
    const notaFinal =
      totalPreguntas > 0
        ? this.roundNota(puntajeTotalNormalizado / totalPreguntas)
        : 0;
    const porcentaje =
      puntajeMaximo > 0
        ? Number(((notaFinal / puntajeMaximo) * 100).toFixed(2))
        : 0;

    const nivel = this.computeNivel(porcentaje);
    const resumen = this.buildResumen(nivel);
    const opcionesById = new Map(opciones.map((o) => [o.id, o]));
    const retros =
      respuestas.length > 0
        ? await this.postgrest.select<{ opcion_id: string; mensaje: string }>(
            'retroalimentaciones',
            { filters: { opcion_id: respuestas.map((r) => r.opcion_id) } },
          )
        : [];
    const retroByOption = new Map(retros.map((r) => [r.opcion_id, r.mensaje]));

    const respuestasDetalladas = preguntas.map((pregunta) => {
      const respuesta = respuestas.find((item) => item.pregunta_id === pregunta.id);
      const escenario = escenariosById.get(pregunta.escenario_id);

      if (!respuesta) {
        return {
          escenarioOrden: escenario?.orden ?? 0,
          escenarioTitulo: escenario?.titulo ?? 'Escenario',
          pregunta: pregunta.enunciado,
          opcionSeleccionada: 'Sin respuesta',
          puntajeObtenido: 0,
          tipoRespuesta: 'sin_respuesta' as const,
          retroalimentacion: 'No se registro respuesta para esta pregunta.',
        };
      }

      const opcion = opcionesById.get(respuesta.opcion_id);
      const puntaje = this.roundNota(this.normalizeNota(respuesta.puntaje_obtenido));
      const tipoRespuesta = opcion?.is_correcta
        ? ('correcta' as const)
        : puntaje > 0
          ? ('alternativa' as const)
          : ('incorrecta' as const);

      return {
        escenarioOrden: escenario?.orden ?? 0,
        escenarioTitulo: escenario?.titulo ?? 'Escenario',
        pregunta: pregunta.enunciado,
        opcionSeleccionada: opcion?.texto ?? 'Opcion',
        puntajeObtenido: puntaje,
        tipoRespuesta,
        retroalimentacion: retroByOption.get(respuesta.opcion_id) ?? null,
      };
    });

    const respuestasAcertadas = respuestasDetalladas.filter(
      (item) => item.tipoRespuesta === 'correcta',
    ).length;
    const respuestasParciales = respuestasDetalladas.filter(
      (item) => item.tipoRespuesta === 'alternativa',
    ).length;
    const noRespondidas = respuestasDetalladas.filter(
      (item) => item.tipoRespuesta === 'sin_respuesta',
    ).length;
    const respuestasFallidas = respuestasDetalladas.filter(
      (item) => item.tipoRespuesta === 'incorrecta',
    ).length;

    return {
      sesionId: sesion.id,
      caso: {
        id: caso.id,
        titulo: caso.titulo,
      },
      puntajeTotal: notaFinal,
      puntajeMaximo,
      porcentaje,
      nivel,
      respondidas: sesion.respondidas,
      totalPreguntas,
      noRespondidas,
      respuestasAcertadas,
      respuestasParciales,
      respuestasFallidas,
      finalizacionTipo: sesion.finalizacion_tipo ?? null,
      retroalimentacionDocenteGeneral:
        sesion.retroalimentacion_docente_general ?? null,
      retroalimentacionDocenteAt: sesion.retroalimentacion_docente_at ?? null,
      rubrica: rubrica.map((criterio) => ({
        id: criterio.id,
        criterio: criterio.criterio,
        descripcion: criterio.descripcion,
        nivelEsperado: criterio.nivel_esperado,
        peso: criterio.peso,
        orden: criterio.orden,
      })),
      resumen,
      respuestas: respuestasDetalladas,
    };
  }

  private async findCasoTitle(casoId: string): Promise<CasoTitleRecord> {
    const [caso] = await this.postgrest.select<CasoTitleRecord>('casos', {
      filters: { id: casoId },
      limit: 1,
    });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado para la sesion.');
    }

    return caso;
  }

  private roundNota(value: number): number {
    return Number(value.toFixed(1));
  }

  private normalizeNota(value: number): number {
    const nota = value > 5 ? value / 20 : value;
    return Math.min(Math.max(nota, 0), 5);
  }

  private normalizePuntajeTotal(value: number, totalPreguntas: number): number {
    if (totalPreguntas > 0 && value > totalPreguntas * 5) {
      return value / 20;
    }
    return value;
  }

  private computeNivel(
    porcentaje: number,
  ): 'Requiere refuerzo' | 'Adecuado' | 'Sobresaliente' {
    if (porcentaje >= 80) {
      return 'Sobresaliente';
    }
    if (porcentaje >= 60) {
      return 'Adecuado';
    }
    return 'Requiere refuerzo';
  }

  private buildResumen(
    nivel: 'Requiere refuerzo' | 'Adecuado' | 'Sobresaliente',
  ): string {
    if (nivel === 'Sobresaliente') {
      return 'El desempeno evidencia una comprension solida del caso.';
    }
    if (nivel === 'Adecuado') {
      return 'El desempeno es adecuado, con oportunidades de profundizacion.';
    }
    return 'El desempeno requiere refuerzo en criterios de intervencion.';
  }

  private csvCell(value: string): string {
    const normalized = value.replace(/\r?\n/g, ' ').trim();
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  private assertStudentRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role !== Role.ESTUDIANTE) {
      throw new ForbiddenException(
        'Solo estudiantes pueden consultar resultados de simulacion.',
      );
    }
  }

  private assertDocenteRole(currentUser: AuthenticatedUser): void {
    if (currentUser.role === Role.PROFESOR || currentUser.role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenException(
      'Solo docentes o administradores pueden revisar intentos.',
    );
  }
}
