import { InferenceClient } from '@huggingface/inference';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { join } from 'path';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasosService } from '../simulacion/casos.service';
import { normalizeLayout } from '../simulacion/editor-layout.util';
import type { EscenarioRecord } from '../simulacion/entities/escenario.entity';
import type { EditorElementBase } from '../simulacion/types/editor-layout.types';
import { BackgroundRemovalService } from './background-removal.service';
import { GenerateAiAssetDto, type AiAssetStyle } from './dto/generate-ai-asset.dto';
import { InsertAiAssetDto } from './dto/insert-ai-asset.dto';
import {
  AiAsset,
  AiAssetMetadata,
  AiAssetRecord,
  type AiAssetType,
  type AiAssetVisibleType,
} from './entities/ai-asset.entity';
import { PromptBuilderService } from './prompt-builder.service';

interface HuggingFaceImageClient {
  textToImage(
    args: {
      provider?: string;
      model?: string;
      inputs: string;
      parameters?: Record<string, number>;
    },
    options?: { outputType?: 'blob' },
  ): Promise<Blob>;
}

interface PersistedAssetPaths {
  finalRelativePath: string;
  originalRelativePath: string;
  processedRelativePath?: string;
  backgroundRemoved: boolean;
  backgroundRemovalWarning?: string;
}

interface AiAssetSidecar {
  originalRelativePath: string;
  processedRelativePath?: string;
  backgroundRemoved: boolean;
  backgroundRemovalWarning?: string;
}

