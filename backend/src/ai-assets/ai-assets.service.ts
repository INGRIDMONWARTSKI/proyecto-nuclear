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
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasosService } from '../simulacion/casos.service';
import { normalizeLayout } from '../simulacion/editor-layout.util';
import type { EscenarioRecord } from '../simulacion/entities/escenario.entity';
import { GenerateAiAssetDto, type AiAssetStyle } from './dto/generate-ai-asset.dto';
import { InsertAiAssetDto } from './dto/insert-ai-asset.dto';
import { AiAsset, AiAssetRecord } from './entities/ai-asset.entity';
import { PromptBuilderService } from './prompt-builder.service';

@Injectable()
export class AiAssetsService {
  private readonly provider = 'huggingface';
  private readonly imageWidth = 1280;
  private readonly imageHeight = 720;
  private readonly imageModel: string;
  private readonly imageProviderPolicy: 'auto' | 'hf-inference';
  private readonly publicBaseUrl: string;
  private readonly hfToken: string | null;
  private readonly inferenceClient: InferenceClient | null;

  constructor(
    private readonly postgrest: PostgrestService,
    private readonly casosService: CasosService,
    private readonly promptBuilder: PromptBuilderService,
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
    this.inferenceClient = this.hfToken ? new InferenceClient(this.hfToken) : null;
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

    const promptFinal = this.promptBuilder.build({
      tipo: dto.tipo,
      descripcion: dto.descripcion,
      estilo: dto.estilo,
      escenarioTitulo: escenario.titulo,
      situacionTexto: escenario.situacion_texto,
    });

    const imageRequest = await this.fetchHuggingFaceImage(promptFinal);
    const savedAsset = await this.persistAsset({
      dto,
      currentUser,
      promptFinal,
      imageBuffer: imageRequest.buffer,
      urlExterna: imageRequest.url,
      estilo: dto.estilo,
    });

    return savedAsset;
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

    return records.map((item) => this.toAiAsset(item));
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

    if (asset.tipo !== 'FONDO') {
      throw new BadRequestException('El MVP solo permite insertar fondos IA.');
    }

    const escenario = await this.findEscenarioById(dto.escenarioId);
    if (escenario.caso_id !== asset.caso_id) {
      throw new BadRequestException('El escenario no pertenece al mismo caso del recurso.');
    }

    const layout = normalizeLayout(escenario.layout_data, escenario);
    const background = layout.elements.find((item) => item.type === 'background');

    if (!background) {
      throw new NotFoundException('No se encontro el elemento de fondo del escenario.');
    }

    background.style = {
      ...background.style,
      aiAssetId: asset.id,
      imageUrl: this.buildPublicUrl(asset.ruta_archivo),
      backgroundCode: escenario.fondo_codigo,
    };
    background.content = {
      ...background.content,
      aiAssetId: asset.id,
      imageUrl: this.buildPublicUrl(asset.ruta_archivo),
      provider: asset.proveedor,
      estilo: asset.estilo,
    };

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

    return this.toAiAsset(updatedAsset ?? asset);
  }

  private async persistAsset(params: {
    dto: GenerateAiAssetDto;
    currentUser: AuthenticatedUser;
    promptFinal: string;
    imageBuffer: Buffer;
    urlExterna: string;
    estilo: AiAssetStyle;
  }): Promise<AiAsset> {
    const directory = join(process.cwd(), 'uploads', 'ai-assets');
    await mkdir(directory, { recursive: true });

    const fileName = `${Date.now()}-${randomUUID()}.jpg`;
    const fullPath = join(directory, fileName);
    const relativePath = `/uploads/ai-assets/${fileName}`;
    await writeFile(fullPath, params.imageBuffer);

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
          ruta_archivo: relativePath,
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

    return this.toAiAsset(record);
  }

  private async fetchHuggingFaceImage(promptFinal: string): Promise<{
    buffer: Buffer;
    url: string;
  }> {
    if (!this.inferenceClient || !this.hfToken) {
      throw new InternalServerErrorException(
        'Falta configurar HF_TOKEN en el backend para generar fondos IA con Hugging Face.',
      );
    }

    try {
      const imageBlob = await this.inferenceClient.textToImage({
        provider: this.imageProviderPolicy,
        model: this.imageModel,
        inputs: promptFinal,
        parameters: {
          width: this.imageWidth,
          height: this.imageHeight,
          num_inference_steps: 4,
        },
      }, {
        outputType: 'blob',
      });

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

  private isMissingAiAssetsTable(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('42P01') || error.message.includes('recursos_visuales'))
    );
  }

  private toAiAsset(record: AiAssetRecord): AiAsset {
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
      publicUrl: this.buildPublicUrl(record.ruta_archivo),
      ancho: record.ancho,
      alto: record.alto,
      estilo: record.estilo,
      proveedor: record.proveedor,
      createdAt: record.created_at,
    };
  }
}
