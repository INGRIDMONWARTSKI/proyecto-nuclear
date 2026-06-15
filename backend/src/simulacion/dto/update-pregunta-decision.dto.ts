import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdatePreguntaDecisionDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  enunciado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsIn(['single_choice'])
  tipo?: 'single_choice';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  puntajeMaximo?: number;
}
