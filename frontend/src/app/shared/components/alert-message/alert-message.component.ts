import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-alert-message',
  standalone: true,
  template: `
    <div class="alert" [class.alert-error]="type === 'error'" [class.alert-success]="type === 'success'">
      {{ message }}
    </div>
  `,
})
export class AlertMessageComponent {
  @Input({ required: true }) message!: string;
  @Input() type: 'error' | 'success' = 'error';
}
