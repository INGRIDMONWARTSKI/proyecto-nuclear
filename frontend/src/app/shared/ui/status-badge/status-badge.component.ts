import { Component, Input } from '@angular/core';

export type SiepRoleBadge = 'admin' | 'profesor' | 'estudiante';
export type SiepStatusBadge =
  | 'active'
  | 'inactive'
  | 'success'
  | 'warning'
  | 'pending'
  | 'error';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    @if (variant === 'role') {
      <span class="siep-badge-role" [class]="roleClass">{{ label }}</span>
    } @else {
      <span class="siep-badge-status" [class]="statusClass">{{ label }}</span>
    }
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) label!: string;
  @Input() variant: 'role' | 'status' = 'status';
  @Input() role: SiepRoleBadge = 'estudiante';
  @Input() status: SiepStatusBadge = 'active';

  protected get roleClass(): string {
    return `siep-badge-role siep-badge-role--${this.role}`;
  }

  protected get statusClass(): string {
    return `siep-badge-status siep-badge-status--${this.status}`;
  }
}
