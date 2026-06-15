import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Notificacion, NotificacionesCount } from '../models/notificacion.model';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notificaciones`;

  listar(archivadas = false) {
    return this.http.get<Notificacion[]>(
      archivadas ? `${this.baseUrl}?archivadas=true` : this.baseUrl,
    );
  }

  contarNoLeidas() {
    return this.http.get<NotificacionesCount>(`${this.baseUrl}/no-leidas/count`);
  }

  marcarComoLeida(id: string) {
    return this.http.patch<Notificacion>(`${this.baseUrl}/${id}/leida`, {});
  }

  marcarTodasComoLeidas() {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/marcar-todas-leidas`,
      {},
    );
  }

  archivar(id: string) {
    return this.http.patch<Notificacion>(`${this.baseUrl}/${id}/archivar`, {});
  }

  archivarLeidas() {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/archivar-leidas`,
      {},
    );
  }
}
