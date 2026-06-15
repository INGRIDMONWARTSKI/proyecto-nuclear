import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasosService } from './casos.service';
import { CasoPreviewBuilderService } from './caso-preview-builder.service';
import { DecisionesService } from './decisiones.service';
import { CreateCasoDto } from './dto/create-caso.dto';
import { CreateEscenarioDto } from './dto/create-escenario.dto';
import { CreateOpcionRespuestaDto } from './dto/create-opcion-respuesta.dto';
import { CreatePreguntaDecisionDto } from './dto/create-pregunta-decision.dto';
import { CreateRetroalimentacionDto } from './dto/create-retroalimentacion.dto';
import { GenerateCasoIaDto } from './dto/generate-caso-ia.dto';
import { EscenariosService } from './escenarios.service';
import { GeminiService } from './gemini.service';
import { PublicacionService } from './publicacion.service';
import { RetroalimentacionesService } from './retroalimentaciones.service';
import { CasoGeneradoIa } from './types/caso-generado-ia.types';
import { CasoPreviewTree } from './types/caso-preview.types';

@Injectable()
export class GeneracionCasosIaService {
  private static readonly MAX_GENERATION_ATTEMPTS = 2;

  constructor(
    private readonly casosService: CasosService,
    private readonly escenariosService: EscenariosService,
    private readonly decisionesService: DecisionesService,
    private readonly retroalimentacionesService: RetroalimentacionesService,
    private readonly previewBuilder: CasoPreviewBuilderService,
    private readonly publicacionService: PublicacionService,
    private readonly geminiService: GeminiService,
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

    const prompt = this.buildPrompt(
      {
        instruccion: dto.instruccion?.trim() || null,
        cantidadEscenarios,
        referenciasTexto,
        referenciasCasos,
      },
      this.geminiService.getModelName(),
    );

    const casoGenerado = await this.generateAndValidate(prompt, cantidadEscenarios);
    const creado = await this.persistGeneratedCase(casoGenerado, currentUser);

    return {
      casoId: creado.id,
      titulo: creado.titulo,
      totalEscenarios: casoGenerado.escenarios.length,
      modelo: this.geminiService.getModelName(),
    };
  }

  private normalizeReferenceTexts(texts: string[] | undefined): string[] {
    return (texts ?? []).map((item) => item.trim()).filter((item) => item.length > 0);
  }

  private assertSufficientPromptContext(
    referenciasTexto: string[],
    referenciasCasos: CasoPreviewTree[],
  ): void {
    if (referenciasCasos.length > 0) {
      return;
    }

    const totalCharacters = referenciasTexto.join('\n\n').length;
    const longestReference = referenciasTexto.reduce(
      (max, item) => Math.max(max, item.length),
      0,
    );

    if (totalCharacters < 120 || longestReference < 80) {
      throw new BadRequestException({
        message: 'Agrega mas contexto para generar un caso completo.',
        code: 'IA_PROMPT_INSUFFICIENT',
      });
    }
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
    modelName: string,
  ): string {
    const referenciasCasosJson = JSON.stringify(context.referenciasCasos, null, 2);
    const referenciasTexto = context.referenciasTexto
      .map((item, index) => `Referencia ${index + 1}:\n${item}`)
      .join('\n\n');

    return [
      'Eres un asistente experto en simulaciones de casos psicologicos para uso docente.',
      `Genera exactamente ${context.cantidadEscenarios} escenarios para un caso nuevo.`,
      'Devuelve exclusivamente JSON valido, sin markdown, sin comentarios y sin texto adicional.',
      `El modelo esperado es ${modelName}.`,
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

  private async generateAndValidate(
    prompt: string,
    cantidadEscenarios: number,
  ): Promise<CasoGeneradoIa> {
    let lastErrorMessage =
      'La IA devolvio una estructura que no cumple los requisitos minimos.';
    const collectedErrors: string[] = [];

    for (
      let intento = 0;
      intento < GeneracionCasosIaService.MAX_GENERATION_ATTEMPTS;
      intento += 1
    ) {
      try {
        const raw = await this.geminiService.generateJson(prompt);
        const parsed = JSON.parse(raw) as unknown;
        return this.validateGeneratedCase(parsed, cantidadEscenarios);
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

        throw error;
      }
    }

    throw new UnprocessableEntityException({
      message:
        'La IA genero un borrador invalido y no se guardo. Intenta nuevamente con referencias mas especificas.',
      code: 'IA_DRAFT_INVALID',
      errors: this.uniqueErrors(collectedErrors.length > 0 ? collectedErrors : [lastErrorMessage]),
    });
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

    return Number(Math.min(nota, 5).toFixed(1));
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

  private async persistGeneratedCase(
    caso: CasoGeneradoIa,
    currentUser: AuthenticatedUser,
  ): Promise<{ id: string; titulo: string }> {
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
        throw new UnprocessableEntityException({
          message:
            'La IA genero un borrador invalido y no se guardo. Intenta nuevamente con referencias mas especificas.',
          code: 'IA_DRAFT_INVALID',
          errors: this.uniqueErrors(validationErrors),
        });
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
