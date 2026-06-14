import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';

describe('GeminiService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('falla de forma controlada cuando GEMINI_API_KEY no esta configurada', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'GEMINI_MODEL') {
          return defaultValue ?? 'gemini-2.5-flash';
        }

        if (key === 'GEMINI_API_URL') {
          return defaultValue ?? 'https://generativelanguage.googleapis.com/v1beta/models';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    global.fetch = jest.fn();

    const service = new GeminiService(configService);

    await expect(service.generateJson('Genera un caso.')).rejects.toMatchObject({
      response: {
        code: 'IA_NOT_CONFIGURED',
      },
    });
    await expect(service.generateJson('Genera un caso.')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reintenta cuando Gemini responde 503 y falla con mensaje controlado', async () => {
    jest.useFakeTimers();

    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'api-key';
        }

        if (key === 'GEMINI_MODEL') {
          return defaultValue ?? 'gemini-2.5-flash';
        }

        if (key === 'GEMINI_API_URL') {
          return defaultValue ?? 'https://generativelanguage.googleapis.com/v1beta/models';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    const transientResponse = {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: jest.fn().mockResolvedValue({
        error: {
          message: 'High demand.',
        },
      }),
    } as unknown as Response;

    global.fetch = jest
      .fn()
      .mockResolvedValue(transientResponse) as unknown as typeof fetch;

    const service = new GeminiService(configService);
    const promise = service.generateJson('Genera un caso.');
    const expectation = expect(promise).rejects.toMatchObject({
      response: {
        code: 'IA_SERVICE_TEMPORARILY_UNAVAILABLE',
      },
    });

    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow(ServiceUnavailableException);
    await expectation;
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('falla con rate limit cuando Gemini responde 429', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'api-key';
        }

        if (key === 'GEMINI_MODEL') {
          return defaultValue ?? 'gemini-2.5-flash';
        }

        if (key === 'GEMINI_API_URL') {
          return defaultValue ?? 'https://generativelanguage.googleapis.com/v1beta/models';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: jest.fn().mockResolvedValue({
        error: {
          message: 'Quota exceeded for quota metric.',
        },
      }),
    } as unknown as Response) as unknown as typeof fetch;

    const service = new GeminiService(configService);

    await expect(service.generateJson('Genera un caso.')).rejects.toMatchObject({
      response: {
        code: 'IA_RATE_LIMIT',
      },
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falla con bad gateway controlado para errores no transitorios del proveedor', async () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'api-key';
        }

        if (key === 'GEMINI_MODEL') {
          return defaultValue ?? 'gemini-2.5-flash';
        }

        if (key === 'GEMINI_API_URL') {
          return defaultValue ?? 'https://generativelanguage.googleapis.com/v1beta/models';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: jest.fn().mockResolvedValue({
        error: {
          message: 'Prompt rejected.',
        },
      }),
    } as unknown as Response) as unknown as typeof fetch;

    const service = new GeminiService(configService);

    const promise = service.generateJson('Genera un caso.');

    await expect(promise).rejects.toThrow(BadGatewayException);
    await expect(promise).rejects.toMatchObject({
      response: {
        code: 'IA_PROVIDER_ERROR',
      },
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
