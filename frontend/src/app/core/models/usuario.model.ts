import { Role } from './role.enum';

export interface Usuario {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  tokenVersion: number;
  puedeCrearCasos: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}
