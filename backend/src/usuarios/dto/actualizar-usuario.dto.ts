import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
