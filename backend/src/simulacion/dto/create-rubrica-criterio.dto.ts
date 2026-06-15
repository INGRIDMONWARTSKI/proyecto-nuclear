import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRubricaCriterioDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  criterio!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  descripcion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nivelEsperado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  peso?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden?: number;
}
