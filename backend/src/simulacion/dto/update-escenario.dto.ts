import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateEscenarioDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  situacionTexto?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fondoCodigo?: string;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}
