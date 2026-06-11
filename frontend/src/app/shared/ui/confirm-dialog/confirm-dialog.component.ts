import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  styleUrl: './confirm-dialog.component.scss',
  template: `
    @if (open) {
      <div
        class="confirm-dialog__backdrop"
        role="presentation"
        (click)="onCancel()"
      ></div>
      <div
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="messageId"
      >
        <h2 [id]="titleId" class="confirm-dialog__title">{{ title }}</h2>
        <p [id]="messageId" class="confirm-dialog__message">{{ message }}</p>
        <div class="confirm-dialog__actions">
          <button type="button" class="siep-btn-secondary" (click)="onCancel()">
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            [class]="destructive ? 'siep-btn-danger' : 'siep-btn-primary'"
            [disabled]="confirming"
            (click)="onConfirm()"
          >
            {{ confirming ? confirmingLabel : confirmLabel }}
          </button>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  private static nextId = 0;
  private readonly instanceId = ConfirmDialogComponent.nextId++;

  protected readonly titleId = `confirm-title-${this.instanceId}`;
  protected readonly messageId = `confirm-message-${this.instanceId}`;

  @Input() open = false;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) message!: string;
  @Input() confirmLabel = 'Confirmar';
  @Input() cancelLabel = 'Cancelar';
  @Input() confirmingLabel = 'Procesando...';
  @Input() destructive = false;
  @Input() confirming = false;

  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  onConfirm(): void {
    if (this.confirming) {
      return;
    }

    this.confirmed.emit();
  }

  onCancel(): void {
    if (this.confirming) {
      return;
    }

    this.cancelled.emit();
  }
}
