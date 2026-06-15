import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { CasoIaGenerationProviderService } from './caso-ia-generation-provider.service';
import { GeminiService } from './gemini.service';
import { OllamaService } from './ollama.service';

describe('CasoIaGenerationProviderService', () => {
  let geminiService: jest.Mocked<GeminiService>;
  let ollamaService: jest.Mocked<OllamaService>;
  let service: CasoIaGenerationProviderService;

  beforeEach(() => {
    geminiService = {
      generateJson: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('gemini'),
      getModelName: jest.fn().mockReturnValue('gemini-2.5-flash'),
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<GeminiService>;
    ollamaService = {
      generateJson: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('ollama'),
      getModelName: jest.fn().mockReturnValue('llama3.1'),
      getDirectFallbackTimeoutMs: jest.fn().mockReturnValue(20000),
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<OllamaService>;
    service = new CasoIaGenerationProviderService(geminiService, ollamaService);
  });

  it('usa Gemini cuando responde bien', async () => {
    geminiService.generateJson.mockResolvedValue('{"ok":true}');

    await expect(service.generateJson('prompt')).resolves.toEqual({
      rawJson: '{"ok":true}',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    expect(ollamaService.generateJson).not.toHaveBeenCalled();
  });

  it('cae a Ollama cuando Gemini falla por rate limit', async () => {
    geminiService.generateJson.mockRejectedValue(
      new ServiceUnavailableException({
        message: 'limit',
        code: 'IA_RATE_LIMIT',
      }),
    );
    ollamaService.generateJson.mockResolvedValue('{"ok":"local"}');

    await expect(service.generateJson('prompt', 'prompt-local')).resolves.toEqual({
      rawJson: '{"ok":"local"}',
      provider: 'ollama',
      model: 'llama3.1',
    });
    expect(ollamaService.generateJson).toHaveBeenCalledWith('prompt-local', {
      timeoutMs: 20000,
    });
  });

  it('cae a Ollama cuando Gemini falla por conexion', async () => {
    geminiService.generateJson.mockRejectedValue(
      new ServiceUnavailableException({
        message: 'conn',
        code: 'IA_CONNECTION_ERROR',
      }),
    );
    ollamaService.generateJson.mockResolvedValue('{"ok":"local"}');

    const result = await service.generateJson('prompt');
    expect(result.provider).toBe('ollama');
  });

  it('no aplica fallback para errores no tecnicos del proveedor primario', async () => {
    geminiService.generateJson.mockRejectedValue(
      new BadGatewayException({
        message: 'prompt rejected',
        code: 'IA_PROVIDER_ERROR',
      }),
    );

    await expect(service.generateJson('prompt')).rejects.toThrow(
      BadGatewayException,
    );
    expect(ollamaService.generateJson).not.toHaveBeenCalled();
  });

  it('propaga el error de Gemini si Ollama no esta configurado', async () => {
    const geminiError = new ServiceUnavailableException({
      message: 'missing',
      code: 'IA_NOT_CONFIGURED',
    });
    geminiService.generateJson.mockRejectedValue(geminiError);
    ollamaService.isConfigured.mockReturnValue(false);

    await expect(service.generateJson('prompt')).rejects.toBe(geminiError);
  });

  it('propaga el error de Ollama si el fallback tambien falla', async () => {
    geminiService.generateJson.mockRejectedValue(
      new ServiceUnavailableException({
        message: 'quota',
        code: 'IA_QUOTA_EXCEEDED',
      }),
    );
    const ollamaError = new ServiceUnavailableException({
      message: 'local down',
      code: 'IA_LOCAL_CONNECTION_ERROR',
    });
    ollamaService.generateJson.mockRejectedValue(ollamaError);

    await expect(service.generateJson('prompt')).rejects.toBe(ollamaError);
  });
});
