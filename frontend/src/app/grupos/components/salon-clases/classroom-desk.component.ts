import { Component, Input, output } from '@angular/core';
import { Usuario } from '../../../core/models/usuario.model';
import { classroomAnimations } from './classroom.animations';
import { AvatarStyle, buildAvatarStyle } from './avatar.util';

@Component({
  selector: 'app-classroom-desk',
  standalone: true,
  animations: [classroomAnimations],
  template: `
    <button
      type="button"
      class="desk"
      [class.desk--occupied]="ocupado"
      [class.desk--empty]="!ocupado"
      [class.desk--selected]="selected"
      [class.desk--interactive]="interactive"
      [@deskEnter]
      (click)="clicked.emit()"
    >
      <div class="desk__surface">
        @if (ocupado && estudiante) {
          <div class="desk__student" [@studentPop]>
            <div
              class="desk__avatar"
              [style.background]="avatar.bg"
              [style.borderColor]="avatar.accent"
            >
              <span class="desk__emoji">{{ avatar.emoji }}</span>
              <span class="desk__initials">{{ avatar.initials }}</span>
            </div>
            <span class="desk__name">{{ estudiante.fullName }}</span>
            <span class="desk__status desk__status--active">Presente</span>
          </div>
        } @else {
          <div class="desk__empty-slot">
            <span class="desk__plus">+</span>
            <span class="desk__empty-label">Pupitre libre</span>
          </div>
        }
      </div>
      <div class="desk__legs" aria-hidden="true"></div>
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
