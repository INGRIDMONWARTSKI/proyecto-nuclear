import { Component, Input, output } from '@angular/core';
import { Usuario } from '../../../../core/models/usuario.model';
import { classroomAnimations } from './classroom.animations';
import { AvatarStyle, buildAvatarStyle } from './avatar.util';

@Component({
  selector: 'app-classroom-desk',
  standalone: true,
  animations: [classroomAnimations],
  template: `
    <button
      type="button"
      class="cupo"
      [class.cupo--ocupado]="ocupado"
      [class.cupo--libre]="!ocupado"
      [class.cupo--selected]="selected"
      [class.cupo--interactive]="interactive"
      [attr.aria-label]="ocupado && estudiante ? 'Ver detalle de ' + estudiante.fullName : 'Cupo disponible'"
      (click)="clicked.emit()"
    >
      @if (ocupado && estudiante) {
        <div class="cupo__student">
          <div class="cupo__avatar" [style.background]="avatar.bg">
            {{ estudiante.fullName.charAt(0).toUpperCase() }}
          </div>
          <span class="cupo__name">{{ estudiante.fullName }}</span>
          <span class="cupo__email">{{ estudiante.email }}</span>
          <span class="cupo__badge">Estudiante</span>
        </div>
      } @else {
        <div class="cupo__empty">
          <span class="cupo__icon" aria-hidden="true">
            <svg viewBox="0 0 22 22" fill="none" width="22" height="22">
              <circle cx="11" cy="11" r="9" stroke="currentColor" stroke-width="1.3" stroke-dasharray="3.5 2"/>
              <path d="M11 7v8M7 11h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="cupo__label">Cupo disponible</span>
        </div>
      }
    </button>
  `,
  styleUrl: './classroom-desk.component.scss',
})
export class ClassroomDeskComponent {
  @Input({ required: true }) index = 0;
  @Input() estudiante: Usuario | null = null;
  @Input() selected = false;
  @Input() interactive = true;

  readonly clicked = output<void>();

  get ocupado(): boolean {
    return Boolean(this.estudiante);
  }

  get avatar(): AvatarStyle {
    return buildAvatarStyle(this.estudiante?.fullName ?? '', String(this.index));
  }
}
