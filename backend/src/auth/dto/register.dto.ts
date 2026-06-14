import { IsString, MinLength } from 'class-validator';
import { CrearUsuarioDto } from '../../usuarios/dto/crear-usuario.dto';
import { Role } from '../../common/enums/role.enum';
import { IsIn } from 'class-validator';

export class RegisterDto extends CrearUsuarioDto {
  @IsString()
  @MinLength(8)
  declare password: string;

  @IsIn([Role.PROFESOR, Role.ESTUDIANTE], {
    message: 'Solo se permite registrar usuarios PROFESOR o ESTUDIANTE.',
  })
  declare role: Role;
}
