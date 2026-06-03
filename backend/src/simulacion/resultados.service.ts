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

    const escenarios = await this.postgrest.select<{ id: string }>('escenarios', {

      filters: { caso_id: sesion.caso_id },

    });



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



    const puntajeMaximo = this.computeMaxScoreByQuestion(preguntas, opciones);

    const porcentaje =

      puntajeMaximo > 0

        ? Number(((sesion.puntaje_total / puntajeMaximo) * 100).toFixed(2))

        : 0;



    const nivel = this.computeNivel(porcentaje);

    const resumen = this.buildResumen(nivel);



    const preguntasById = new Map(preguntas.map((p) => [p.id, p]));

    const opcionesById = new Map(opciones.map((o) => [o.id, o]));



    const retros = await this.postgrest.select<{

      opcion_id: string;

      mensaje: string;

    }>('retroalimentaciones', {

      filters: { opcion_id: respuestas.map((r) => r.opcion_id) },

    });

    const retroByOption = new Map(retros.map((r) => [r.opcion_id, r.mensaje]));



    return {

      sesionId: sesion.id,

      caso: {

        id: caso.id,

        titulo: caso.titulo,

      },

      puntajeTotal: sesion.puntaje_total,

      puntajeMaximo,

      porcentaje,

      nivel,

      respondidas: sesion.respondidas,

      totalPreguntas: sesion.total_preguntas,

      resumen,

      respuestas: respuestas.map((r) => ({

        pregunta: preguntasById.get(r.pregunta_id)?.enunciado ?? 'Pregunta',

        opcionSeleccionada: opcionesById.get(r.opcion_id)?.texto ?? 'Opcion',

        puntajeObtenido: r.puntaje_obtenido,

        retroalimentacion: retroByOption.get(r.opcion_id) ?? null,

      })),

    };

  }



  private computeMaxScoreByQuestion(

    preguntas: PreguntaDecisionRecord[],

    opciones: OpcionRespuestaRecord[],

  ): number {

    let total = 0;

    for (const pregunta of preguntas) {

      const dePregunta = opciones.filter((o) => o.pregunta_id === pregunta.id);

      const max = dePregunta.reduce(

        (acc, opt) => (opt.puntaje > acc ? opt.puntaje : acc),

        0,

      );

      total += max;

    }

    return total;

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

