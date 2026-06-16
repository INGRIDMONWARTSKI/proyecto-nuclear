import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CasosService } from '../simulacion/casos.service';
import { BackgroundRemovalService } from './background-removal.service';
import { AiAssetsService } from './ai-assets.service';
import { PromptBuilderService } from './prompt-builder.service';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(new Error('missing sidecar')),
}));

describe('AiAssetsService', () => {
  const currentUser: AuthenticatedUser = {
    sub: 'docente-1',
    email: 'docente@example.com',
    role: Role.PROFESOR,
    tokenVersion: 1,
  };

  let service: AiAssetsService;
  let postgrest: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
  };
  let casosService: {
    findCasoById: jest.Mock;
    assertCanAccessCasoDocente: jest.Mock;
  };
  let backgroundRemovalService: {
    removeBackground: jest.Mock;
  };

  beforeEach(() => {
    postgrest = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    casosService = {
      findCasoById: jest.fn(),
      assertCanAccessCasoDocente: jest.fn(),
    };
    backgroundRemovalService = {
      removeBackground: jest.fn(),
    };

    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('missing sidecar'));

    service = new AiAssetsService(
      postgrest as never,
      casosService as never,
      new PromptBuilderService(),
      backgroundRemovalService as never,
      {
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'APP_PUBLIC_URL') {
            return 'http://localhost:3000';
          }
          return defaultValue;
        }),
      } as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips background removal for background assets', async () => {
    casosService.findCasoById.mockResolvedValue({ id: 'caso-1', autor_docente_id: 'docente-1' });
    postgrest.select.mockResolvedValueOnce([
      {
        id: 'esc-1',
        caso_id: 'caso-1',
        titulo: 'Escena',
        situacion_texto: 'Situacion',
      },
    ]);
    postgrest.insert.mockResolvedValue({
      id: 'asset-1',
      caso_id: 'caso-1',
      escenario_id: 'esc-1',
      docente_id: 'docente-1',
      tipo: 'FONDO',
      nombre: 'fondo',
      prompt_original: 'fondo',
      prompt_final: 'fondo final',
      url_externa: 'https://huggingface.co/test/model',
      ruta_archivo: '/uploads/ai-assets/test.jpg',
      ancho: 1280,
      alto: 720,
      estilo: 'editorial_sereno',
      proveedor: 'huggingface',
      created_at: new Date().toISOString(),
    });

    jest.spyOn(service as never, 'fetchHuggingFaceImage' as never).mockResolvedValue({
      buffer: Buffer.from('jpg-data'),
      url: 'https://huggingface.co/test/model',
    });

    const asset = await service.generate(
      {
        casoId: 'caso-1',
        escenarioId: 'esc-1',
        tipo: 'FONDO',
        visibleType: 'background',
        descripcion: 'consultorio sereno con luz natural',
        estilo: 'editorial_sereno',
      },
      currentUser,
    );

    expect(backgroundRemovalService.removeBackground).not.toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.jpg'),
      expect.any(Buffer),
    );
    expect(asset.imageUrl).toBe('/uploads/ai-assets/test.jpg');
    expect(asset.metadata?.backgroundRemoved).toBeUndefined();
  });

  it('uses transparent png when background removal succeeds', async () => {
    casosService.findCasoById.mockResolvedValue({ id: 'caso-1', autor_docente_id: 'docente-1' });
    postgrest.select.mockResolvedValueOnce([
      {
        id: 'esc-1',
        caso_id: 'caso-1',
        titulo: 'Escena',
        situacion_texto: 'Situacion',
      },
    ]);
    postgrest.insert.mockImplementation(async (_table, payload) => ({
      id: 'asset-1',
      caso_id: payload.caso_id,
      escenario_id: payload.escenario_id,
      docente_id: payload.docente_id,
      tipo: payload.tipo,
      nombre: payload.nombre,
      prompt_original: payload.prompt_original,
      prompt_final: payload.prompt_final,
      url_externa: payload.url_externa,
      ruta_archivo: payload.ruta_archivo,
      ancho: payload.ancho,
      alto: payload.alto,
      estilo: payload.estilo,
      proveedor: payload.proveedor,
      created_at: new Date().toISOString(),
    }));
    backgroundRemovalService.removeBackground.mockResolvedValue({
      backgroundRemoved: true,
      processedBuffer: Buffer.from('png-data'),
    });
    jest.spyOn(service as never, 'fetchHuggingFaceImage' as never).mockResolvedValue({
      buffer: Buffer.from('jpg-data'),
      url: 'https://huggingface.co/test/model',
    });
    (fs.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify({
        backgroundRemoved: true,
        originalRelativePath: '/uploads/ai-assets/test.jpg',
        processedRelativePath: '/uploads/ai-assets/test.png',
      }),
    );

    const asset = await service.generate(
      {
        casoId: 'caso-1',
        escenarioId: 'esc-1',
        tipo: 'PERSONAJE',
        visibleType: 'character',
        descripcion: 'nino triste sentado en un salon de clase',
        estilo: 'editorial_sereno',
      },
      currentUser,
    );

    expect(backgroundRemovalService.removeBackground).toHaveBeenCalledTimes(1);
    expect(postgrest.insert).toHaveBeenCalledWith(
      'recursos_visuales',
      expect.objectContaining({
        ruta_archivo: expect.stringMatching(/\.png$/),
      }),
      { select: '*' },
    );
    expect(asset.rutaArchivo).toMatch(/\.png$/);
    expect(asset.imageUrl).toBe(asset.rutaArchivo);
    expect(asset.metadata).toMatchObject({
      backgroundRemoved: true,
      originalImageUrl: '/uploads/ai-assets/test.jpg',
      processedImageUrl: '/uploads/ai-assets/test.png',
    });
  });

  it('falls back to original image when background removal fails', async () => {
    casosService.findCasoById.mockResolvedValue({ id: 'caso-1', autor_docente_id: 'docente-1' });
    postgrest.select.mockResolvedValueOnce([
      {
        id: 'esc-1',
        caso_id: 'caso-1',
        titulo: 'Escena',
        situacion_texto: 'Situacion',
      },
    ]);
    postgrest.insert.mockImplementation(async (_table, payload) => ({
      id: 'asset-1',
      caso_id: payload.caso_id,
      escenario_id: payload.escenario_id,
      docente_id: payload.docente_id,
      tipo: payload.tipo,
      nombre: payload.nombre,
      prompt_original: payload.prompt_original,
      prompt_final: payload.prompt_final,
      url_externa: payload.url_externa,
      ruta_archivo: payload.ruta_archivo,
      ancho: payload.ancho,
      alto: payload.alto,
      estilo: payload.estilo,
      proveedor: payload.proveedor,
      created_at: new Date().toISOString(),
    }));
    backgroundRemovalService.removeBackground.mockResolvedValue({
      backgroundRemoved: false,
      warning: 'La remocion de fondo tardo demasiado.',
    });
    jest.spyOn(service as never, 'fetchHuggingFaceImage' as never).mockResolvedValue({
      buffer: Buffer.from('jpg-data'),
      url: 'https://huggingface.co/test/model',
    });
    (fs.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify({
        backgroundRemoved: false,
        originalRelativePath: '/uploads/ai-assets/test.jpg',
        backgroundRemovalWarning: 'La remocion de fondo tardo demasiado.',
      }),
    );

    const asset = await service.generate(
      {
        casoId: 'caso-1',
        escenarioId: 'esc-1',
        tipo: 'OBJETO',
        visibleType: 'object',
        descripcion: 'mochila azul en el piso del salon',
        estilo: 'editorial_sereno',
      },
      currentUser,
    );

    expect(postgrest.insert).toHaveBeenCalledWith(
      'recursos_visuales',
      expect.objectContaining({
        ruta_archivo: expect.stringMatching(/\.jpg$/),
      }),
      { select: '*' },
    );
    expect(asset.rutaArchivo).toMatch(/\.jpg$/);
    expect(asset.metadata).toMatchObject({
      originalImageUrl: '/uploads/ai-assets/test.jpg',
      backgroundRemovalWarning: 'La remocion de fondo tardo demasiado.',
    });
  });

  it('keeps listing assets working when sidecar read fails', async () => {
    casosService.findCasoById.mockResolvedValue({ id: 'caso-1', autor_docente_id: 'docente-1' });
    postgrest.select.mockResolvedValueOnce([
      {
        id: 'asset-1',
        caso_id: 'caso-1',
        escenario_id: 'esc-1',
        docente_id: 'docente-1',
        tipo: 'OBJETO',
        nombre: 'objeto',
        prompt_original: 'obj',
        prompt_final: 'obj final',
        url_externa: 'https://huggingface.co/test/model',
        ruta_archivo: '/uploads/ai-assets/test.jpg',
        ancho: 1280,
        alto: 720,
        estilo: 'editorial_sereno',
        proveedor: 'huggingface',
        created_at: new Date().toISOString(),
      },
    ]);

    const assets = await service.listByCaso('caso-1', currentUser);

    expect(assets).toHaveLength(1);
    expect(assets[0].imageUrl).toBe('/uploads/ai-assets/test.jpg');
    expect(assets[0].metadata).toMatchObject({
      provider: 'huggingface',
      visibleType: 'object',
    });
  });

  it('rejects applying an asset generated by another docente', async () => {
    casosService.findCasoById.mockResolvedValue({ id: 'caso-1', autor_docente_id: 'docente-2' });
    postgrest.select.mockResolvedValueOnce([
      {
        id: 'asset-1',
        caso_id: 'caso-1',
        escenario_id: null,
        docente_id: 'docente-2',
        tipo: 'FONDO',
        nombre: 'fondo',
        prompt_original: 'fondo',
        prompt_final: 'fondo',
        url_externa: 'https://huggingface.co/test/model',
        ruta_archivo: '/uploads/ai-assets/test.jpg',
        ancho: 1280,
        alto: 720,
        estilo: 'editorial_sereno',
        proveedor: 'huggingface',
        created_at: new Date().toISOString(),
      },
    ]);

    await expect(
      service.insertIntoScenario('asset-1', { escenarioId: 'esc-1' }, currentUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('inserts object assets using the final processed url', async () => {
    casosService.findCasoById.mockResolvedValue({ id: 'caso-1', autor_docente_id: 'docente-1' });
    postgrest.select
      .mockResolvedValueOnce([
        {
          id: 'asset-1',
          caso_id: 'caso-1',
          escenario_id: null,
          docente_id: 'docente-1',
          tipo: 'OBJETO',
          nombre: 'objeto',
          prompt_original: 'obj',
          prompt_final: 'obj',
          url_externa: 'https://huggingface.co/test/model',
          ruta_archivo: '/uploads/ai-assets/test.png',
          ancho: 1280,
          alto: 720,
          estilo: 'editorial_sereno',
          proveedor: 'huggingface',
          created_at: new Date().toISOString(),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'esc-1',
          caso_id: 'caso-1',
          orden: 1,
          titulo: 'Escena',
          situacion_texto: 'Situacion',
          fondo_codigo: 'consultorio',
          is_final: false,
          layout_version: 1,
          layout_data: {
            version: 1,
            elements: [
              {
                id: 'bg-esc-1',
                type: 'background',
                position: { x: 50, y: 50 },
                size: { width: 1000, height: 560 },
                rotation: 0,
                zIndex: 0,
                locked: true,
                hidden: false,
                style: { backgroundCode: 'consultorio' },
                content: {},
                bindings: {},
              },
            ],
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    postgrest.update.mockResolvedValueOnce([{}]).mockResolvedValueOnce([
      {
        id: 'asset-1',
        caso_id: 'caso-1',
        escenario_id: 'esc-1',
        docente_id: 'docente-1',
        tipo: 'OBJETO',
        nombre: 'objeto',
        prompt_original: 'obj',
        prompt_final: 'obj',
        url_externa: 'https://huggingface.co/test/model',
        ruta_archivo: '/uploads/ai-assets/test.png',
        ancho: 1280,
        alto: 720,
        estilo: 'editorial_sereno',
        proveedor: 'huggingface',
        created_at: new Date().toISOString(),
      },
    ]);
    (fs.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify({
        backgroundRemoved: true,
        originalRelativePath: '/uploads/ai-assets/test.jpg',
        processedRelativePath: '/uploads/ai-assets/test.png',
      }),
    );

    const asset = await service.insertIntoScenario(
      'asset-1',
      { escenarioId: 'esc-1', visibleType: 'symbol' },
      currentUser,
    );

    expect(asset).toMatchObject({
      tipo: 'OBJETO',
      visibleType: 'symbol',
      imageUrl: '/uploads/ai-assets/test.png',
      insertedElementId: expect.any(String),
    });
  });
});
