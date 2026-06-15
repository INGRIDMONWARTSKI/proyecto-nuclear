import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Role } from '../../../core/models/role.enum';
import { Usuario } from '../../../core/models/usuario.model';

export interface CrearUsuarioPayload {
  fullName: string;
  email: string;
  role: Role;
  puedeCrearCasos?: boolean;
}

export interface CrearUsuarioResponse {
  user: Usuario;
  emailSent: boolean;
  warning?: string;
}

export interface ActualizarUsuarioPayload {
  fullName?: string;
  role?: Role;
  puedeCrearCasos?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UsuariosApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/usuarios`;

  listarUsuarios() {
    return this.http.get<Usuario[]>(this.baseUrl);
  }

  crearUsuario(payload: CrearUsuarioPayload) {
    return this.http.post<CrearUsuarioResponse>(this.baseUrl, payload);
  }

  actualizarUsuario(id: string, payload: ActualizarUsuarioPayload) {
    return this.http.patch<Usuario>(`${this.baseUrl}/${id}`, payload);
  }

  cambiarEstadoUsuario(id: string, isActive: boolean) {
    return this.http.patch<Usuario>(`${this.baseUrl}/${id}/estado`, {
      isActive,
    });
  }

  filtrarEstudiantes(usuarios: Usuario[]) {
    return usuarios.filter(
      (usuario) => usuario.role === Role.ESTUDIANTE && usuario.isActive,
    );
  }
}
