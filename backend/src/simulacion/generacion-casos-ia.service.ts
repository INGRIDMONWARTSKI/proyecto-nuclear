import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasosService } from './casos.service';
import { CasoIaGenerationProviderService } from './caso-ia-generation-provider.service';
import { CasoPreviewBuilderService } from './caso-preview-builder.service';
import { DecisionesService } from './decisiones.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { CreateEscenarioDto } from './dto/create-escenario.dto';
import { CreateOpcionRespuestaDto } from './dto/create-opcion-respuesta.dto';
import { CreatePreguntaDecisionDto } from './dto/create-pregunta-decision.dto';
import { CreateRetroalimentacionDto } from './dto/create-retroalimentacion.dto';
import { GenerateCasoIaDto } from './dto/generate-caso-ia.dto';
import { EscenariosService } from './escenarios.service';
import { OllamaService } from './ollama.service';
import { PublicacionService } from './publicacion.service';
import { RetroalimentacionesService } from './retroalimentaciones.service';
import { CasoIaGenerationResult } from './types/caso-ia-generation.types';
import { CasoGeneradoIa } from './types/caso-generado-ia.types';
import { CasoPreviewTree } from './types/caso-preview.types';

@Injectable()
export class GeneracionCasosIaService {
  private static readonly MAX_GENERATION_ATTEMPTS = 2;
  private static readonly LOCAL_FALLBACK_MAX_SCENARIOS = 2;
  private static readonly INCOMPLETE_DRAFT_WARNING =
    'El caso fue guardado como borrador incompleto. Revisa y completa escenarios, preguntas y opciones antes de publicarlo.';

  constructor(
    private readonly casosService: CasosService,
    private readonly escenariosService: EscenariosService,
    private readonly decisionesService: DecisionesService,
    private readonly retroalimentacionesService: RetroalimentacionesService,
    private readonly previewBuilder: CasoPreviewBuilderService,
    private readonly publicacionService: PublicacionService,
    private readonly iaGenerationProvider: CasoIaGenerationProviderService,
    private readonly ollamaService: OllamaService,
    private readonly postgrest: PostgrestService,
  ) {}

  async generarCaso(
    dto: GenerateCasoIaDto,
    currentUser: AuthenticatedUser,
  ): Promise<{
    casoId: string;
    titulo: string;
    totalEscenarios: number;
    modelo: string;
    proveedor: string;
    borradorParcial?: boolean;
    advertencia?: string;
  }> {
    this.assertDocenteRole(currentUser);

    const cantidadEscenarios = dto.cantidadEscenarios ?? 3;
    const referenciasTexto = this.normalizeReferenceTexts(dto.casosReferenciaTexto);
    const referenciasCasos = await this.resolveReferenceCases(
      dto.casosReferenciaIds,
      currentUser,
    );

    if (referenciasTexto.length === 0 && referenciasCasos.length === 0) {
      throw new BadRequestException(
        'Debes enviar al menos una referencia en texto o un caso existente.',
      );
    }

    this.assertSufficientPromptContext(referenciasTexto, referenciasCasos);

    const promptContext = {
      instruccion: dto.instruccion?.trim() || null,
      cantidadEscenarios,
      referenciasTexto,
      referenciasCasos,
    };
    const prompt = this.buildPrompt(promptContext);
    const localPrompt = this.buildLocalPrompt(promptContext);

    const generationResult = await this.generateAndValidate(
      prompt,
      localPrompt,
      promptContext,
      cantidadEscenarios,
    );

    if (
      'borradorParcial' in generationResult &&
      generationResult.borradorParcial &&
      !('casoGenerado' in generationResult)
    ) {
      const creado = await this.persistPartialDraftCase(
        generationResult.partialCase,
        promptContext,
        cantidadEscenarios,
        currentUser,
      );

      return {
        casoId: creado.id,
        titulo: creado.titulo,
        totalEscenarios: creado.totalEscenarios,
        modelo: generationResult.model,
        proveedor: generationResult.provider,
        borradorParcial: true,
        advertencia: GeneracionCasosIaService.INCOMPLETE_DRAFT_WARNING,
      };
    }

    const fullResult = generationResult as CasoIaGenerationResult & {
      casoGenerado: CasoGeneradoIa;
      borradorIncompleto?: boolean;
    };
    const creado = await this.persistGeneratedCase(
      fullResult.casoGenerado,
      currentUser,
    );

    return {
      casoId: creado.id,
      titulo: creado.titulo,
      totalEscenarios: fullResult.casoGenerado.escenarios.length,
      modelo: fullResult.model,
      proveedor: fullResult.provider,
      ...(creado.borradorIncompleto || fullResult.borradorIncompleto
        ? {
            borradorParcial: true,
            advertencia: GeneracionCasosIaService.INCOMPLETE_DRAFT_WARNING,
          }
        : {}),
    };
  }

  private normalizeReferenceTexts(texts: string[] | undefined): string[] {
    return (texts ?? []).map((item) => item.trim()).filter((item) => item.length > 0);
  }

  private assertSufficientPromptContext(
    referenciasTexto: string[],
    referenciasCasos: CasoPreviewTree[],
  ): void {
    // Contexto corto permitido: si la IA no completa la estructura, se guarda borrador incompleto.
    void referenciasTexto;
    void referenciasCasos;
  }

  private async resolveReferenceCases(
    casoIds: string[] | undefined,
    currentUser: AuthenticatedUser,
  ): Promise<CasoPreviewTree[]> {
    const previews: CasoPreviewTree[] = [];

    for (const casoId of casoIds ?? []) {
      const caso = await this.casosService.findCasoById(casoId);
      this.casosService.assertCanAccessCasoDocente(caso, currentUser);
      previews.push(await this.previewBuilder.build(caso));
    }

    return previews;
  }

