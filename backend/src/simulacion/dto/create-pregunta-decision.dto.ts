import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePreguntaDecisionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  enunciado: string;

  @IsOptional()
  @IsIn(['single_choice'])
  tipo?: 'single_choice';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  puntajeMaximo?: number;
}
