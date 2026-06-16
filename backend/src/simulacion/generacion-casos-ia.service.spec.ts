import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasoIaGenerationProviderService } from './caso-ia-generation-provider.service';
import { CasoPreviewBuilderService } from './caso-preview-builder.service';
import { CasosService } from './casos.service';
import { DecisionesService } from './decisiones.service';
import { EscenariosService } from './escenarios.service';
import { GeneracionCasosIaService } from './generacion-casos-ia.service';
import { OllamaService } from './ollama.service';
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

  const generationPayload = (rawJson: string, provider = 'gemini', model = 'gemini-2.5-flash') => ({
    rawJson,
    provider,
    model,
  });

  let casosService: jest.Mocked<CasosService>;
  let escenariosService: jest.Mocked<EscenariosService>;
  let decisionesService: jest.Mocked<DecisionesService>;
  let retroalimentacionesService: jest.Mocked<RetroalimentacionesService>;
  let previewBuilder: jest.Mocked<CasoPreviewBuilderService>;
  let publicacionService: jest.Mocked<PublicacionService>;
  let iaGenerationProvider: jest.Mocked<CasoIaGenerationProviderService>;
  let ollamaService: jest.Mocked<OllamaService>;
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
    iaGenerationProvider = {
      generateJson: jest.fn(),
    } as unknown as jest.Mocked<CasoIaGenerationProviderService>;
    ollamaService = {
      generateJson: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('ollama'),
      getModelName: jest.fn().mockReturnValue('llama3.2:latest'),
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<OllamaService>;
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
      iaGenerationProvider,
      ollamaService,
      postgrest,
    );
  });

  it('rechaza solicitudes sin referencias', async () => {
    await expect(
      service.generarCaso({ cantidadEscenarios: 3 }, currentUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('guarda borrador incompleto cuando las referencias de texto son cortas', async () => {
    iaGenerationProvider.generateJson = jest
      .fn()
      .mockResolvedValueOnce(
        generationPayload(JSON.stringify({ titulo: 'X', escenarios: [] })),
      )
      .mockResolvedValueOnce(
        generationPayload(JSON.stringify({ titulo: 'X', escenarios: [] })),
      );
    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-corto', titulo: 'Referencia base' } as never);
    escenariosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'esc-corto-1' } as never);
    decisionesService.createPregunta = jest
      .fn()
      .mockResolvedValue({ id: 'preg-corto-1' } as never);
    decisionesService.createOpcion = jest
      .fn()
      .mockResolvedValueOnce({ id: 'op-corto-1' } as never)
      .mockResolvedValueOnce({ id: 'op-corto-2' } as never);
    retroalimentacionesService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'ret-corto-1' } as never)
      .mockResolvedValueOnce({ id: 'ret-corto-2' } as never);
    publicacionService.validateCaseCompletenessById = jest
      .fn()
      .mockResolvedValue(['Faltan escenarios finales.']);

    const response = await service.generarCaso(
      { casosReferenciaTexto: ['Referencia base'], cantidadEscenarios: 2 },
      currentUser,
    );

    expect(response.borradorParcial).toBe(true);
    expect(response.casoId).toBe('caso-corto');
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

  it('reintenta una vez cuando la IA devuelve JSON invalido sin cambiar de proveedor', async () => {
    iaGenerationProvider.generateJson = jest
      .fn()
      .mockResolvedValueOnce(
        generationPayload('no-es-json', 'gemini', 'gemini-2.5-flash'),
      )
      .mockResolvedValueOnce(
        generationPayload(
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
                  enunciado: 'Que deberia hacer el profesional primero?',
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
          'gemini',
          'gemini-2.5-flash',
        ),
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

    expect(iaGenerationProvider.generateJson).toHaveBeenCalledTimes(2);
    expect(response).toEqual({
      casoId: 'caso-1',
      titulo: 'Caso generado',
      totalEscenarios: 2,
      modelo: 'gemini-2.5-flash',
      proveedor: 'gemini',
    });
  });

  it('reintenta cuando la IA devuelve un borrador estructuralmente invalido', async () => {
    iaGenerationProvider.generateJson = jest
      .fn()
      .mockResolvedValueOnce(
        generationPayload(
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
        ),
      )
      .mockResolvedValueOnce(
        generationPayload(
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
        ),
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

    expect(iaGenerationProvider.generateJson).toHaveBeenCalledTimes(2);
    expect(response.casoId).toBe('caso-2');
  });

  it('guarda borrador incompleto cuando la IA no logra producir un borrador valido', async () => {
    iaGenerationProvider.generateJson = jest.fn().mockResolvedValue(
      generationPayload(
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
      ),
    );
    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-invalid', titulo: 'Caso invalido' } as never);
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
    publicacionService.validateCaseCompletenessById = jest
      .fn()
      .mockResolvedValue(['Cada pregunta debe incluir al menos dos opciones.']);

    const response = await service.generarCaso(
      { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 2 },
      currentUser,
    );

    expect(response.borradorParcial).toBe(true);
    expect(response.casoId).toBe('caso-invalid');
    expect(postgrest.remove).not.toHaveBeenCalled();
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
    iaGenerationProvider.generateJson = jest.fn().mockResolvedValue(
      generationPayload(
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
                enunciado: 'Cual es la primera respuesta adecuada?',
                opciones: [
                  {
                    orden: 1,
                    texto: 'Acompanar',
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
      ),
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

    expect(iaGenerationProvider.generateJson).toHaveBeenCalledWith(
      expect.stringContaining('Caso libre'),
      expect.any(String),
    );
    expect(iaGenerationProvider.generateJson).toHaveBeenCalledWith(
      expect.stringContaining('Caso previo'),
      expect.any(String),
    );
    expect(decisionesService.updateOpcion).toHaveBeenCalledWith(
      'op-1',
      { escenarioDestinoId: 'esc-2' },
      currentUser,
    );
  });

  it('hace rollback manual si falla una entidad intermedia', async () => {
    iaGenerationProvider.generateJson = jest.fn().mockResolvedValue(
      generationPayload(
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
                enunciado: 'Que harias primero en este contexto?',
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
      ),
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

  it('conserva el borrador cuando la validacion final falla', async () => {
    iaGenerationProvider.generateJson = jest.fn().mockResolvedValue(
      generationPayload(
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
      ),
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

    const response = await service.generarCaso(
      { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 2 },
      currentUser,
    );

    expect(response.borradorParcial).toBe(true);
    expect(response.casoId).toBe('caso-invalid');
    expect(postgrest.remove).not.toHaveBeenCalled();
  });

  it('devuelve proveedor y modelo efectivos cuando entra el fallback a Ollama', async () => {
    iaGenerationProvider.generateJson = jest.fn().mockResolvedValue(
      generationPayload(
        JSON.stringify({
          titulo: 'Caso fallback',
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
                enunciado: 'Que deberia hacer el profesional primero?',
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
        'ollama',
        'llama3.1',
      ),
    );

    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-fb', titulo: 'Caso fallback' } as never);
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

    expect(response).toMatchObject({
      casoId: 'caso-fb',
      modelo: 'llama3.1',
      proveedor: 'ollama',
    });
  });

  it('acepta un fallback breve de Ollama aunque el docente haya pedido mas escenarios', async () => {
    iaGenerationProvider.generateJson = jest.fn().mockResolvedValue(
      generationPayload(
        JSON.stringify({
          titulo: 'Caso breve local',
          descripcion: 'Descripcion suficiente y breve.',
          objetivoAprendizaje: 'Objetivo breve y suficiente.',
          escenarios: [
            {
              orden: 1,
              titulo: 'Escenario unico de trabajo',
              situacionTexto: 'Situacion breve pero suficiente para orientar la decision.',
              fondoCodigo: 'aula',
              isFinal: false,
              pregunta: {
                enunciado: 'Cual es la mejor primera accion?',
                opciones: [
                  {
                    orden: 1,
                    texto: 'Escuchar y contener',
                    puntaje: 5,
                    escenarioDestinoOrden: 2,
                    retroalimentacion: {
                      mensaje: 'Prioriza contencion y evaluacion inicial.',
                      tipo: 'refuerzo',
                    },
                  },
                  {
                    orden: 2,
                    texto: 'Cerrar el encuentro',
                    puntaje: 0,
                    retroalimentacion: {
                      mensaje: 'Corta el proceso demasiado pronto.',
                      tipo: 'correctiva',
                    },
                  },
                ],
              },
            },
            {
              orden: 2,
              titulo: 'Cierre breve',
              situacionTexto: 'Cierre breve del caso con consolidacion del aprendizaje.',
              fondoCodigo: 'oficina_psicologica',
              isFinal: true,
              pregunta: null,
            },
          ],
        }),
        'ollama',
        'llama3.2:latest',
      ),
    );

    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-short', titulo: 'Caso breve local' } as never);
    escenariosService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'esc-short-1' } as never)
      .mockResolvedValueOnce({ id: 'esc-short-2' } as never);
    decisionesService.createPregunta = jest
      .fn()
      .mockResolvedValue({ id: 'preg-short-1' } as never);
    decisionesService.createOpcion = jest
      .fn()
      .mockResolvedValueOnce({ id: 'op-short-1' } as never)
      .mockResolvedValueOnce({ id: 'op-short-2' } as never);
    decisionesService.updateOpcion = jest.fn().mockResolvedValue({} as never);
    retroalimentacionesService.create = jest
      .fn()
      .mockResolvedValue({ id: 'ret-short-1' } as never);
    publicacionService.validateCaseCompletenessById = jest
      .fn()
      .mockResolvedValue([]);

    const response = await service.generarCaso(
      { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 4 },
      currentUser,
    );

    expect(response).toMatchObject({
      casoId: 'caso-short',
      totalEscenarios: 2,
      modelo: 'llama3.2:latest',
      proveedor: 'ollama',
    });
  });

  it('conserva puntajes decimales generados por la IA al persistirlos', async () => {
    iaGenerationProvider.generateJson = jest.fn().mockResolvedValue(
      generationPayload(
        JSON.stringify({
          titulo: 'Caso decimal',
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
                enunciado: 'Que deberia hacer el profesional primero?',
                puntajeMaximo: 4.6,
                opciones: [
                  {
                    orden: 1,
                    texto: 'Escuchar y contener',
                    puntaje: 4.4,
                    escenarioDestinoOrden: 2,
                    retroalimentacion: {
                      mensaje: 'Buena priorizacion clinica.',
                      tipo: 'refuerzo',
                    },
                  },
                  {
                    orden: 2,
                    texto: 'Cerrar la sesion',
                    puntaje: 0.5,
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
        'ollama',
        'qwen2.5:7b',
      ),
    );

    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-dec', titulo: 'Caso decimal' } as never);
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
      { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 2 },
      currentUser,
    );

    expect(decisionesService.createPregunta).toHaveBeenCalledWith(
      'esc-1',
      expect.objectContaining({ puntajeMaximo: 4.6 }),
      currentUser,
    );
    expect(decisionesService.createOpcion).toHaveBeenNthCalledWith(
      1,
      'preg-1',
      expect.objectContaining({ puntaje: 4.4 }),
      currentUser,
    );
    expect(decisionesService.createOpcion).toHaveBeenNthCalledWith(
      2,
      'preg-1',
      expect.objectContaining({ puntaje: 0.5 }),
      currentUser,
    );
  });

  it('guarda un borrador parcial cuando Ollama responde pero no logra una estructura valida', async () => {
    iaGenerationProvider.generateJson = jest
      .fn()
      .mockResolvedValueOnce(
        generationPayload(
          JSON.stringify({
            titulo: 'Caso local parcial',
            descripcion: 'Borrador local con estructura incompleta.',
            objetivoAprendizaje: 'Completar manualmente el flujo del caso.',
            escenarios: [],
          }),
          'ollama',
          'llama3.2:latest',
        ),
      )
      .mockResolvedValueOnce(
        generationPayload(
          JSON.stringify({
            titulo: 'Caso local parcial',
            descripcion: 'Borrador local con estructura incompleta.',
            objetivoAprendizaje: 'Completar manualmente el flujo del caso.',
          }),
          'ollama',
          'llama3.2:latest',
        ),
      );

    casosService.create = jest
      .fn()
      .mockResolvedValue({ id: 'caso-partial', titulo: 'Caso local parcial' } as never);
    escenariosService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'esc-partial-1' } as never)
      .mockResolvedValueOnce({ id: 'esc-partial-2' } as never);
    decisionesService.createPregunta = jest
      .fn()
      .mockResolvedValue({ id: 'preg-partial-1' } as never);
    decisionesService.createOpcion = jest
      .fn()
      .mockResolvedValueOnce({ id: 'op-partial-1' } as never)
      .mockResolvedValueOnce({ id: 'op-partial-2' } as never);
    retroalimentacionesService.create = jest
      .fn()
      .mockResolvedValueOnce({ id: 'ret-partial-1' } as never)
      .mockResolvedValueOnce({ id: 'ret-partial-2' } as never);
    publicacionService.validateCaseCompletenessById = jest
      .fn()
      .mockResolvedValue(['Falta escenario final.']);

    const response = await service.generarCaso(
      { casosReferenciaTexto: [referenciaSuficiente], cantidadEscenarios: 2 },
      currentUser,
    );

    expect(response).toEqual({
      casoId: 'caso-partial',
      titulo: 'Caso local parcial',
      totalEscenarios: 2,
      modelo: 'llama3.2:latest',
      proveedor: 'ollama',
      borradorParcial: true,
      advertencia:
        'El caso fue guardado como borrador incompleto. Revisa y completa escenarios, preguntas y opciones antes de publicarlo.',
    });
    expect(escenariosService.create).toHaveBeenCalled();
  });
});