  private buildPrompt(
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
  ): string {
    const referenciasCasosJson = JSON.stringify(context.referenciasCasos, null, 2);
    const referenciasTexto = context.referenciasTexto
      .map((item, index) => `Referencia ${index + 1}:\n${item}`)
      .join('\n\n');

    return [
      'Eres un asistente experto en simulaciones de casos psicologicos para uso docente.',
      `Genera exactamente ${context.cantidadEscenarios} escenarios para un caso nuevo.`,
      'Devuelve exclusivamente JSON valido, sin markdown, sin comentarios y sin texto adicional.',
      'Reglas obligatorias:',
      '- Debes generar un objeto con: titulo, descripcion, objetivoAprendizaje, escenarios.',
      '- escenarios debe ser un arreglo ordenado por la propiedad orden comenzando en 1.',
      '- El ultimo escenario debe tener isFinal=true.',
      '- Cada escenario no final debe incluir una pregunta.',
      '- Cada pregunta debe incluir minimo 2 opciones.',
      '- Cada opcion debe incluir retroalimentacion con mensaje y tipo.',
      '- Usa solo fondoCodigo dentro del catalogo: aula, oficina_psicologica, casa, comisaria_familia, sala_espera.',
      '- Si una opcion incluye escenarioDestinoOrden, debe apuntar a un orden existente del mismo caso.',
      '- Si no incluyes escenarioDestinoOrden, se asumira el siguiente escenario por orden.',
      '- Los escenarios finales deben tener pregunta=null.',
      '- Mantener coherencia pedagogica y variedad de decisiones.',
      'JSON esperado:',
      JSON.stringify(
        {
          titulo: 'string',
          descripcion: 'string',
          objetivoAprendizaje: 'string',
          escenarios: [
            {
              orden: 1,
              titulo: 'string',
              situacionTexto: 'string',
              fondoCodigo: 'aula',
              isFinal: false,
              pregunta: {
                enunciado: 'string',
                tipo: 'single_choice',
                puntajeMaximo: 5,
                opciones: [
                  {
                    orden: 1,
                    texto: 'string',
                    puntaje: 5,
                    isCorrecta: true,
                    escenarioDestinoOrden: 2,
                    retroalimentacion: {
                      mensaje: 'string',
                      tipo: 'pedagogica',
                      referenciaTeorica: 'string',
                    },
                  },
                ],
              },
            },
          ],
        },
        null,
        2,
      ),
      context.instruccion ? `Instruccion adicional del docente:\n${context.instruccion}` : '',
      referenciasTexto ? `Referencias en texto libre:\n${referenciasTexto}` : '',
      context.referenciasCasos.length > 0
        ? `Casos de referencia existentes:\n${referenciasCasosJson}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildLocalPrompt(
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
  ): string {
    const localScenarioCount = this.resolveLocalScenarioCount(
      context.cantidadEscenarios,
    );
    const referenciasTexto = context.referenciasTexto
      .slice(0, 2)
      .map((item, index) => `R${index + 1}: ${this.compactText(item, 350)}`)
      .join('\n');
    const referenciasCasos = context.referenciasCasos
      .slice(0, 1)
      .map(
        (caso, index) =>
          `C${index + 1}: titulo=${caso.titulo}; objetivo=${this.compactText(caso.objetivoAprendizaje ?? '', 120)}; descripcion=${this.compactText(caso.descripcion ?? '', 180)}`,
      )
      .join('\n');

    return [
      'Genera un caso psicologico docente breve y responde solo JSON valido.',
      `Crea como maximo ${localScenarioCount} escenarios.`,
      'Estructura:',
      '{"titulo":"string","descripcion":"string","objetivoAprendizaje":"string","escenarios":[{"orden":1,"titulo":"string","situacionTexto":"string","fondoCodigo":"aula","isFinal":false,"pregunta":{"enunciado":"string","tipo":"single_choice","puntajeMaximo":5,"opciones":[{"orden":1,"texto":"string","puntaje":5,"isCorrecta":false,"escenarioDestinoOrden":2,"retroalimentacion":{"mensaje":"string","tipo":"pedagogica","referenciaTeorica":"string"}}]}}]}',
      'Reglas:',
      '- caso breve',
      '- ultimo escenario con isFinal=true',
      '- escenario final con pregunta=null',
      '- escenarios no finales con pregunta y minimo 2 opciones',
      '- usa preguntas y opciones breves',
      '- retroalimentacion corta, directa y util',
      '- fondoCodigo solo: aula, oficina_psicologica, casa, comisaria_familia, sala_espera',
      '- escenarioDestinoOrden debe apuntar a un orden existente o omitirse',
      context.instruccion
        ? `Instruccion docente: ${this.compactText(context.instruccion, 220)}`
        : '',
      referenciasTexto ? `Referencias texto:\n${referenciasTexto}` : '',
      referenciasCasos ? `Casos referencia:\n${referenciasCasos}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private compactText(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 3)}...`;
  }

  private shouldAttemptLocalStagedGeneration(error: unknown): boolean {
    if (!(error instanceof ServiceUnavailableException) || !this.ollamaService.isConfigured()) {
      return false;
    }

    const response = error.getResponse();
    if (!response || typeof response !== 'object' || !('code' in response)) {
      return false;
    }

    return response.code === 'IA_LOCAL_TIMEOUT';
  }

  private async generateWithLocalStages(
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
    cantidadEscenarios: number,
  ): Promise<
    | (CasoIaGenerationResult & { casoGenerado: CasoGeneradoIa })
    | (CasoIaGenerationResult & {
        borradorParcial: true;
        partialCase: {
          titulo: string;
          descripcion: string | null;
          objetivoAprendizaje: string | null;
        };
      })
  > {
    const localScenarioCount = this.resolveLocalScenarioCount(cantidadEscenarios);
    const metadataPrompt = this.buildLocalMetadataPrompt(context);
    const metadataRaw = await this.ollamaService.generateJson(metadataPrompt);
    const metadataParsed = JSON.parse(metadataRaw) as unknown;
    const metadata = this.validateLocalMetadata(metadataParsed, context);

    try {
      const scenariosPrompt = this.buildLocalScenariosPrompt(
        context,
        metadata,
        localScenarioCount,
      );
      const scenariosRaw = await this.ollamaService.generateJson(scenariosPrompt);
      const scenariosParsed = JSON.parse(scenariosRaw) as unknown;
      const escenariosBase = this.validateLocalScenarioSkeletons(
        scenariosParsed,
        localScenarioCount,
        metadata,
        context,
      );

      const escenarios: CasoGeneradoIa['escenarios'] = [];

      for (const escenarioBase of escenariosBase) {
        if (escenarioBase.isFinal) {
          escenarios.push({
            ...escenarioBase,
            pregunta: null,
          });
          continue;
        }

        try {
          const questionPrompt = this.buildLocalQuestionPrompt(
            context,
            metadata,
            escenarioBase,
            localScenarioCount,
          );
          const questionRaw = await this.ollamaService.generateJson(questionPrompt);
          const questionParsed = JSON.parse(questionRaw) as unknown;
          const pregunta = this.validateQuestion(questionParsed);

          escenarios.push({
            ...escenarioBase,
            pregunta,
          });
        } catch (error) {
          if (
            error instanceof SyntaxError ||
            error instanceof BadRequestException
          ) {
            return this.buildLocalPartialDraftResult(metadata);
          }

          throw error;
        }
      }

      return {
        rawJson: JSON.stringify({
          titulo: metadata.titulo,
          descripcion: metadata.descripcion,
          objetivoAprendizaje: metadata.objetivoAprendizaje,
          escenarios,
        }),
        provider: this.ollamaService.getProviderName(),
        model: this.ollamaService.getModelName(),
        casoGenerado: {
          titulo: metadata.titulo,
          descripcion: metadata.descripcion,
          objetivoAprendizaje: metadata.objetivoAprendizaje,
          escenarios,
        },
      };
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof BadRequestException) {
        return this.buildLocalPartialDraftResult(metadata);
      }

      throw error;
    }
  }

  private buildLocalMetadataPrompt(context: {
    instruccion: string | null;
    referenciasTexto: string[];
    referenciasCasos: CasoPreviewTree[];
  }): string {
    return [
      'Responde solo JSON valido.',
      'Genera metadatos de un caso psicologico docente.',
      'Estructura: {"titulo":"string","descripcion":"string","objetivoAprendizaje":"string"}',
      context.instruccion
        ? `Instruccion docente: ${this.compactText(context.instruccion, 220)}`
        : '',
      context.referenciasTexto[0]
        ? `Referencia principal: ${this.compactText(context.referenciasTexto[0], 350)}`
        : '',
      context.referenciasCasos[0]
        ? `Caso base: titulo=${context.referenciasCasos[0].titulo}; objetivo=${this.compactText(context.referenciasCasos[0].objetivoAprendizaje ?? '', 150)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildLocalScenariosPrompt(
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
    },
    metadata: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    },
    cantidadEscenarios: number,
  ): string {
    return [
      'Responde solo JSON valido.',
      `Genera como maximo ${cantidadEscenarios} escenarios base para un caso psicologico breve.`,
      'Estructura: {"escenarios":[{"orden":1,"titulo":"string","situacionTexto":"string","fondoCodigo":"aula","isFinal":false}]}',
      'Reglas:',
      '- orden consecutivo desde 1',
      '- solo el ultimo escenario debe tener isFinal=true',
      '- escenarios breves y concretos',
      '- fondoCodigo solo: aula, oficina_psicologica, casa, comisaria_familia, sala_espera',
      `Titulo del caso: ${metadata.titulo}`,
      metadata.descripcion ? `Descripcion: ${this.compactText(metadata.descripcion, 220)}` : '',
      metadata.objetivoAprendizaje
        ? `Objetivo: ${this.compactText(metadata.objetivoAprendizaje, 180)}`
        : '',
      context.referenciasTexto[0]
        ? `Referencia: ${this.compactText(context.referenciasTexto[0], 260)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildLocalQuestionPrompt(
    context: {
      instruccion: string | null;
    },
    metadata: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    },
    escenario: Omit<CasoGeneradoIa['escenarios'][number], 'pregunta'>,
    cantidadEscenarios: number,
  ): string {
    const nextOrder =
      escenario.orden < cantidadEscenarios ? escenario.orden + 1 : null;

    return [
      'Responde solo JSON valido.',
      'Genera una pregunta single_choice breve para este escenario.',
      'Estructura: {"enunciado":"string","tipo":"single_choice","puntajeMaximo":5,"opciones":[{"orden":1,"texto":"string","puntaje":5,"isCorrecta":false,"escenarioDestinoOrden":2,"retroalimentacion":{"mensaje":"string","tipo":"pedagogica","referenciaTeorica":"string"}}]}',
      'Reglas:',
      '- minimo 2 opciones',
      '- orden consecutivo desde 1',
      '- puntajes entre 0 y 5',
      '- enunciado breve',
      '- retroalimentacion corta',
      nextOrder
        ? `- si usas escenarioDestinoOrden, prioriza ${nextOrder}`
        : '- no uses escenarioDestinoOrden',
      `Caso: ${metadata.titulo}`,
      metadata.objetivoAprendizaje
        ? `Objetivo: ${this.compactText(metadata.objetivoAprendizaje, 180)}`
        : '',
      `Escenario ${escenario.orden}: ${escenario.titulo}`,
      `Situacion: ${this.compactText(escenario.situacionTexto, 260)}`,
      context.instruccion
        ? `Instruccion docente: ${this.compactText(context.instruccion, 180)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private validateLocalMetadata(
    payload: unknown,
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
  ): {
    titulo: string;
    descripcion: string | null;
    objetivoAprendizaje: string | null;
  } {
    const raw =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    return this.buildPartialDraft(context, raw);
  }

  private validateLocalScenarioSkeletons(
    payload: unknown,
    cantidadEscenarios: number,
    metadata: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    },
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
  ): Array<Omit<CasoGeneradoIa['escenarios'][number], 'pregunta'>> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return this.buildFallbackScenarioSkeletons(
        cantidadEscenarios,
        metadata,
        context,
      );
    }

    const raw = payload as Record<string, unknown>;
    const escenarios = raw.escenarios;
    if (!Array.isArray(escenarios) || escenarios.length === 0) {
      return this.buildFallbackScenarioSkeletons(
        cantidadEscenarios,
        metadata,
        context,
      );
    }

    const normalized: Array<Omit<CasoGeneradoIa['escenarios'][number], 'pregunta'>> = [];

    for (let index = 0; index < cantidadEscenarios; index += 1) {
      const expectedOrder = index + 1;
      const item = escenarios[index];

      if (item === undefined) {
        normalized.push(
          this.buildFallbackScenarioSkeleton(
            expectedOrder,
            cantidadEscenarios,
            metadata,
            context,
          ),
        );
        continue;
      }

      try {
        normalized.push(
          this.validateScenarioSkeleton(item, expectedOrder, cantidadEscenarios),
        );
      } catch {
        normalized.push(
          this.buildFallbackScenarioSkeleton(
            expectedOrder,
            cantidadEscenarios,
            metadata,
            context,
          ),
        );
      }
    }

    return normalized;
  }

