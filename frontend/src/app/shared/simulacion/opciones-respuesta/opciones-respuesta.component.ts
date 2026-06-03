import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OpcionEscenario, PreguntaEscenario } from '../../../features/simulacion/models/escenario-actual.model';

@Component({
  selector: 'app-opciones-respuesta',
  standalone: true,
  templateUrl: './opciones-respuesta.component.html',
  styleUrl: './opciones-respuesta.component.scss',
})
export class OpcionesRespuestaComponent {
  @Input({ required: true }) pregunta!: PreguntaEscenario;
  @Input() selectedOpcionId: string | null = null;
  @Input() locked = false;
  @Output() select = new EventEmitter<OpcionEscenario>();

  onSelect(opcion: OpcionEscenario) {
    if (this.locked) {
      return;
    }
    this.select.emit(opcion);
  }
}
