import {
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasoPreviewBuilderService } from './caso-preview-builder.service';
import { CasosService } from './casos.service';
import { DecisionesService } from './decisiones.service';
import { EscenariosService } from './escenarios.service';
import { GeneracionCasosIaService } from './generacion-casos-ia.service';
import { GeminiService } from './gemini.service';
import { PublicacionService } from './publicacion.service';
import { RetroalimentacionesService } from './retroalimentaciones.service';

describe('GeneracionCasosIaService', () => {
  const referenciaSuficiente =
    'Adolescente presenta ausentismo, bajo rendimiento y conflicto familiar persistente. El practicante debe explorar riesgos, red de apoyo y objetivo pedagogico.';

  const currentUser: AuthenticatedUser = {
    sub: 'doc-1',
    email: 'docente@nuclear.local',
    role: Role.PROFESOR,
    tokenVersion: 1,
  };

  let casosService: jest.Mocked<CasosService>;
  let escenariosService: jest.Mocked<EscenariosService>;
  let decisionesService: jest.Mocked<DecisionesService>;
  let retroalimentacionesService: jest.Mocked<RetroalimentacionesService>;
  let previewBuilder: jest.Mocked<CasoPreviewBuilderService>;
  let publicacionService: jest.Mocked<PublicacionService>;
  let geminiService: jest.Mocked<GeminiService>;
  let postgrest: jest.Mocked<PostgrestService>;

  let service: GeneracionCasosIaService;

  beforeEach(() => {
    casosService = {
      create: jest.fn(),
      findCasoById: jest.fn(),
      assertCanAccessCasoDocente: jest.fn(),
    } as unknown as jest.Mocked<CasosService>;
    escenariosService = {
      create: jest.fn(),
    } as unknown as jest.Mocked<EscenariosService>;
    decisionesService = {
      createPregunta: jest.fn(),
      createOpcion: jest.fn(),
      updateOpcion: jest.fn(),
    } as unknown as jest.Mocked<DecisionesService>;
    retroalimentacionesService = {
      create: jest.fn(),
    } as unknown as jest.Mocked<RetroalimentacionesService>;
    previewBuilder = {
      build: jest.fn(),
    } as unknown as jest.Mocked<CasoPreviewBuilderService>;
    publicacionService = {
      validateCaseCompletenessById: jest.fn(),
    } as unknown as jest.Mocked<PublicacionService>;
    geminiService = {
      generateJson: jest.fn(),
      getModelName: jest.fn().mockReturnValue('gemini-2.5-flash'),
    } as unknown as jest.Mocked<GeminiService>;
    postgrest = {
      remove: jest.fn(),
    } as unknown as jest.Mocked<PostgrestService>;
    service = new GeneracionCasosIaService(
      casosService,
      escenariosService,
      decisionesService,
      retroalimentacionesService,
      previewBuilder,
      publicacionService,
      geminiService,
      postgrest,
    );
  });

  it('rechaza solicitudes sin referencias', async () => {
    await expect(
      service.generarCaso({ cantidadEscenarios: 3 }, currentUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza referencias de texto con contexto insuficiente', async () => {
    await expect(
      service.generarCaso(
        { casosReferenciaTexto: ['Referencia base'], cantidadEscenarios: 2 },
        currentUser,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'IA_PROMPT_INSUFFICIENT',
      },
    });
  });

  it('rechaza casos de referencia sin permiso', async () => {
    casosService.findCasoById = jest.fn().mockResolvedValue({ id: 'case-1' } as never);
    casosService.assertCanAccessCasoDocente = jest
      .fn()
      .mockImplementation(() => {
        throw new ForbiddenException('sin permiso');
      });

    await expect(
      service.generarCaso({ casosReferenciaIds: ['case-1'] }, currentUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('reintenta una vez cuando Gemini devuelve JSON invalido', async () => {
    geminiService.generateJson = jest
      .fn()
      .mockResolvedValueOnce('no-es-json')
      .mockResolvedValueOnce(
        JSON.stringify({
          titulo: 'Caso generado',
          descripcion: 'Descripcion suficiente',
          objetivoAprendizaje: 'Objetivo suficiente',
          escenarios: [
            {
              orden: 1,
              titulo: 'Escenario 1',
              situacionTexto: 'Situacion amplia del escenario uno.',
              fondoCodigo: 'aula',
              isFinal: false,
              pregunta: {
                enunciado: '¿Que deberia hacer el profesional primero?',
                tipo: 'single_choice',
                puntajeMaximo: 100,
                opciones: [
                  {
                    orden: 1,
                    texto: 'Escuchar y contener',
                    puntaje: 100,
                    isCorrecta: true,
                    escenarioDestinoOrden: 2,
                    retroalimentacion: {
                      mensaje: 'Buena priorizacion clinica.',
                      tipo: 'refuerzo',
                    },
                  },
                  {
                    orden: 2,
                    texto: 'Cerrar la sesion',
                    puntaje: 0,
                    retroalimentacion: {
                      mensaje: 'No aborda la necesidad inmediata.',
                      tipo: 'correctiva',
                    },
                  },
                ],
              },
            },
            {
              orden: 2,
              titulo: 'Cierre',
              situacionTexto: 'El caso llega a una fase de cierre y evaluacion.',
              fondoCodigo: 'oficina_psicologica',
              isFinal: true,
              pregunta: null,
            },
          ],
        }),
      );

    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-1', titulo: 'Caso generado' } as never);
    escenariosService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'esc-1' } as never)
      .mockResolvedValueOnce({ id: 'esc-2' } as never);
    decisionesService.createPregunta = jest
      .fn()
      .mockResolvedValue({ id: 'preg-1' } as never);
    decisionesService.createOpcion = jest
      .fn()
      .mockResolvedValueOnce({ id: 'op-1' } as never)
      .mockResolvedValueOnce({ id: 'op-2' } as never);
    decisionesService.updateOpcion = jest.fn().mockResolvedValue({} as never);
    retroalimentacionesService.create = jest
      .fn()
      .mockResolvedValue({ id: 'ret-1' } as never);
    publicacionService.validateCaseCompletenessById = jest
      .fn()
      .mockResolvedValue([]);

    const response = await service.generarCaso(
      { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 2 },
      currentUser,
    );

    expect(geminiService.generateJson).toHaveBeenCalledTimes(2);
    expect(response).toEqual({
      casoId: 'caso-1',
      titulo: 'Caso generado',
      totalEscenarios: 2,
      modelo: 'gemini-2.5-flash',
    });
  });

  it('reintenta cuando la IA devuelve un borrador estructuralmente invalido', async () => {
    geminiService.generateJson = jest
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          titulo: 'Caso incompleto',
          escenarios: [
            {
              orden: 1,
              titulo: 'Escenario 1',
              situacionTexto: 'Situacion amplia del escenario uno.',
              fondoCodigo: 'aula',
              isFinal: false,
              pregunta: {
                enunciado: 'Pregunta con una sola opcion invalida.',
                opciones: [
                  {
                    orden: 1,
                    texto: 'Unica opcion',
                    puntaje: 10,
                    retroalimentacion: {
                      mensaje: 'Insuficiente.',
                      tipo: 'correctiva',
                    },
                  },
                ],
              },
            },
            {
              orden: 2,
              titulo: 'Final',
              situacionTexto: 'Cierre del caso con amplitud suficiente.',
              fondoCodigo: 'oficina_psicologica',
              isFinal: true,
              pregunta: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          titulo: 'Caso corregido',
          descripcion: 'Descripcion suficiente',
          objetivoAprendizaje: 'Objetivo suficiente',
          escenarios: [
            {
              orden: 1,
              titulo: 'Escenario 1',
              situacionTexto: 'Situacion amplia del escenario uno.',
              fondoCodigo: 'aula',
              isFinal: false,
              pregunta: {
                enunciado: 'Que deberia hacer el profesional primero en esta escena?',
                opciones: [
                  {
                    orden: 1,
                    texto: 'Escuchar y contener',
                    puntaje: 100,
                    escenarioDestinoOrden: 2,
                    retroalimentacion: {
                      mensaje: 'Buena priorizacion clinica.',
                      tipo: 'refuerzo',
                    },
                  },
                  {
                    orden: 2,
                    texto: 'Cerrar la sesion',
                    puntaje: 0,
                    retroalimentacion: {
                      mensaje: 'No aborda la necesidad inmediata.',
                      tipo: 'correctiva',
                    },
                  },
                ],
              },
            },
            {
              orden: 2,
              titulo: 'Cierre',
              situacionTexto: 'El caso llega a una fase de cierre y evaluacion.',
              fondoCodigo: 'oficina_psicologica',
              isFinal: true,
              pregunta: null,
            },
          ],
        }),
      );

    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-2', titulo: 'Caso corregido' } as never);
    escenariosService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'esc-1' } as never)
      .mockResolvedValueOnce({ id: 'esc-2' } as never);
    decisionesService.createPregunta = jest
      .fn()
      .mockResolvedValue({ id: 'preg-1' } as never);
    decisionesService.createOpcion = jest
      .fn()
      .mockResolvedValueOnce({ id: 'op-1' } as never)
      .mockResolvedValueOnce({ id: 'op-2' } as never);
    decisionesService.updateOpcion = jest.fn().mockResolvedValue({} as never);
    retroalimentacionesService.create = jest
      .fn()
      .mockResolvedValue({ id: 'ret-1' } as never);
    publicacionService.validateCaseCompletenessById = jest
      .fn()
      .mockResolvedValue([]);

    const response = await service.generarCaso(
      { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 2 },
      currentUser,
    );

    expect(geminiService.generateJson).toHaveBeenCalledTimes(2);
    expect(response.casoId).toBe('caso-2');
  });

  it('devuelve 422 amable cuando la IA no logra producir un borrador valido', async () => {
    geminiService.generateJson = jest
      .fn()
      .mockResolvedValue(
        JSON.stringify({
          titulo: 'Caso invalido',
          escenarios: [
            {
              orden: 1,
              titulo: 'Escenario 1',
              situacionTexto: 'Situacion amplia del escenario uno.',
              fondoCodigo: 'aula',
              isFinal: false,
              pregunta: {
                enunciado: 'Pregunta con una sola opcion invalida.',
                opciones: [
                  {
                    orden: 1,
                    texto: 'Unica opcion',
                    puntaje: 10,
                    retroalimentacion: {
                      mensaje: 'Insuficiente.',
                      tipo: 'correctiva',
                    },
                  },
                ],
              },
            },
            {
              orden: 2,
              titulo: 'Final',
              situacionTexto: 'Cierre del caso con amplitud suficiente.',
              fondoCodigo: 'oficina_psicologica',
              isFinal: true,
              pregunta: null,
            },
          ],
        }),
      );

    const promise = service.generarCaso(
      { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 2 },
      currentUser,
    );

    await expect(promise).rejects.toThrow(UnprocessableEntityException);
    await expect(promise).rejects.toMatchObject({
      response: {
        code: 'IA_DRAFT_INVALID',
        errors: ['Cada pregunta debe incluir al menos dos opciones.'],
      },
    });
  });

  it('arma el prompt con referencias mixtas y mapea destinos por orden', async () => {
    casosService.findCasoById = jest.fn().mockResolvedValue({
      id: 'ref-1',
      titulo: 'Caso previo',
      descripcion: 'Desc',
      objetivo_aprendizaje: 'Obj',
      autor_docente_id: 'doc-1',
      estado: 'draft',
      is_active: true,
      published_at: null,
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    } as never);
    previewBuilder.build = jest.fn().mockResolvedValue({
      id: 'ref-1',
      titulo: 'Caso previo',
      descripcion: 'Desc',
      objetivoAprendizaje: 'Obj',
      autorDocenteId: 'doc-1',
      estado: 'draft',
      isActive: true,
      publishedAt: null,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      escenarios: [],
    } as never);
    geminiService.generateJson = jest.fn().mockResolvedValue(
      JSON.stringify({
        titulo: 'Caso IA',
        descripcion: 'Descripcion amplia',
        objetivoAprendizaje: 'Objetivo amplio',
        escenarios: [
          {
            orden: 1,
            titulo: 'Inicio',
            situacionTexto: 'Situacion extensa del inicio del caso.',
            fondoCodigo: 'aula',
            isFinal: false,
            pregunta: {
              enunciado: '¿Cual es la primera respuesta adecuada?',
              opciones: [
                {
                  orden: 1,
                  texto: 'Acompañar',
                  puntaje: 100,
                  escenarioDestinoOrden: 2,
                  retroalimentacion: {
                    mensaje: 'Correcto.',
                    tipo: 'refuerzo',
                  },
                },
                {
                  orden: 2,
                  texto: 'Ignorar',
                  puntaje: 0,
                  retroalimentacion: {
                    mensaje: 'No es adecuado.',
                    tipo: 'correctiva',
                  },
                },
              ],
            },
          },
          {
            orden: 2,
            titulo: 'Final',
            situacionTexto: 'Cierre del caso para consolidar aprendizaje.',
            fondoCodigo: 'oficina_psicologica',
            isFinal: true,
            pregunta: null,
          },
        ],
      }),
    );
    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-77', titulo: 'Caso IA' } as never);
    escenariosService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'esc-1' } as never)
      .mockResolvedValueOnce({ id: 'esc-2' } as never);
    decisionesService.createPregunta = jest
      .fn()
      .mockResolvedValue({ id: 'preg-1' } as never);
    decisionesService.createOpcion = jest
      .fn()
      .mockResolvedValueOnce({ id: 'op-1' } as never)
      .mockResolvedValueOnce({ id: 'op-2' } as never);
    decisionesService.updateOpcion = jest.fn().mockResolvedValue({} as never);
    retroalimentacionesService.create = jest
      .fn()
      .mockResolvedValue({ id: 'ret-1' } as never);
    publicacionService.validateCaseCompletenessById = jest
      .fn()
      .mockResolvedValue([]);

    await service.generarCaso(
      {
        instruccion: 'Enfoque de crisis',
        casosReferenciaTexto: ['Caso libre'],
        casosReferenciaIds: ['ref-1'],
        cantidadEscenarios: 2,
      },
      currentUser,
    );

    expect(geminiService.generateJson).toHaveBeenCalledWith(
      expect.stringContaining('Caso libre'),
    );
    expect(geminiService.generateJson).toHaveBeenCalledWith(
      expect.stringContaining('Caso previo'),
    );
    expect(decisionesService.updateOpcion).toHaveBeenCalledWith(
      'op-1',
      { escenarioDestinoId: 'esc-2' },
      currentUser,
    );
  });

  it('hace rollback manual si falla una entidad intermedia', async () => {
    geminiService.generateJson = jest.fn().mockResolvedValue(
      JSON.stringify({
        titulo: 'Caso rollback',
        escenarios: [
          {
            orden: 1,
            titulo: 'Inicio',
            situacionTexto: 'Situacion extensa para primer escenario.',
            fondoCodigo: 'aula',
            isFinal: false,
            pregunta: {
              enunciado: '¿Que harías primero en este contexto?',
              opciones: [
                {
                  orden: 1,
                  texto: 'Contener',
                  puntaje: 100,
                  retroalimentacion: {
                    mensaje: 'Bien.',
                    tipo: 'refuerzo',
                  },
                },
                {
                  orden: 2,
                  texto: 'Postergar',
                  puntaje: 0,
                  retroalimentacion: {
                    mensaje: 'No conviene.',
                    tipo: 'correctiva',
                  },
                },
              ],
            },
          },
          {
            orden: 2,
            titulo: 'Final',
            situacionTexto: 'Cierre suficientemente amplio del caso.',
            fondoCodigo: 'casa',
            isFinal: true,
            pregunta: null,
          },
        ],
      }),
    );
    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-rb', titulo: 'Caso rollback' } as never);
    escenariosService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'esc-rb-1' } as never)
      .mockRejectedValueOnce(new Error('fallo escenario 2'));
    decisionesService.createPregunta = jest
      .fn()
      .mockResolvedValue({ id: 'preg-rb-1' } as never);
    decisionesService.createOpcion = jest
      .fn()
      .mockResolvedValueOnce({ id: 'op-rb-1' } as never)
      .mockResolvedValueOnce({ id: 'op-rb-2' } as never);
    retroalimentacionesService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'ret-rb-1' } as never)
      .mockResolvedValueOnce({ id: 'ret-rb-2' } as never);

    await expect(
      service.generarCaso(
        { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 2 },
        currentUser,
      ),
    ).rejects.toThrow('fallo escenario 2');

    expect(postgrest.remove).toHaveBeenCalledWith('retroalimentaciones', {
      filters: { id: ['ret-rb-1', 'ret-rb-2'] },
    });
    expect(postgrest.remove).toHaveBeenCalledWith('opciones_respuesta', {
      filters: { id: ['op-rb-1', 'op-rb-2'] },
    });
    expect(postgrest.remove).toHaveBeenCalledWith('preguntas_decision', {
      filters: { id: ['preg-rb-1'] },
    });
    expect(postgrest.remove).toHaveBeenCalledWith('escenarios', {
      filters: { id: ['esc-rb-1'] },
    });
    expect(postgrest.remove).toHaveBeenCalledWith('casos', {
      filters: { id: 'caso-rb' },
    });
  });

  it('hace rollback y devuelve un mensaje amable si la validacion final falla', async () => {
    geminiService.generateJson = jest.fn().mockResolvedValue(
      JSON.stringify({
        titulo: 'Caso inconsistente',
        escenarios: [
          {
            orden: 1,
            titulo: 'Inicio',
            situacionTexto: 'Situacion extensa para primer escenario.',
            fondoCodigo: 'aula',
            isFinal: false,
            pregunta: {
              enunciado: 'Que harias primero en este contexto clinico?',
              opciones: [
                {
                  orden: 1,
                  texto: 'Contener',
                  puntaje: 100,
                  retroalimentacion: {
                    mensaje: 'Bien.',
                    tipo: 'refuerzo',
                  },
                },
                {
                  orden: 2,
                  texto: 'Postergar',
                  puntaje: 0,
                  retroalimentacion: {
                    mensaje: 'No conviene.',
                    tipo: 'correctiva',
                  },
                },
              ],
            },
          },
          {
            orden: 2,
            titulo: 'Final',
            situacionTexto: 'Cierre suficientemente amplio del caso.',
            fondoCodigo: 'casa',
            isFinal: true,
            pregunta: null,
          },
        ],
      }),
    );
    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-invalid', titulo: 'Caso inconsistente' } as never);
    escenariosService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'esc-invalid-1' } as never)
      .mockResolvedValueOnce({ id: 'esc-invalid-2' } as never);
    decisionesService.createPregunta = jest
      .fn()
      .mockResolvedValue({ id: 'preg-invalid-1' } as never);
    decisionesService.createOpcion = jest
      .fn()
      .mockResolvedValueOnce({ id: 'op-invalid-1' } as never)
      .mockResolvedValueOnce({ id: 'op-invalid-2' } as never);
    retroalimentacionesService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'ret-invalid-1' } as never)
      .mockResolvedValueOnce({ id: 'ret-invalid-2' } as never);
    publicacionService.validateCaseCompletenessById = jest.fn().mockResolvedValue([
      'El escenario inicial debe tener pregunta y al menos dos opciones.',
    ]);

    const promise = service.generarCaso(
      { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 2 },
      currentUser,
    );

    await expect(promise).rejects.toThrow(UnprocessableEntityException);
    await expect(promise).rejects.toMatchObject({
      response: {
        code: 'IA_DRAFT_INVALID',
        errors: ['El escenario inicial debe tener pregunta y al menos dos opciones.'],
      },
    });

    expect(postgrest.remove).toHaveBeenCalledWith('retroalimentaciones', {
      filters: { id: ['ret-invalid-1', 'ret-invalid-2'] },
    });
    expect(postgrest.remove).toHaveBeenCalledWith('opciones_respuesta', {
      filters: { id: ['op-invalid-1', 'op-invalid-2'] },
    });
    expect(postgrest.remove).toHaveBeenCalledWith('preguntas_decision', {
      filters: { id: ['preg-invalid-1'] },
    });
    expect(postgrest.remove).toHaveBeenCalledWith('escenarios', {
      filters: { id: ['esc-invalid-1', 'esc-invalid-2'] },
    });
    expect(postgrest.remove).toHaveBeenCalledWith('casos', {
      filters: { id: 'caso-invalid' },
    });
  });
});