  private validateScenarioSkeleton(
    payload: unknown,
    expectedOrder: number,
    totalEscenarios: number,
  ): Omit<CasoGeneradoIa['escenarios'][number], 'pregunta'> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Cada escenario debe ser un objeto valido.');
    }

    const raw = payload as Record<string, unknown>;
    const orden = this.requireInteger(raw.orden, 'escenarios[].orden', 1);
    const titulo = this.requireTrimmedString(raw.titulo, 'escenarios[].titulo', 3, 120);
    const situacionTexto = this.requireTrimmedString(
      raw.situacionTexto,
      'escenarios[].situacionTexto',
      10,
      4000,
    );
    const fondoCodigo = this.requireBackground(raw.fondoCodigo);
    this.requireBoolean(raw.isFinal, 'escenarios[].isFinal');

    return {
      orden: expectedOrder,
      titulo,
      situacionTexto,
      fondoCodigo,
      isFinal: expectedOrder === totalEscenarios,
    };
  }

  private buildFallbackScenarioSkeletons(
    cantidadEscenarios: number,
    metadata: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    },
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
  ): Array<Omit<CasoGeneradoIa['escenarios'][number], 'pregunta'>> {
    return Array.from({ length: cantidadEscenarios }, (_, index) =>
      this.buildFallbackScenarioSkeleton(
        index + 1,
        cantidadEscenarios,
        metadata,
        context,
      ),
    );
  }

  private buildFallbackScenarioSkeleton(
    orden: number,
    totalEscenarios: number,
    metadata: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    },
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
  ): Omit<CasoGeneradoIa['escenarios'][number], 'pregunta'> {
    const baseContext =
      context.referenciasTexto[0] ??
      context.referenciasCasos[0]?.descripcion ??
      metadata.descripcion ??
      context.instruccion ??
      'Analiza el caso, identifica factores de riesgo y propone una intervencion inicial.';

    const total = totalEscenarios > 1 ? totalEscenarios : 1;
    const etapa =
      orden === total
        ? 'cierre y evaluacion del proceso'
        : orden === 1
          ? 'apertura y exploracion inicial'
          : `profundizacion del caso en la etapa ${orden} de ${total}`;

    return {
      orden,
      titulo:
        orden === total
          ? `Cierre del caso ${metadata.titulo}`
          : `Escenario ${orden}: ${metadata.titulo}`,
      situacionTexto: this.compactText(
        `${etapa}. ${baseContext}`,
        900,
      ),
      fondoCodigo:
        orden === total ? 'oficina_psicologica' : 'aula',
      isFinal: orden === total,
    };
  }

  private buildLocalPartialDraftResult(metadata: {
    titulo: string;
    descripcion: string | null;
    objetivoAprendizaje: string | null;
  }): CasoIaGenerationResult & {
    borradorParcial: true;
    partialCase: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    };
  } {
    return {
      rawJson: JSON.stringify(metadata),
      provider: this.ollamaService.getProviderName(),
      model: this.ollamaService.getModelName(),
      borradorParcial: true,
      partialCase: metadata,
    };
  }

  private resolveLocalScenarioCount(requestedScenarioCount: number): number {
    return Math.max(
      1,
      Math.min(
        requestedScenarioCount,
        GeneracionCasosIaService.LOCAL_FALLBACK_MAX_SCENARIOS,
      ),
    );
  }

  private canPersistPartialDraft(
    generationResult: CasoIaGenerationResult,
    rawPayload: unknown,
  ): boolean {
    if (generationResult.provider !== 'ollama') {
      return false;
    }

    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      return true;
    }

    const raw = rawPayload as Record<string, unknown>;
    return (
      typeof raw.titulo === 'string' ||
      typeof raw.descripcion === 'string' ||
      typeof raw.objetivoAprendizaje === 'string'
    );
  }

  private buildPartialDraft(
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
    rawPayload: unknown,
  ): {
    titulo: string;
    descripcion: string | null;
    objetivoAprendizaje: string | null;
  } {
    const raw =
      rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : {};

    const titulo =
      this.safePartialText(raw.titulo, 3, 120) ??
      this.buildFallbackTitle(context);
    const descripcion =
      this.safePartialText(raw.descripcion, 20, 1000) ??
      this.buildFallbackDescription(context);
    const objetivoAprendizaje =
      this.safePartialText(raw.objetivoAprendizaje, 10, 1000) ??
      this.buildFallbackObjective(context);

    return {
      titulo,
      descripcion,
      objetivoAprendizaje,
    };
  }

  private safePartialText(
    value: unknown,
    minLength: number,
    maxLength: number,
  ): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length < minLength) {
      return null;
    }

    return normalized.slice(0, maxLength);
  }

  private buildFallbackTitle(context: {
    instruccion: string | null;
    referenciasTexto: string[];
    referenciasCasos: CasoPreviewTree[];
  }): string {
    const base =
      context.instruccion ??
      context.referenciasCasos[0]?.titulo ??
      context.referenciasTexto[0] ??
      'Caso asistido por IA local';
    const compact = this.compactText(base, 90);
    return compact.length >= 3 ? compact : 'Caso generado por IA - requiere revision';
  }

  private buildFallbackDescription(context: {
    instruccion: string | null;
    referenciasTexto: string[];
    referenciasCasos: CasoPreviewTree[];
  }): string | null {
    const source =
      context.referenciasTexto[0] ??
      context.referenciasCasos[0]?.descripcion ??
      context.instruccion;
    return source ? this.compactText(source, 1000) : null;
  }

  private buildFallbackObjective(context: {
    instruccion: string | null;
    referenciasTexto: string[];
    referenciasCasos: CasoPreviewTree[];
  }): string | null {
    const source =
      context.referenciasCasos[0]?.objetivoAprendizaje ??
      context.instruccion ??
      'Revisar el borrador local, completar escenarios y afinar decisiones pedagogicas.';
    return this.compactText(source, 1000);
  }

  private async persistPartialDraftCase(
    partialCase: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    },
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
    cantidadEscenarios: number,
    currentUser: AuthenticatedUser,
  ): Promise<{ id: string; titulo: string; totalEscenarios: number }> {
    const casoGenerado = this.coerceIncompleteGeneratedCase(
      context,
      partialCase,
      cantidadEscenarios,
    );
    casoGenerado.titulo = this.resolveIncompleteTitle(partialCase.titulo);
    casoGenerado.descripcion = partialCase.descripcion;
    casoGenerado.objetivoAprendizaje = partialCase.objetivoAprendizaje;

    const persisted = await this.persistGeneratedCase(casoGenerado, currentUser);
    return {
      id: persisted.id,
      titulo: persisted.titulo,
      totalEscenarios: casoGenerado.escenarios.length,
    };
  }

  private async generateAndValidate(
    prompt: string,
    localPrompt: string,
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
    cantidadEscenarios: number,
  ): Promise<
    | (CasoIaGenerationResult & { casoGenerado: CasoGeneradoIa })
    | (CasoIaGenerationResult & {
        borradorParcial: true;
        partialCase: {
          titulo: string;
          descripcion: string | null;
          objetivoAprendizaje: string | null;
        };
      })
    | (CasoIaGenerationResult & {
        casoGenerado: CasoGeneradoIa;
        borradorIncompleto: true;
      })
  > {
    let lastErrorMessage =
      'La IA devolvio una estructura que no cumple los requisitos minimos.';
    const collectedErrors: string[] = [];
    let lastGenerationResult: CasoIaGenerationResult | null = null;
    let lastRawPayload: unknown = null;

    for (
      let intento = 0;
      intento < GeneracionCasosIaService.MAX_GENERATION_ATTEMPTS;
      intento += 1
    ) {
      try {
        const generationResult = await this.iaGenerationProvider.generateJson(
          prompt,
          localPrompt,
        );
        lastGenerationResult = generationResult;
        const parsed = JSON.parse(generationResult.rawJson) as unknown;
        lastRawPayload = parsed;
        const expectedScenarioCount =
          generationResult.provider === 'ollama'
            ? this.resolveLocalScenarioCount(cantidadEscenarios)
            : cantidadEscenarios;
        return {
          ...generationResult,
          casoGenerado: this.validateGeneratedCase(parsed, expectedScenarioCount),
        };
      } catch (error) {
        if (error instanceof SyntaxError) {
          const message =
            'La IA devolvio una respuesta que no pudo interpretarse como JSON valido.';
          lastErrorMessage = message;
          collectedErrors.push(message);
          continue;
        }

        if (error instanceof BadRequestException) {
          lastErrorMessage = error.message;
          collectedErrors.push(error.message);
          continue;
        }

        if (this.shouldAttemptLocalStagedGeneration(error)) {
          return this.generateWithLocalStages(context, cantidadEscenarios);
        }

        throw error;
      }
    }

    if (
      lastGenerationResult?.provider === 'ollama' &&
      this.canPersistPartialDraft(lastGenerationResult, lastRawPayload)
    ) {
      return {
        ...lastGenerationResult,
        borradorParcial: true,
        partialCase: this.buildPartialDraft(context, lastRawPayload),
      };
    }

    return {
      ...(lastGenerationResult ?? {
        rawJson: '{}',
        provider: 'gemini',
        model: 'unknown',
      }),
      casoGenerado: this.coerceIncompleteGeneratedCase(
        context,
        lastRawPayload,
        cantidadEscenarios,
      ),
      borradorIncompleto: true,
    };
  }

  private validateGeneratedCase(
    payload: unknown,
    cantidadEscenarios: number,
  ): CasoGeneradoIa {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('La IA no devolvio un objeto JSON valido.');
    }

    const raw = payload as Record<string, unknown>;
    const titulo = this.requireTrimmedString(raw.titulo, 'titulo', 3, 120);
    const descripcion = this.optionalTrimmedString(raw.descripcion, 'descripcion', 1000);
    const objetivoAprendizaje = this.optionalTrimmedString(
      raw.objetivoAprendizaje,
      'objetivoAprendizaje',
      1000,
    );

    if (!Array.isArray(raw.escenarios) || raw.escenarios.length === 0) {
      throw new BadRequestException('La IA no devolvio escenarios validos.');
    }

    const escenariosRaw = raw.escenarios as unknown[];

    if (escenariosRaw.length !== cantidadEscenarios) {
      throw new BadRequestException(
        'La IA no respeto la cantidad de escenarios solicitada.',
      );
    }

    const escenarios = escenariosRaw.map((item, index) =>
      this.validateScenario(item, index + 1, escenariosRaw.length),
    );

    for (let index = 0; index < escenarios.length; index += 1) {
      const escenario = escenarios[index];

      if (escenario.orden !== index + 1) {
        throw new BadRequestException(
          'La IA debe devolver escenarios consecutivos desde el orden 1.',
        );
      }
    }

    if (!escenarios[escenarios.length - 1]?.isFinal) {
      throw new BadRequestException('El ultimo escenario debe marcarse como final.');
    }

    return {
      titulo,
      descripcion,
      objetivoAprendizaje,
      escenarios,
    };
  }

  private validateScenario(
    payload: unknown,
    expectedOrder: number,
    totalEscenarios: number,
  ): CasoGeneradoIa['escenarios'][number] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Cada escenario debe ser un objeto valido.');
    }

    const raw = payload as Record<string, unknown>;
    const orden = this.requireInteger(raw.orden, 'escenarios[].orden', 1);
    const titulo = this.requireTrimmedString(raw.titulo, 'escenarios[].titulo', 3, 120);
    const situacionTexto = this.requireTrimmedString(
      raw.situacionTexto,
      'escenarios[].situacionTexto',
      10,
      4000,
    );
    const fondoCodigo = this.requireBackground(raw.fondoCodigo);
    const isFinal = this.requireBoolean(raw.isFinal, 'escenarios[].isFinal');

    if (isFinal !== (expectedOrder === totalEscenarios)) {
      throw new BadRequestException(
        'Solo el ultimo escenario debe estar marcado como final.',
      );
    }

    const pregunta =
      raw.pregunta === null || raw.pregunta === undefined
        ? null
        : this.validateQuestion(raw.pregunta);

    if (isFinal && pregunta !== null) {
      throw new BadRequestException(
        'Los escenarios finales deben generarse sin pregunta.',
      );
    }

    if (!isFinal && pregunta === null) {
      throw new BadRequestException(
        'Los escenarios no finales deben incluir una pregunta.',
      );
    }

    return {
      orden,
      titulo,
      situacionTexto,
      fondoCodigo,
      isFinal,
      pregunta,
    };
  }

  private validateQuestion(payload: unknown): NonNullable<CasoGeneradoIa['escenarios'][number]['pregunta']> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('La pregunta generada no es valida.');
    }

    const raw = payload as Record<string, unknown>;
    const enunciado = this.requireTrimmedString(raw.enunciado, 'pregunta.enunciado', 10, 500);
    const tipo = raw.tipo === undefined ? 'single_choice' : raw.tipo;

    if (tipo !== 'single_choice') {
      throw new BadRequestException('La IA solo puede generar preguntas single_choice.');
    }

    const puntajeMaximo = raw.puntajeMaximo === undefined
      ? 5
      : this.normalizeGeneratedNota(raw.puntajeMaximo, 'pregunta.puntajeMaximo');

    if (!Array.isArray(raw.opciones) || raw.opciones.length < 2) {
      throw new BadRequestException(
        'Cada pregunta debe incluir al menos dos opciones.',
      );
    }

    const opciones = raw.opciones.map((item, index) =>
      this.validateOption(item, index + 1),
    );

    return {
      enunciado,
      tipo: 'single_choice',
      puntajeMaximo,
      opciones,
    };
  }

  private validateOption(
    payload: unknown,
    expectedOrder: number,
  ): NonNullable<CasoGeneradoIa['escenarios'][number]['pregunta']>['opciones'][number] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Cada opcion debe ser un objeto valido.');
    }

    const raw = payload as Record<string, unknown>;
    const orden = this.requireInteger(raw.orden, 'opcion.orden', 1);
    const texto = this.requireTrimmedString(raw.texto, 'opcion.texto', 1, 500);
    const puntaje = this.normalizeGeneratedNota(raw.puntaje, 'opcion.puntaje');
    const isCorrecta =
      raw.isCorrecta === undefined
        ? false
        : this.requireBoolean(raw.isCorrecta, 'opcion.isCorrecta');
    const escenarioDestinoOrden =
      raw.escenarioDestinoOrden === undefined || raw.escenarioDestinoOrden === null
        ? null
        : this.requireInteger(raw.escenarioDestinoOrden, 'opcion.escenarioDestinoOrden', 1);
    const retroalimentacion = this.validateFeedback(raw.retroalimentacion);

    if (orden !== expectedOrder) {
      throw new BadRequestException(
        'Las opciones deben venir ordenadas consecutivamente desde 1.',
      );
    }

    return {
      orden,
      texto,
      puntaje,
      isCorrecta,
      escenarioDestinoOrden,
      retroalimentacion,
    };
  }

  private normalizeGeneratedNota(value: unknown, field: string): number {
    const numeric = Number(value);

    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new BadRequestException(`${field} debe ser un numero mayor o igual a 0.`);
    }

    const nota = numeric > 5 ? numeric / 20 : numeric;
    const notaNormalizada = Math.min(nota, 5);

    // La persistencia actual usa columnas integer para puntajes.
    // Redondeamos a la escala entera 0..5 para mantener compatibilidad
    // con PostgREST/PostgreSQL y evitar errores cuando la IA devuelve 0.5, 2.7, etc.
    return Math.round(notaNormalizada);
  }

  private validateFeedback(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException(
        'Cada opcion debe incluir una retroalimentacion valida.',
      );
    }

    const raw = payload as Record<string, unknown>;
    const mensaje = this.requireTrimmedString(
      raw.mensaje,
      'retroalimentacion.mensaje',
      5,
      1200,
    );
    const tipo = raw.tipo === undefined ? 'pedagogica' : raw.tipo;

    if (!['pedagogica', 'correctiva', 'refuerzo'].includes(String(tipo))) {
      throw new BadRequestException('El tipo de retroalimentacion no es valido.');
    }

    const referenciaTeorica = this.optionalTrimmedString(
      raw.referenciaTeorica,
      'retroalimentacion.referenciaTeorica',
      1000,
    );

    return {
      mensaje,
      tipo: tipo as 'pedagogica' | 'correctiva' | 'refuerzo',
      referenciaTeorica,
    };
  }

  private coerceIncompleteGeneratedCase(
    context: {
      instruccion: string | null;
      cantidadEscenarios: number;
      referenciasTexto: string[];
      referenciasCasos: CasoPreviewTree[];
    },
    rawPayload: unknown,
    cantidadEscenarios: number,
  ): CasoGeneradoIa {
    const metadata = this.buildPartialDraft(context, rawPayload);
    const raw =
      rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : {};

    let escenarios: CasoGeneradoIa['escenarios'] = [];

    if (Array.isArray(raw.escenarios) && raw.escenarios.length > 0) {
      escenarios = this.coerceEscenariosFromRaw(
        raw.escenarios as unknown[],
        metadata,
        context,
        cantidadEscenarios,
      );
    }

    if (escenarios.length === 0) {
      escenarios = this.buildMinimalEscenarios(metadata, context, cantidadEscenarios);
    }

    return {
      titulo: this.resolveIncompleteTitle(metadata.titulo),
      descripcion: metadata.descripcion,
      objetivoAprendizaje: metadata.objetivoAprendizaje,
      escenarios,
    };
  }

  private resolveIncompleteTitle(titulo: string): string {
    const normalized = titulo.trim();
    if (normalized.length < 3) {
      return 'Caso generado por IA - requiere revision';
    }

    return normalized;
  }

  private coerceEscenariosFromRaw(
    items: unknown[],
    metadata: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    },
    context: {
      instruccion: string | null;
      referenciasTexto: string[];
    },
    cantidadEscenarios: number,
  ): CasoGeneradoIa['escenarios'] {
    const total = Math.max(1, Math.min(items.length, cantidadEscenarios));
    const escenarios: CasoGeneradoIa['escenarios'] = [];

    for (let index = 0; index < total; index += 1) {
      const orden = index + 1;
      const isFinal = orden === total && total > 1;

      try {
        escenarios.push(this.validateScenario(items[index], orden, total));
      } catch {
        escenarios.push(
          this.buildMinimalEscenario(metadata, context, orden, isFinal),
        );
      }
    }

    return escenarios;
  }

  private buildMinimalEscenarios(
    metadata: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    },
    context: {
      instruccion: string | null;
      referenciasTexto: string[];
    },
    cantidadEscenarios: number,
  ): CasoGeneradoIa['escenarios'] {
    const total = Math.max(1, Math.min(cantidadEscenarios, 2));
    return Array.from({ length: total }, (_, index) => {
      const orden = index + 1;
      return this.buildMinimalEscenario(
        metadata,
        context,
        orden,
        total > 1 && orden === total,
      );
    });
  }

  private buildMinimalEscenario(
    metadata: {
      titulo: string;
      descripcion: string | null;
      objetivoAprendizaje: string | null;
    },
    context: {
      instruccion: string | null;
      referenciasTexto: string[];
    },
    orden: number,
    isFinal: boolean,
  ): CasoGeneradoIa['escenarios'][number] {
    const baseContext =
      metadata.descripcion ??
      context.instruccion ??
      context.referenciasTexto[0] ??
      'Completa la situacion inicial del caso en el editor.';

    return {
      orden,
      titulo:
        orden === 1
          ? `Escenario inicial: ${metadata.titulo}`
          : `Cierre del caso: ${metadata.titulo}`,
      situacionTexto: this.compactText(baseContext, 900),
      fondoCodigo: isFinal ? 'oficina_psicologica' : 'aula',
      isFinal,
      pregunta: isFinal ? null : this.buildDefaultQuestion(metadata, context),
    };
  }

  private buildDefaultQuestion(
    metadata: {
      titulo: string;
      objetivoAprendizaje: string | null;
    },
    context: {
      instruccion: string | null;
    },
  ): NonNullable<CasoGeneradoIa['escenarios'][number]['pregunta']> {
    const enunciadoBase =
      metadata.objetivoAprendizaje ??
      context.instruccion ??
      'Define la pregunta situada para este escenario.';

    return {
      enunciado: this.compactText(
        `¿Cuál es la intervención más adecuada? ${enunciadoBase}`,
        500,
      ),
      tipo: 'single_choice',
      puntajeMaximo: 5,
      opciones: [
        {
          orden: 1,
          texto: 'Opción A — completa esta respuesta',
          puntaje: 3,
          isCorrecta: false,
          escenarioDestinoOrden: null,
          retroalimentacion: {
            mensaje:
              'Revisa y completa la retroalimentacion pedagogica de esta opcion.',
            tipo: 'pedagogica',
          },
        },
        {
          orden: 2,
          texto: 'Opción B — completa esta respuesta',
          puntaje: 5,
          isCorrecta: true,
          escenarioDestinoOrden: null,
          retroalimentacion: {
            mensaje:
              'Revisa y completa la retroalimentacion pedagogica de esta opcion.',
            tipo: 'refuerzo',
          },
        },
      ],
    };
  }

  private async persistGeneratedCase(
    caso: CasoGeneradoIa,
    currentUser: AuthenticatedUser,
  ): Promise<{ id: string; titulo: string; borradorIncompleto?: boolean }> {
    const createdCase = {
      casoId: '' as string,
      escenarioIds: [] as string[],
      preguntaIds: [] as string[],
      opcionIds: [] as string[],
      retroalimentacionIds: [] as string[],
    };

    try {
      const casoCreado = await this.casosService.create(
        {
          titulo: caso.titulo,
          descripcion: caso.descripcion ?? undefined,
          objetivoAprendizaje: caso.objetivoAprendizaje ?? undefined,
        } satisfies CreateCasoDto,
        currentUser,
      );
      createdCase.casoId = casoCreado.id;

      const escenarioIdByOrden = new Map<number, string>();
      const opcionDestinoPendiente: Array<{
        opcionId: string;
        escenarioDestinoOrden: number;
      }> = [];

      for (const escenario of caso.escenarios) {
        const escenarioCreado = await this.escenariosService.create(
          casoCreado.id,
          {
            orden: escenario.orden,
            titulo: escenario.titulo,
            situacionTexto: escenario.situacionTexto,
            fondoCodigo: escenario.fondoCodigo,
            isFinal: escenario.isFinal,
          } satisfies CreateEscenarioDto,
          currentUser,
        );
        createdCase.escenarioIds.push(escenarioCreado.id);
        escenarioIdByOrden.set(escenario.orden, escenarioCreado.id);

        if (!escenario.pregunta) {
          continue;
        }

        const preguntaCreada = await this.decisionesService.createPregunta(
          escenarioCreado.id,
          {
            enunciado: escenario.pregunta.enunciado,
            tipo: escenario.pregunta.tipo,
            puntajeMaximo: escenario.pregunta.puntajeMaximo,
          } satisfies CreatePreguntaDecisionDto,
          currentUser,
        );
        createdCase.preguntaIds.push(preguntaCreada.id);

        for (const opcion of escenario.pregunta.opciones) {
          const opcionCreada = await this.decisionesService.createOpcion(
            preguntaCreada.id,
            {
              texto: opcion.texto,
              orden: opcion.orden,
              puntaje: opcion.puntaje,
              isCorrecta: opcion.isCorrecta,
              escenarioDestinoId: null,
            } satisfies CreateOpcionRespuestaDto,
            currentUser,
          );
          createdCase.opcionIds.push(opcionCreada.id);

          if (opcion.escenarioDestinoOrden) {
            opcionDestinoPendiente.push({
              opcionId: opcionCreada.id,
              escenarioDestinoOrden: opcion.escenarioDestinoOrden,
            });
          }

          const retroCreada = await this.retroalimentacionesService.create(
            opcionCreada.id,
            {
              mensaje: opcion.retroalimentacion.mensaje,
              tipo: opcion.retroalimentacion.tipo,
              referenciaTeorica:
                opcion.retroalimentacion.referenciaTeorica ?? undefined,
            } satisfies CreateRetroalimentacionDto,
            currentUser,
          );
          createdCase.retroalimentacionIds.push(retroCreada.id);
        }
      }

      for (const pendiente of opcionDestinoPendiente) {
        const escenarioDestinoId = escenarioIdByOrden.get(
          pendiente.escenarioDestinoOrden,
        );

        if (!escenarioDestinoId) {
          throw new BadRequestException(
            `No existe un escenario destino con orden ${pendiente.escenarioDestinoOrden}.`,
          );
        }

        await this.decisionesService.updateOpcion(
          pendiente.opcionId,
          { escenarioDestinoId },
          currentUser,
        );
      }

      const validationErrors = await this.publicacionService.validateCaseCompletenessById(
        casoCreado.id,
      );

      if (validationErrors.length > 0) {
        return {
          id: casoCreado.id,
          titulo: casoCreado.titulo,
          borradorIncompleto: true,
        };
      }

      return {
        id: casoCreado.id,
        titulo: casoCreado.titulo,
      };
    } catch (error) {
      await this.rollbackCreatedData(createdCase);
      throw error;
    }
  }

  private async rollbackCreatedData(created: {
    casoId: string;
    escenarioIds: string[];
    preguntaIds: string[];
    opcionIds: string[];
    retroalimentacionIds: string[];
  }): Promise<void> {
    if (created.retroalimentacionIds.length > 0) {
      await this.postgrest.remove('retroalimentaciones', {
        filters: { id: created.retroalimentacionIds },
      });
    }

    if (created.opcionIds.length > 0) {
      await this.postgrest.remove('opciones_respuesta', {
        filters: { id: created.opcionIds },
      });
    }

    if (created.preguntaIds.length > 0) {
      await this.postgrest.remove('preguntas_decision', {
        filters: { id: created.preguntaIds },
      });
    }

    if (created.escenarioIds.length > 0) {
      await this.postgrest.remove('escenarios', {
        filters: { id: created.escenarioIds },
      });
    }

    if (created.casoId) {
      await this.postgrest.remove('casos', {
        filters: { id: created.casoId },
      });
    }
  }

  private requireTrimmedString(
    value: unknown,
    field: string,
    minLength: number,
    maxLength: number,
  ): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`El campo ${field} debe ser texto.`);
    }

    const normalized = value.trim();

    if (normalized.length < minLength || normalized.length > maxLength) {
      throw new BadRequestException(
        `El campo ${field} debe tener entre ${minLength} y ${maxLength} caracteres.`,
      );
    }

    return normalized;
  }

  private optionalTrimmedString(
    value: unknown,
    field: string,
    maxLength: number,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`El campo ${field} debe ser texto.`);
    }

    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized.slice(0, maxLength);
  }

  private requireInteger(value: unknown, field: string, min: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
      throw new BadRequestException(
        `El campo ${field} debe ser un entero mayor o igual a ${min}.`,
      );
    }

    return value;
  }

  private requireBoolean(value: unknown, field: string): boolean {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`El campo ${field} debe ser booleano.`);
    }

    return value;
  }

  private requireBackground(value: unknown): CasoGeneradoIa['escenarios'][number]['fondoCodigo'] {
    if (
      typeof value !== 'string' ||
      !['aula', 'oficina_psicologica', 'casa', 'comisaria_familia', 'sala_espera'].includes(
        value,
      )
    ) {
      throw new BadRequestException('El fondoCodigo generado no es valido.');
    }

    return value as CasoGeneradoIa['escenarios'][number]['fondoCodigo'];
  }

  private assertDocenteRole(currentUser: AuthenticatedUser): void {
    const casosServiceWithPermission = this.casosService as CasosService & {
      assertCanCreateCases?: (user: AuthenticatedUser) => void;
    };

    if (typeof casosServiceWithPermission.assertCanCreateCases === 'function') {
      casosServiceWithPermission.assertCanCreateCases(currentUser);
      return;
    }

    if (currentUser.role === Role.PROFESOR || currentUser.role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenException(
      'Solo docentes o administradores pueden generar casos con IA.',
    );
  }

  private uniqueErrors(errors: string[]): string[] {
    return [...new Set(errors.map((item) => item.trim()).filter((item) => item.length > 0))];
  }
}
