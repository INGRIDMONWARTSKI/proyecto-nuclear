import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class GenerateCasoIaDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruccion?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ each: true })
  @MaxLength(5000, { each: true })
  casosReferenciaTexto?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID(undefined, { each: true })
  casosReferenciaIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  cantidadEscenarios?: number;
}
