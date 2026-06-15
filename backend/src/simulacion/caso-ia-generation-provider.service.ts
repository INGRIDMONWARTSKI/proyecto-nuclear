import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { OllamaService } from './ollama.service';
import { CasoIaGenerationResult } from './types/caso-ia-generation.types';

@Injectable()
export class CasoIaGenerationProviderService {
  private readonly logger = new Logger(CasoIaGenerationProviderService.name);
  private static readonly FALLBACK_ERROR_CODES = new Set([
    'IA_NOT_CONFIGURED',
    'IA_RATE_LIMIT',
    'IA_QUOTA_EXCEEDED',
    'IA_SERVICE_TEMPORARILY_UNAVAILABLE',
    'IA_CONNECTION_ERROR',
  ]);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly ollamaService: OllamaService,
  ) {}

  async generateJson(
    prompt: string,
    fallbackPrompt?: string,
  ): Promise<CasoIaGenerationResult> {
    try {
      const rawJson = await this.geminiService.generateJson(prompt);
      return {
        rawJson,
        provider: this.geminiService.getProviderName(),
        model: this.geminiService.getModelName(),
      };
    } catch (error) {
      if (!this.shouldFallback(error)) {
        throw error;
      }

      if (!this.ollamaService.isConfigured()) {
        this.logger.warn(
          `[CasoIAFallback] primary=${this.geminiService.getProviderName()} primaryModel=${this.geminiService.getModelName()} reason=${this.getErrorCode(error)} fallback=ollama status=skipped`,
        );
        throw error;
      }

      this.logger.warn(
        `[CasoIAFallback] primary=${this.geminiService.getProviderName()} primaryModel=${this.geminiService.getModelName()} reason=${this.getErrorCode(error)} fallback=${this.ollamaService.getProviderName()} fallbackModel=${this.ollamaService.getModelName()} status=started`,
      );

      try {
        const rawJson = await this.ollamaService.generateJson(
          fallbackPrompt ?? prompt,
          {
            timeoutMs: this.ollamaService.getDirectFallbackTimeoutMs(),
          },
        );
        this.logger.warn(
          `[CasoIAFallback] primary=${this.geminiService.getProviderName()} final=${this.ollamaService.getProviderName()} finalModel=${this.ollamaService.getModelName()} reason=${this.getErrorCode(error)} status=success`,
        );
        return {
          rawJson,
          provider: this.ollamaService.getProviderName(),
          model: this.ollamaService.getModelName(),
        };
      } catch (fallbackError) {
        this.logger.warn(
          `[CasoIAFallback] primary=${this.geminiService.getProviderName()} final=${this.ollamaService.getProviderName()} finalModel=${this.ollamaService.getModelName()} reason=${this.getErrorCode(error)} fallbackReason=${this.getErrorCode(fallbackError)} status=failed`,
        );
        throw fallbackError;
      }
    }
  }

  private shouldFallback(error: unknown): boolean {
    return CasoIaGenerationProviderService.FALLBACK_ERROR_CODES.has(
      this.getErrorCode(error),
    );
  }

  private getErrorCode(error: unknown): string {
    if (error instanceof ServiceUnavailableException) {
      const response = error.getResponse();
      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return response.code;
      }
    }

    return 'UNKNOWN_ERROR';
  }
}
