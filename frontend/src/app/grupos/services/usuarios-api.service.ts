import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Role } from '../../core/models/role.enum';
import { Usuario } from '../../core/models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuariosApiService {
  private readonly http = inject(HttpClient);

  listarUsuarios() {
    return this.http.get<Usuario[]>(`${environment.apiUrl}/usuarios`);
  }

  filtrarEstudiantes(usuarios: Usuario[]) {
    return usuarios.filter(
      (usuario) => usuario.role === Role.ESTUDIANTE && usuario.isActive,
    );
  }
}
