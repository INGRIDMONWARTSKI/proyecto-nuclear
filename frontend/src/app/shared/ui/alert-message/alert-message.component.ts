import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-alert-message',
  standalone: true,
  template: `
    <div
      [class.siep-alert-error]="type === 'error'"
      [class.siep-alert-success]="type === 'success'"
      role="alert"
    >
      {{ message }}
    </div>
  `,
})
export class AlertMessageComponent {
  @Input({ required: true }) message!: string;
  @Input() type: 'error' | 'success' = 'error';
}
