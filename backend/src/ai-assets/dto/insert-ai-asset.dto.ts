import { IsUUID } from 'class-validator';

export class InsertAiAssetDto {
  @IsUUID()
  escenarioId: string;
}
