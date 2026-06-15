import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CasoIaProvider } from './interfaces/caso-ia-provider.interface';

@Injectable()
export class OllamaService implements CasoIaProvider {
  private readonly logger = new Logger(OllamaService.name);
  private static readonly DIRECT_FALLBACK_TIMEOUT_MS = 20000;
  private readonly model: string | null;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.model = this.normalizeModel(
      this.configService.get<string>('OLLAMA_MODEL'),
    );
    this.baseUrl = this.configService.get<string>(
      'OLLAMA_BASE_URL',
      'http://127.0.0.1:11434',
    );
    this.timeoutMs = this.normalizeTimeout(
      this.configService.get<string>('OLLAMA_TIMEOUT_MS'),
    );
  }

  getProviderName(): string {
    return 'ollama';
  }

  getModelName(): string {
    return this.model ?? 'ollama-not-configured';
  }

  isConfigured(): boolean {
    return Boolean(this.model);
  }

  async generateJson(
    prompt: string,
    options?: {
      timeoutMs?: number;
    },
  ): Promise<string> {
    if (!this.model) {
      this.logger.warn(
        '[Ollama] provider=ollama type=not_configured detail=OLLAMA_MODEL is missing or empty',
      );
      throw new ServiceUnavailableException({
        message:
          'La generacion con IA local no esta disponible porque OLLAMA_MODEL no esta configurado.',
        code: 'IA_LOCAL_NOT_CONFIGURED',
      });
    }

    const requestTimeoutMs = this.resolveTimeout(options?.timeoutMs);
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(this.buildRequestUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.7,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await this.safeReadError(response);
        this.logger.warn(
          `[Ollama] provider=ollama model=${this.model} status=${response.status} detail=${detail}`,
        );
        throw new BadGatewayException({
          message:
            'La IA local no pudo generar una respuesta valida en este momento.',
          code: 'IA_LOCAL_PROVIDER_ERROR',
          detail,
        });
      }

      const body = (await response.json()) as {
        response?: string;
        message?: {
          content?: string;
        };
      };

      const text = body.response?.trim() ?? body.message?.content?.trim() ?? '';

      if (!text) {
        this.logger.warn(
          `[Ollama] provider=ollama model=${this.model} type=empty_response detail=Empty response content`,
        );
        throw new BadGatewayException({
          message:
            'La IA local no devolvio contenido utilizable para la generacion del caso.',
          code: 'IA_LOCAL_EMPTY_RESPONSE',
        });
      }

      return text;
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      const detail =
        error instanceof Error ? error.message : 'unknown local provider error';

      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(
          `[Ollama] provider=ollama model=${this.model} type=timeout timeoutMs=${requestTimeoutMs}`,
        );
        throw new ServiceUnavailableException({
          message:
            'La IA local supero el tiempo maximo de respuesta. Prueba con un modelo mas ligero o aumenta OLLAMA_TIMEOUT_MS.',
          code: 'IA_LOCAL_TIMEOUT',
        });
      }

      this.logger.warn(
        `[Ollama] provider=ollama model=${this.model} type=connection detail=${detail}`,
      );
      throw new ServiceUnavailableException({
        message: 'No fue posible comunicarse con la IA local.',
        code: 'IA_LOCAL_CONNECTION_ERROR',
      });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private normalizeModel(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeTimeout(value: string | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 300000;
  }

  private buildRequestUrl(): string {
    return `${this.baseUrl.replace(/\/$/, '')}/api/generate`;
  }

  getDirectFallbackTimeoutMs(): number {
    return Math.min(this.timeoutMs, OllamaService.DIRECT_FALLBACK_TIMEOUT_MS);
  }

  private resolveTimeout(timeoutMsOverride: number | undefined): number {
    if (typeof timeoutMsOverride === 'number' && Number.isFinite(timeoutMsOverride)) {
      return timeoutMsOverride > 0 ? timeoutMsOverride : this.timeoutMs;
    }

    return this.timeoutMs;
  }

  private async safeReadError(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };

      return body.error ?? body.message ?? response.statusText;
    } catch {
      return response.statusText;
    }
  }
}