@Injectable()
export class AiAssetsService {
  private readonly provider = 'huggingface';
  private readonly imageWidth = 1280;
  private readonly imageHeight = 720;
  private readonly imageModel: string;
  private readonly imageProviderPolicy: 'auto' | 'hf-inference';
  private readonly publicBaseUrl: string;
  private readonly hfToken: string | null;
  private readonly inferenceClient: HuggingFaceImageClient | null;

  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly backgroundRemovalService: BackgroundRemovalService,
    private readonly configService: ConfigService,
  ) {
    this.hfToken = this.configService.get<string>('HF_TOKEN')?.trim() || null;
    this.imageModel = this.configService.get<string>(
      'HF_IMAGE_MODEL',
      'black-forest-labs/FLUX.1-schnell',
    );
    this.imageProviderPolicy =
      this.configService.get<'auto' | 'hf-inference'>('HF_IMAGE_PROVIDER', 'auto');
    this.publicBaseUrl = this.configService.get<string>(
      'APP_PUBLIC_URL',
      `http://localhost:${this.configService.get<string>('PORT', '3000')}`,
    );
    this.inferenceClient = this.hfToken
      ? (new InferenceClient(this.hfToken) as unknown as HuggingFaceImageClient)
      : null;
  }

  async generate(
    dto: GenerateAiAssetDto,
    currentUser: AuthenticatedUser,
  ): Promise<AiAsset> {
    const caso = await this.casosService.findCasoById(dto.casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    const escenario = await this.findEscenarioById(dto.escenarioId);
    if (escenario.caso_id !== dto.casoId) {
      throw new BadRequestException('El escenario no pertenece al caso indicado.');
    }

    const visibleType = this.resolveVisibleType(dto.tipo, dto.visibleType);
    const promptFinal = this.promptBuilder.build({
      tipo: dto.tipo,
      visibleType,
      descripcion: dto.descripcion,
      estilo: dto.estilo,
      escenarioTitulo: escenario.titulo,
      situacionTexto: escenario.situacion_texto,
    });

    const imageRequest = await this.fetchHuggingFaceImage(promptFinal);
    return this.persistAsset({
      dto,
      currentUser,
      promptFinal,
      imageBuffer: imageRequest.buffer,
      urlExterna: imageRequest.url,
      estilo: dto.estilo,
      visibleType,
    });
  }

  async listByCaso(casoId: string, currentUser: AuthenticatedUser): Promise<AiAsset[]> {
    const caso = await this.casosService.findCasoById(casoId);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    let records: AiAssetRecord[] = [];
    try {
      records = await this.postgrest.select<AiAssetRecord>('recursos_visuales', {
        filters: { caso_id: casoId },
        order: 'created_at.desc',
      });
    } catch (error) {
      if (this.isMissingAiAssetsTable(error)) {
        return [];
      }

      throw error;
    }

    return Promise.all(records.map((item) => this.toAiAsset(item)));
  }

  async insertIntoScenario(
    assetId: string,
    dto: InsertAiAssetDto,
    currentUser: AuthenticatedUser,
  ): Promise<AiAsset> {
    const asset = await this.findAssetById(assetId);
    const caso = await this.casosService.findCasoById(asset.caso_id);
    this.casosService.assertCanAccessCasoDocente(caso, currentUser);

    if (asset.docente_id !== currentUser.sub && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('No puedes aplicar un recurso generado por otro docente.');
    }

    const escenario = await this.findEscenarioById(dto.escenarioId);
    if (escenario.caso_id !== asset.caso_id) {
      throw new BadRequestException('El escenario no pertenece al mismo caso del recurso.');
    }

    const layout = normalizeLayout(escenario.layout_data, escenario);
    const visibleType = this.resolveVisibleType(asset.tipo, dto.visibleType);
    const assetPublicUrl = this.buildPublicUrl(asset.ruta_archivo);
    let insertedElementId: string | null = null;

    if (asset.tipo === 'FONDO') {
      const background = layout.elements.find((item) => item.type === 'background');

      if (!background) {
        throw new NotFoundException('No se encontro el elemento de fondo del escenario.');
      }

      background.style = {
        ...background.style,
        aiAssetId: asset.id,
        imageUrl: assetPublicUrl,
        backgroundCode: escenario.fondo_codigo,
      };
      background.content = {
        ...background.content,
        aiAssetId: asset.id,
        imageUrl: assetPublicUrl,
        provider: asset.proveedor,
        estilo: asset.estilo,
      };
    } else if (asset.tipo === 'PERSONAJE' || asset.tipo === 'OBJETO') {
      const nextZ = Math.max(...layout.elements.map((item) => item.zIndex), 0) + 1;
      const imageElement = this.buildImageElement(asset, visibleType, nextZ);
      layout.elements.push(imageElement);
      insertedElementId = imageElement.id;
    } else {
      throw new BadRequestException('El tipo de recurso IA no se puede insertar en el escenario.');
    }

    await this.postgrest.update<EscenarioRecord>(
      'escenarios',
      {
        layout_version: layout.version,
        layout_data: layout,
      },
      {
        filters: { id: escenario.id },
        select: '*',
      },
    );

    const [updatedAsset] = await this.postgrest.update<AiAssetRecord>(
      'recursos_visuales',
      {
        escenario_id: escenario.id,
      },
      {
        filters: { id: asset.id },
        select: '*',
      },
    );

    return this.toAiAsset(updatedAsset ?? asset, visibleType, insertedElementId);
  }

  private async persistAsset(params: {
    dto: GenerateAiAssetDto;
    currentUser: AuthenticatedUser;
    promptFinal: string;
    imageBuffer: Buffer;
    urlExterna: string;
    estilo: AiAssetStyle;
    visibleType: AiAssetVisibleType;
  }): Promise<AiAsset> {
    const assetFiles = await this.writeAssetFiles(params.imageBuffer, params.visibleType);

    let record: AiAssetRecord;
    try {
      record = await this.postgrest.insert<AiAssetRecord>(
        'recursos_visuales',
        {
          caso_id: params.dto.casoId,
          escenario_id: params.dto.escenarioId,
          docente_id: params.currentUser.sub,
          tipo: params.dto.tipo,
          nombre: this.buildAssetName(params.dto.tipo, params.estilo),
          prompt_original: params.dto.descripcion.trim(),
          prompt_final: params.promptFinal,
          url_externa: params.urlExterna,
          ruta_archivo: assetFiles.finalRelativePath,
          ancho: this.imageWidth,
          alto: this.imageHeight,
          estilo: params.estilo,
          proveedor: this.provider,
        },
        {
          select: '*',
        },
      );
    } catch (error) {
      if (this.isMissingAiAssetsTable(error)) {
        throw new InternalServerErrorException(
          'Falta la tabla recursos_visuales. Aplica la migracion SQL del MVP antes de generar fondos IA.',
        );
      }

      throw error;
    }

    await this.writeSidecarMetadata(record.id, {
      backgroundRemoved: assetFiles.backgroundRemoved,
      originalRelativePath: assetFiles.originalRelativePath,
      processedRelativePath: assetFiles.processedRelativePath,
      backgroundRemovalWarning: assetFiles.backgroundRemovalWarning,
    });

    return this.toAiAsset(record, params.visibleType);
  }

  private async writeAssetFiles(
    imageBuffer: Buffer,
    visibleType: AiAssetVisibleType,
  ): Promise<PersistedAssetPaths> {
    const directory = join(process.cwd(), 'uploads', 'ai-assets');
    await fs.mkdir(directory, { recursive: true });

    const assetKey = `${Date.now()}-${randomUUID()}`;
    const originalRelativePath = `/uploads/ai-assets/${assetKey}.jpg`;
    const originalFullPath = this.resolveAbsoluteUploadPath(originalRelativePath);
    await fs.writeFile(originalFullPath, imageBuffer);

    if (!this.shouldAttemptBackgroundRemoval(visibleType)) {
      return {
        finalRelativePath: originalRelativePath,
        originalRelativePath,
        backgroundRemoved: false,
      };
    }

    const removalResult = await this.backgroundRemovalService.removeBackground(originalFullPath);
    if (!removalResult.backgroundRemoved || !removalResult.processedBuffer) {
      return {
        finalRelativePath: originalRelativePath,
        originalRelativePath,
        backgroundRemoved: false,
        backgroundRemovalWarning: removalResult.warning,
      };
    }

    const processedRelativePath = `/uploads/ai-assets/${assetKey}.png`;
    const processedFullPath = this.resolveAbsoluteUploadPath(processedRelativePath);
    await fs.writeFile(processedFullPath, removalResult.processedBuffer);

    return {
      finalRelativePath: processedRelativePath,
      originalRelativePath,
      processedRelativePath,
      backgroundRemoved: true,
    };
  }

  private async fetchHuggingFaceImage(promptFinal: string): Promise<{
    buffer: Buffer;
    url: string;
  }> {
    if (!this.inferenceClient || !this.hfToken) {
      throw new InternalServerErrorException(
        'Falta configurar HF_TOKEN en el backend para generar recursos IA con Hugging Face.',
      );
    }

    try {
      const imageBlob = await this.inferenceClient.textToImage(
        {
          provider: this.imageProviderPolicy,
          model: this.imageModel,
          inputs: promptFinal,
          parameters: {
            width: this.imageWidth,
            height: this.imageHeight,
            num_inference_steps: 4,
          },
        },
        {
          outputType: 'blob',
        },
      );

      const arrayBuffer = await imageBlob.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new ServiceUnavailableException(
          'Hugging Face devolvio una imagen vacia para la solicitud.',
        );
      }

      return {
        buffer: Buffer.from(arrayBuffer),
        url: `https://huggingface.co/${this.imageModel}`,
      };
    } catch (error) {
      const detail = this.readProviderError(error);
      throw new ServiceUnavailableException(
        `Hugging Face no pudo generar la imagen ahora mismo: ${detail}`,
      );
    }
  }

  private readProviderError(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return 'error desconocido del proveedor';
  }

  private buildAssetName(tipo: string, estilo: string): string {
    return `${tipo.toLowerCase()}-${estilo}-${new Date().toISOString().slice(0, 19)}`;
  }

  private resolveVisibleType(
    tipo: AiAssetType,
    visibleType?: AiAssetVisibleType,
  ): AiAssetVisibleType {
    if (visibleType) {
      return visibleType;
    }

    switch (tipo) {
      case 'FONDO':
        return 'background';
      case 'PERSONAJE':
        return 'character';
      case 'OBJETO':
        return 'object';
      default:
        return 'background';
    }
  }

  private buildImageElement(
    asset: AiAssetRecord,
    visibleType: AiAssetVisibleType,
    zIndex: number,
  ): EditorElementBase {
    const { width, height } = this.initialSizeForVisibleType(visibleType);
    const publicUrl = this.buildPublicUrl(asset.ruta_archivo);

    return {
      id: randomUUID(),
      type: 'image',
      position: { x: 52, y: 52 },
      size: { width, height },
      rotation: 0,
      zIndex,
      locked: false,
      hidden: false,
      style: {
        objectFit: 'contain',
      },
      content: {
        nombre: asset.nombre,
        imageUrl: publicUrl,
        aiAssetId: asset.id,
        aiType: visibleType,
        sourceType: 'ai',
      },
      bindings: {},
    };
  }

  private initialSizeForVisibleType(visibleType: AiAssetVisibleType): {
    width: number;
    height: number;
  } {
    switch (visibleType) {
      case 'character':
        return { width: 240, height: 280 };
      case 'symbol':
        return { width: 140, height: 140 };
      case 'object':
        return { width: 180, height: 180 };
      default:
        return { width: 180, height: 180 };
    }
  }

  private async findAssetById(assetId: string): Promise<AiAssetRecord> {
    const [asset] = await this.postgrest.select<AiAssetRecord>('recursos_visuales', {
      filters: { id: assetId },
      limit: 1,
    });

    if (!asset) {
      throw new NotFoundException('Recurso visual IA no encontrado.');
    }

    return asset;
  }

  private async findEscenarioById(escenarioId: string): Promise<EscenarioRecord> {
    const [escenario] = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { id: escenarioId },
      limit: 1,
    });

    if (!escenario) {
      throw new NotFoundException('Escenario no encontrado.');
    }

    return escenario;
  }

  private buildPublicUrl(relativePath: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}${relativePath}`;
  }

  private resolveAbsoluteUploadPath(relativePath: string): string {
    return join(process.cwd(), relativePath.replace(/^\/+/, ''));
  }

  private shouldAttemptBackgroundRemoval(visibleType: AiAssetVisibleType): boolean {
    return visibleType === 'character' || visibleType === 'object' || visibleType === 'symbol';
  }

  private sidecarPath(assetId: string): string {
    return join(process.cwd(), 'uploads', 'ai-assets', 'metadata', `${assetId}.json`);
  }

  private async writeSidecarMetadata(assetId: string, metadata: AiAssetSidecar): Promise<void> {
    const hasMeaningfulContent =
      typeof metadata.processedRelativePath === 'string' ||
      typeof metadata.backgroundRemovalWarning === 'string' ||
      metadata.backgroundRemoved === true;

    if (!hasMeaningfulContent) {
      return;
    }

    try {
      const sidecarDirectory = join(process.cwd(), 'uploads', 'ai-assets', 'metadata');
      await fs.mkdir(sidecarDirectory, { recursive: true });
      await fs.writeFile(this.sidecarPath(assetId), JSON.stringify(metadata, null, 2), 'utf-8');
    } catch {
      // Best effort: si falla, el editor debe seguir funcionando con el archivo final.
    }
  }

  private async readSidecarMetadata(assetId: string): Promise<AiAssetSidecar | null> {
    try {
      const content = await fs.readFile(this.sidecarPath(assetId), 'utf-8');
      return JSON.parse(content) as AiAssetSidecar;
    } catch {
      return null;
    }
  }

  private isMissingAiAssetsTable(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('42P01') || error.message.includes('recursos_visuales'))
    );
  }

  private async toAiAsset(
    record: AiAssetRecord,
    visibleType = this.resolveVisibleType(record.tipo),
    insertedElementId: string | null = null,
  ): Promise<AiAsset> {
    const publicUrl = this.buildPublicUrl(record.ruta_archivo);
    const sidecar = await this.readSidecarMetadata(record.id);
    const metadata: AiAssetMetadata = {
      provider: record.proveedor,
      visibleType,
    };

    if (typeof sidecar?.backgroundRemoved === 'boolean') {
      metadata.backgroundRemoved = sidecar.backgroundRemoved;
    }
    if (sidecar?.originalRelativePath) {
      metadata.originalImageUrl = this.buildPublicUrl(sidecar.originalRelativePath);
    }
    if (sidecar?.processedRelativePath) {
      metadata.processedImageUrl = this.buildPublicUrl(sidecar.processedRelativePath);
    }
    if (sidecar?.backgroundRemovalWarning) {
      metadata.backgroundRemovalWarning = sidecar.backgroundRemovalWarning;
    }

    return {
      id: record.id,
      casoId: record.caso_id,
      escenarioId: record.escenario_id,
      docenteId: record.docente_id,
      tipo: record.tipo,
      nombre: record.nombre,
      promptOriginal: record.prompt_original,
      promptFinal: record.prompt_final,
      urlExterna: record.url_externa,
      rutaArchivo: record.ruta_archivo,
      publicUrl,
      ancho: record.ancho,
      alto: record.alto,
      estilo: record.estilo,
      proveedor: record.proveedor,
      createdAt: record.created_at,
      success: true,
      visibleType,
      imageUrl: publicUrl,
      promptUsed: record.prompt_final,
      provider: record.proveedor,
      metadata,
      insertedElementId,
    };
  }
}
