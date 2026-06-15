import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { Role } from '../common/enums/role.enum';

import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

import { PostgrestService } from '../postgrest/postgrest.service';

import { Usuario } from '../usuarios/entities/usuario.entity';

import { OpcionRespuestaRecord } from './entities/opcion-respuesta.entity';

import { PreguntaDecisionRecord } from './entities/pregunta-decision.entity';

import { RespuestaEstudianteRecord } from './entities/respuesta-estudiante.entity';

import { ResultadoSimulacion } from './entities/resultado-simulacion.entity';

import { RevisionSesionDocente } from './entities/revision-sesion-docente.entity';

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



    const [caso] = await this.postgrest.select<CasoTitleRecord>('casos', {

      filters: { id: sesion.caso_id },

      limit: 1,

    });



    if (!caso) {

      throw new NotFoundException('Caso no encontrado para la sesion.');

    }



    return this.buildResultado(sesion, caso);

  }



  async getRevisionDocente(

    sesionId: string,

    currentUser: AuthenticatedUser,

  ): Promise<RevisionSesionDocente> {

    this.assertDocenteRole(currentUser);



    const sesion = await this.sesionesService.findSesionById(sesionId);

    await this.sesionesService.assertDocenteCanReviewSesion(sesion, currentUser);



    const [caso] = await this.postgrest.select<CasoTitleRecord>('casos', {

      filters: { id: sesion.caso_id },

      limit: 1,

    });



    if (!caso) {

      throw new NotFoundException('Caso no encontrado para la sesion.');

    }



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
    const escenariosById = new Map(escenarios.map((escenario) => [escenario.id, escenario]));



    const preguntas = await this.postgrest.select<PreguntaDecisionRecord>(

      'preguntas_decision',

      {

        filters: { escenario_id: escenarios.map((e) => e.id) },

      },

    );



    const opciones = await this.postgrest.select<OpcionRespuestaRecord>(

      'opciones_respuesta',

      {

        filters: { pregunta_id: preguntas.map((p) => p.id) },

      },

    );



    const respuestas = await this.postgrest.select<RespuestaEstudianteRecord>(

      'respuestas_estudiante',

      {

        filters: { sesion_id: sesion.id },

        order: 'respondida_at.asc',

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



    const retros = await this.postgrest.select<{

      opcion_id: string;

      mensaje: string;

    }>('retroalimentaciones', {

      filters: { opcion_id: respuestas.map((r) => r.opcion_id) },

    });

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
          retroalimentacion:
            'No se registró respuesta para esta pregunta.',
        };
      }

      const opcion = opcionesById.get(respuesta.opcion_id);
      const puntaje = this.roundNota(this.normalizeNota(respuesta.puntaje_obtenido));
      const tipoRespuesta =
        opcion?.is_correcta
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

      resumen,

      respuestas: respuestasDetalladas,

    };

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

      return 'El desempeño evidencia una comprensión sólida del caso.';

    }

    if (nivel === 'Adecuado') {

      return 'El desempeño es adecuado, con oportunidades de profundización.';

    }

    return 'El desempeño requiere refuerzo en criterios de intervención.';

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

