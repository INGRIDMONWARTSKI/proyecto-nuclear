import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateOpcionRespuestaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  texto: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  puntaje: number;

  @IsOptional()
  @IsBoolean()
  isCorrecta?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  escenarioDestinoId?: string | null;
}
