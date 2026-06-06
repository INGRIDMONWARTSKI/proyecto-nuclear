import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
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
    const url = `${this.apiUrl.replace(/\/$/, '')}/${this.model}:generateContent?key=${this.apiKey}`;

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
        const detail = await this.safeReadError(response);
        throw new BadGatewayException(
          `Gemini error (${response.status}): ${detail}`,
        );
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
        throw new BadGatewayException(
          'Gemini no devolvio contenido utilizable para la generacion.',
        );
      }

      return text;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'No fue posible comunicarse con Gemini.',
      );
    }
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
}
