import { IsInt, IsOptional, IsString, MaxLength, Max, Min, MinLength } from 'class-validator';

export class CreateCasoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  objetivoAprendizaje?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  tiempoMaximoMinutos?: number;
}
