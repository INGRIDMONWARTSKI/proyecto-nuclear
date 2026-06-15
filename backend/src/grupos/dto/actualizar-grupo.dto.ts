import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActualizarGrupoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  semestre?: string;

  @IsOptional()
  @IsUUID('4')
  profesorId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
