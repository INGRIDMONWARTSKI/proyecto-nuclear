import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { AiAssetType } from '../entities/ai-asset.entity';

export const AI_ASSET_STYLES = ['editorial_sereno', 'acuarela_suave', 'minimal_calido'] as const;

export type AiAssetStyle = (typeof AI_ASSET_STYLES)[number];

export class GenerateAiAssetDto {
  @IsUUID()
  casoId: string;

  @IsUUID()
  escenarioId: string;

  @IsIn(['FONDO', 'PERSONAJE', 'OBJETO', 'ESCENA_COMPLETA'])
  tipo: AiAssetType;

  @IsString()
  @MinLength(12)
  @MaxLength(600)
  descripcion: string;

  @IsIn(AI_ASSET_STYLES)
  estilo: AiAssetStyle;
}
