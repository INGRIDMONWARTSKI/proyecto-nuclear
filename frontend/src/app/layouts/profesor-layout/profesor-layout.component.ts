import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profesor-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './profesor-layout.component.html',
  styleUrl: '../admin-layout/actor-layout.component.scss',
})
export class ProfesorLayoutComponent {
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
