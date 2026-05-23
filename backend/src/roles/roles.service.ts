import { Injectable } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class RolesService {
  findAll() {
    return Object.values(Role).map((code) => ({
      code,
      name: this.getDisplayName(code),
    }));
  }

  private getDisplayName(role: Role) {
    switch (role) {
      case Role.ADMIN:
        return 'Administrador';
      case Role.PROFESOR:
        return 'Profesor';
      case Role.ESTUDIANTE:
        return 'Estudiante';
    }
  }
}
