import { IsIn } from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { CrearUsuarioDto } from '../../usuarios/dto/crear-usuario.dto';

export class RegisterDto extends CrearUsuarioDto {
  @IsIn([Role.PROFESOR, Role.ESTUDIANTE], {
    message: 'Solo se permite registrar usuarios PROFESOR o ESTUDIANTE.',
  })
  declare role: Role;
}
