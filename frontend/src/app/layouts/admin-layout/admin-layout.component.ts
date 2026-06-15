import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Notificacion } from '../../core/models/notificacion.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './admin-layout.component.html',
  styleUrl: './actor-layout.component.scss',
})
export class AdminLayoutComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly notificacionesService = inject(NotificacionesService);

  protected readonly notificaciones = signal<Notificacion[]>([]);
  protected readonly unreadCount = signal(0);
  protected readonly notificationsOpen = signal(false);
  protected readonly hasNotifications = computed(() => this.notificaciones().length > 0);

  ngOnInit(): void {
    this.cargarNotificaciones();
  }

  logout() {
    this.authService.logout();
  }

  toggleNotifications(): void {
    this.notificationsOpen.update((open) => !open);
    if (this.notificationsOpen()) {
      this.cargarNotificaciones();
    }
  }

  marcarComoLeida(notificacion: Notificacion): void {
    this.notificacionesService.marcarComoLeida(notificacion.id).subscribe({
      next: (updated) => {
        this.notificaciones.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.cargarConteo();
      },
      error: () => undefined,
    });
  }

  marcarTodasComoLeidas(): void {
    this.notificacionesService.marcarTodasComoLeidas().subscribe({
      next: () => {
        this.notificaciones.update((items) =>
          items.map((item) => ({ ...item, leida: true })),
        );
        this.unreadCount.set(0);
      },
      error: () => undefined,
    });
  }

  notificationLink(notificacion: Notificacion): string[] | null {
    if (notificacion.entidadTipo === 'GRUPO' && notificacion.entidadId) {
      return ['/admin/grupos', notificacion.entidadId];
    }
    if (notificacion.entidadTipo === 'USUARIO') {
      return ['/admin/usuarios'];
    }
    return null;
  }

  userInitials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private cargarNotificaciones(): void {
    this.notificacionesService.listar().subscribe({
      next: (items) => this.notificaciones.set(items),
      error: () => {
        this.notificaciones.set([]);
        this.unreadCount.set(0);
      },
    });
    this.cargarConteo();
  }

  private cargarConteo(): void {
    this.notificacionesService.contarNoLeidas().subscribe({
      next: ({ count }) => this.unreadCount.set(count),
      error: () => this.unreadCount.set(0),
    });
  }
}
