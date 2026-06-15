import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CasoIaProvider } from './interfaces/caso-ia-provider.interface';

type GeminiErrorKind =
  | 'not_configured'
  | 'rate_limit'
  | 'quota_exceeded'
  | 'provider_error'
  | 'transient'
  | 'connection'
  | 'empty_response';

@Injectable()
export class GeminiService implements CasoIaProvider {
  private static readonly TRANSIENT_STATUS_CODES = new Set([500, 502, 503, 504]);
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAYS_MS = [300, 900];
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.normalizeApiKey(
      this.configService.get<string>('GEMINI_API_KEY'),
    );
    this.model = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    this.apiUrl = this.configService.get<string>(
      'GEMINI_API_URL',
      'https://generativelanguage.googleapis.com/v1beta/models',
    );
  }

  getModelName(): string {
    return this.model;
  }

  getProviderName(): string {
    return 'gemini';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generateJson(prompt: string): Promise<string> {
    if (!this.apiKey) {
      this.logSafeFailure('not_configured', undefined, 'GEMINI_API_KEY is missing or empty');
      throw new ServiceUnavailableException({
        message:
          'La generacion con IA no esta disponible porque GEMINI_API_KEY no esta configurada.',
        code: 'IA_NOT_CONFIGURED',
      });
    }

    const endpoint = this.buildEndpointPath();

    for (let attempt = 1; attempt <= GeminiService.MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(this.buildRequestUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const detail = await this.safeReadError(response);
          const errorKind = this.classifyHttpError(response.status, detail);

          if (
            errorKind === 'rate_limit' ||
            errorKind === 'quota_exceeded' ||
            errorKind === 'not_configured'
          ) {
            this.logSafeFailure(errorKind, response.status, detail, endpoint, attempt);
            throw this.buildProviderException(errorKind, detail);
          }

          if (errorKind === 'provider_error') {
            this.logSafeFailure(errorKind, response.status, detail, endpoint, attempt);
            throw new BadGatewayException({
              message:
                'La IA no pudo generar una respuesta valida en este momento. Intenta nuevamente.',
              code: 'IA_PROVIDER_ERROR',
              detail,
            });
          }

          if (errorKind === 'transient') {
            this.logSafeFailure(errorKind, response.status, detail, endpoint, attempt);

            if (attempt < GeminiService.MAX_ATTEMPTS) {
              await this.delay(
                GeminiService.RETRY_DELAYS_MS[attempt - 1] ??
                  GeminiService.RETRY_DELAYS_MS.at(-1)!,
              );
              continue;
            }

            throw new ServiceUnavailableException({
              message:
                'El servicio de IA esta temporalmente saturado. Intenta de nuevo en unos minutos.',
              code: 'IA_SERVICE_TEMPORARILY_UNAVAILABLE',
            });
          }

          this.logSafeFailure(errorKind, response.status, detail, endpoint, attempt);
          throw new BadGatewayException({
            message:
              'La IA no pudo generar una respuesta valida en este momento. Intenta nuevamente.',
            code: 'IA_PROVIDER_ERROR',
            detail,
          });
        }

        const body = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                text?: string;
              }>;
            };
          }>;
        };

        const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!text) {
          this.logSafeFailure('empty_response', response.status, 'Empty candidate text', endpoint);
          throw new BadGatewayException({
            message:
              'La IA no devolvio contenido utilizable para la generacion del caso.',
            code: 'IA_EMPTY_RESPONSE',
          });
        }

        return text;
      } catch (error) {
        if (
          error instanceof ServiceUnavailableException ||
          error instanceof BadGatewayException
        ) {
          throw error;
        }

        this.logSafeFailure('connection', undefined, String(error), endpoint, attempt);

        if (attempt < GeminiService.MAX_ATTEMPTS) {
          await this.delay(
            GeminiService.RETRY_DELAYS_MS[attempt - 1] ??
              GeminiService.RETRY_DELAYS_MS.at(-1)!,
          );
          continue;
        }

        throw new ServiceUnavailableException({
          message: 'No fue posible comunicarse con el servicio de IA.',
          code: 'IA_CONNECTION_ERROR',
        });
      }
    }

    throw new ServiceUnavailableException({
      message: 'No fue posible comunicarse con el servicio de IA.',
      code: 'IA_CONNECTION_ERROR',
    });
  }

  private normalizeApiKey(value: string | undefined): string | null {
    const normalized = value?.trim();
    if (!normalized || normalized === 'tu-api-key') {
      return null;
    }

    return normalized;
  }

  private buildEndpointPath(): string {
    return `${this.apiUrl.replace(/\/$/, '')}/${this.model}:generateContent`;
  }

  private buildRequestUrl(): string {
    return `${this.buildEndpointPath()}?key=${this.apiKey}`;
  }

  private classifyHttpError(status: number, detail: string): GeminiErrorKind {
    const normalizedDetail = detail.toLowerCase();

    if (status === 429) {
      return 'rate_limit';
    }

    if (
      status === 403 &&
      (normalizedDetail.includes('quota') ||
        normalizedDetail.includes('billing') ||
        normalizedDetail.includes('resource_exhausted'))
    ) {
      return 'quota_exceeded';
    }

    if (
      status === 400 &&
      (normalizedDetail.includes('api key') ||
        normalizedDetail.includes('api_key') ||
        normalizedDetail.includes('invalid key'))
    ) {
      return 'not_configured';
    }

    if (GeminiService.TRANSIENT_STATUS_CODES.has(status)) {
      return 'transient';
    }

    return 'provider_error';
  }

  private buildProviderException(
    kind: 'rate_limit' | 'quota_exceeded' | 'not_configured',
    detail: string,
  ): ServiceUnavailableException {
    if (kind === 'not_configured') {
      return new ServiceUnavailableException({
        message:
          'La generacion con IA no esta disponible porque GEMINI_API_KEY no esta configurada o es invalida.',
        code: 'IA_NOT_CONFIGURED',
        detail,
      });
    }

    return new ServiceUnavailableException({
      message:
        'El servicio de IA alcanzo su limite temporal. Intenta mas tarde.',
      code: kind === 'quota_exceeded' ? 'IA_QUOTA_EXCEEDED' : 'IA_RATE_LIMIT',
      detail,
    });
  }

  private logSafeFailure(
    kind: GeminiErrorKind,
    status: number | undefined,
    detail: string,
    endpoint?: string,
    attempt?: number,
  ): void {
    const attemptSuffix =
      attempt !== undefined ? ` attempt=${attempt}/${GeminiService.MAX_ATTEMPTS}` : '';

    this.logger.warn(
      `[Gemini] provider=google model=${this.model} endpoint=${endpoint ?? this.buildEndpointPath()} type=${kind} status=${status ?? 'n/a'}${attemptSuffix} detail=${detail}`,
    );
  }

  private async safeReadError(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as {
        error?: {
          message?: string;
          status?: string;
        };
      };

      return body.error?.message ?? body.error?.status ?? response.statusText;
    } catch {
      return response.statusText;
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
