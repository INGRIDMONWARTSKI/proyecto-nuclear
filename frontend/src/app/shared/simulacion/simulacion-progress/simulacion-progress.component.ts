import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-simulacion-progress',
  standalone: true,
  templateUrl: './simulacion-progress.component.html',
  styleUrl: './simulacion-progress.component.scss',
})
export class SimulacionProgressComponent {
  @Input({ required: true }) respondidas = 0;
  @Input({ required: true }) total = 0;

  get porcentaje(): number {
    if (this.total <= 0) {
      return 0;
    }
    return Math.round((this.respondidas / this.total) * 100);
  }
}
