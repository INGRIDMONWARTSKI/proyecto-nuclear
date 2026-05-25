import { Usuario } from './usuario.model';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: string;
  user: Usuario;
}

export interface AuthSession {
  accessToken: string;
  user: Usuario;
}
