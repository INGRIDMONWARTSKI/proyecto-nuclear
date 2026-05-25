import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Role } from '../../../core/models/role.enum';
import { Grupo } from '../../../core/models/grupo.model';
import { AuthService } from '../../../core/services/auth.service';
import { getErrorMessage } from '../../../core/utils/http-error.util';
import { AlertMessageComponent } from '../../../shared/components/alert-message/alert-message.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { GruposService } from '../../services/grupos.service';

@Component({
  selector: 'app-grupos-list',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    AlertMessageComponent,
    LoadingStateComponent,
  ],
  templateUrl: './grupos-list.component.html',
  styleUrl: './grupos-list.component.scss',
})
export class GruposListComponent implements OnInit {
  private readonly gruposService = inject(GruposService);
  protected readonly authService = inject(AuthService);

  protected readonly Role = Role;
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly grupos = signal<Grupo[]>([]);

  ngOnInit() {
    this.cargarGrupos();
  }

  cargarGrupos() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.gruposService.listar().subscribe({
      next: (grupos) => {
        this.grupos.set(grupos);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible cargar los grupos.'),
        );
        this.loading.set(false);
      },
    });
  }

  puedeAdministrar(grupo: Grupo): boolean {
    const user = this.authService.user();

    if (!user) {
      return false;
    }

    if (user.role === Role.ADMIN) {
      return true;
    }

    return user.role === Role.PROFESOR && grupo.profesorId === user.id;
  }
}
