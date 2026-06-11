import { Usuario } from './usuario.model';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
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
