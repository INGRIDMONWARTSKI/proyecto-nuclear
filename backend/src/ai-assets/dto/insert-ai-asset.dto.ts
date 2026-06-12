import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { AiAssetVisibleType } from '../entities/ai-asset.entity';

export class InsertAiAssetDto {
  @IsUUID()
  escenarioId: string;

  @IsOptional()
  @IsIn(['background', 'character', 'object', 'symbol'])
  visibleType?: AiAssetVisibleType;
}
