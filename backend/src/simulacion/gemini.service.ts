import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
  private static readonly TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAYS_MS = [300, 900];
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? null;
    this.model = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    this.apiUrl = this.configService.get<string>(
      'GEMINI_API_URL',
      'https://generativelanguage.googleapis.com/v1beta/models',
    );
  }

  getModelName(): string {
    return this.model;
  }

  async generateJson(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'La generacion con IA no esta disponible porque GEMINI_API_KEY no esta configurada.',
      );
    }

    const url = `${this.apiUrl.replace(/\/$/, '')}/${this.model}:generateContent?key=${this.apiKey}`;

    for (let attempt = 1; attempt <= GeminiService.MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
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
          if (this.isTransientStatus(response.status)) {
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

          const detail = await this.safeReadError(response);
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

  private isTransientStatus(status: number): boolean {
    return GeminiService.TRANSIENT_STATUS_CODES.has(status);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
