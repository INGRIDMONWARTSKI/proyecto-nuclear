import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaService } from './ollama.service';

describe('OllamaService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('genera contenido usando Ollama', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'OLLAMA_MODEL') {
          return 'llama3.1';
        }

        if (key === 'OLLAMA_BASE_URL') {
          return defaultValue ?? 'http://localhost:11434';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        response: '{"titulo":"Caso local"}',
      }),
    } as unknown as Response) as unknown as typeof fetch;

    const service = new OllamaService(configService);

    await expect(service.generateJson('Genera un caso.')).resolves.toBe(
      '{"titulo":"Caso local"}',
    );
  });

  it('falla de forma controlada cuando OLLAMA_MODEL no esta configurado', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'OLLAMA_BASE_URL') {
          return defaultValue ?? 'http://localhost:11434';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    global.fetch = jest.fn();

    const service = new OllamaService(configService);

    await expect(service.generateJson('Genera un caso.')).rejects.toMatchObject({
      response: {
        code: 'IA_LOCAL_NOT_CONFIGURED',
      },
    });
    await expect(service.generateJson('Genera un caso.')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falla de forma controlada cuando no puede conectarse a Ollama', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'OLLAMA_MODEL') {
          return 'llama3.1';
        }

        if (key === 'OLLAMA_BASE_URL') {
          return defaultValue ?? 'http://localhost:11434';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch;

    const service = new OllamaService(configService);

    await expect(service.generateJson('Genera un caso.')).rejects.toMatchObject({
      response: {
        code: 'IA_LOCAL_CONNECTION_ERROR',
      },
    });
  });

  it('falla con timeout controlado cuando Ollama supera el tiempo maximo', async () => {
    jest.useFakeTimers();

    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'OLLAMA_MODEL') {
          return 'qwen2.5:7b';
        }

        if (key === 'OLLAMA_BASE_URL') {
          return defaultValue ?? 'http://127.0.0.1:11434';
        }

        if (key === 'OLLAMA_TIMEOUT_MS') {
          return '10';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    global.fetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        }),
    ) as unknown as typeof fetch;

    const service = new OllamaService(configService);
    const promise = service.generateJson('Genera un caso.');
    const expectation = expect(promise).rejects.toMatchObject({
      response: {
        code: 'IA_LOCAL_TIMEOUT',
      },
    });

    await jest.advanceTimersByTimeAsync(20);
    await expectation;

    jest.useRealTimers();
  });

  it('falla cuando Ollama no devuelve texto utilizable', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'OLLAMA_MODEL') {
          return 'llama3.1';
        }

        if (key === 'OLLAMA_BASE_URL') {
          return defaultValue ?? 'http://localhost:11434';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ response: '   ' }),
    } as unknown as Response) as unknown as typeof fetch;

    const service = new OllamaService(configService);

    await expect(service.generateJson('Genera un caso.')).rejects.toThrow(
      BadGatewayException,
    );
    await expect(service.generateJson('Genera un caso.')).rejects.toMatchObject({
      response: {
        code: 'IA_LOCAL_EMPTY_RESPONSE',
      },
    });
  });
});
