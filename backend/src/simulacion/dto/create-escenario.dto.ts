import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateEscenarioDto {
  @IsInt()
  @Min(1)
  orden: number;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  titulo: string;

  @IsString()
  @MinLength(3)
  situacionTexto: string;

  @IsString()
  @MinLength(1)
  fondoCodigo: string;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}
