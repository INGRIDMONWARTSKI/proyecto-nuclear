import { Component, Input } from '@angular/core';
import { EscenarioActual } from '../../../features/simulacion/models/escenario-actual.model';

@Component({
  selector: 'app-escenario-viewer',
  standalone: true,
  templateUrl: './escenario-viewer.component.html',
  styleUrl: './escenario-viewer.component.scss',
})
export class EscenarioViewerComponent {
  @Input({ required: true }) escenario!: EscenarioActual;
}
