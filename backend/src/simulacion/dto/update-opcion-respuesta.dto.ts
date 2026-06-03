import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateOpcionRespuestaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  texto?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  puntaje?: number;

  @IsOptional()
  @IsBoolean()
  isCorrecta?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  escenarioDestinoId?: string | null;
}
