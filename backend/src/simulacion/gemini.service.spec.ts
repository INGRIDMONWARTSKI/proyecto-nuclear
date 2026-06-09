import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';

describe('GeminiService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
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

    await expect(service.generateJson('Genera un caso.')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
