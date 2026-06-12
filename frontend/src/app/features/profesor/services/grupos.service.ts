import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
  ActualizarGrupoPayload,
  AsignarEstudiantesPayload,
  CrearGrupoPayload,
  DesactivarGrupoResponse,
  Grupo,
} from '../../../core/models/grupo.model';
import { Usuario } from '../../../core/models/usuario.model';
import { ImportarEstudiantesResponse } from '../../../core/models/import-estudiantes.model';

@Injectable({ providedIn: 'root' })
export class GruposService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/grupos`;

  listar() {
    return this.http.get<Grupo[]>(this.baseUrl);
  }

  obtener(id: string) {
    return this.http.get<Grupo>(`${this.baseUrl}/${id}`);
  }

  crear(payload: CrearGrupoPayload) {
    return this.http.post<Grupo>(this.baseUrl, payload);
  }

  actualizar(id: string, payload: ActualizarGrupoPayload) {
    return this.http.patch<Grupo>(`${this.baseUrl}/${id}`, payload);
  }

  desactivar(id: string) {
    return this.http.delete<DesactivarGrupoResponse>(`${this.baseUrl}/${id}`);
  }

  listarEstudiantes(grupoId: string) {
    return this.http.get<Usuario[]>(`${this.baseUrl}/${grupoId}/estudiantes`);
  }

  listarEstudiantesDisponibles(grupoId: string) {
    return this.http.get<Usuario[]>(
      `${this.baseUrl}/${grupoId}/estudiantes-disponibles`,
    );
  }

  asignarEstudiantes(grupoId: string, payload: AsignarEstudiantesPayload) {
    return this.http.post<Usuario[]>(
      `${this.baseUrl}/${grupoId}/estudiantes`,
      payload,
    );
  }

  removerEstudiante(grupoId: string, estudianteId: string) {
    return this.http.delete<{ message: string }>(
      `${this.baseUrl}/${grupoId}/estudiantes/${estudianteId}`,
    );
  }

  importarEstudiantes(grupoId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportarEstudiantesResponse>(
      `${this.baseUrl}/${grupoId}/importar-estudiantes`,
      formData,
    );
  }
}
