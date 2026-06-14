import { Role } from '../../common/enums/role.enum';

export interface Usuario {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: Role;
  tokenVersion: number;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UsuarioSeguro = Omit<Usuario, 'passwordHash'>;
