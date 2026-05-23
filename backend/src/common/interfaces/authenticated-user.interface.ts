import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: Role;
  tokenVersion: number;
}
