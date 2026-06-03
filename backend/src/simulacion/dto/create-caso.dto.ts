import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
