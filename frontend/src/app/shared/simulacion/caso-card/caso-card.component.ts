import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CasoPublicado } from '../../../features/simulacion/models/caso-publicado.model';

@Component({
  selector: 'app-caso-card',
  standalone: true,
  templateUrl: './caso-card.component.html',
  styleUrl: './caso-card.component.scss',
})
export class CasoCardComponent {
  @Input({ required: true }) caso!: CasoPublicado;
  @Input() starting = false;
  @Output() start = new EventEmitter<string>();

  onStart() {
    this.start.emit(this.caso.id);
  }
}
