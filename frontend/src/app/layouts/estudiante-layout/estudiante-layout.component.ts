import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { EstudianteAmbientComponent } from '../../features/estudiante/shared/estudiante-ambient/estudiante-ambient.component';

@Component({
  selector: 'app-estudiante-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, EstudianteAmbientComponent],
  templateUrl: './estudiante-layout.component.html',
  styleUrls: [
    '../admin-layout/actor-layout.component.scss',
    './estudiante-layout.component.scss',
  ],
})
export class EstudianteLayoutComponent {
  protected readonly authService = inject(AuthService);

  logout() {
    this.authService.logout();
  }

  userInitials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
