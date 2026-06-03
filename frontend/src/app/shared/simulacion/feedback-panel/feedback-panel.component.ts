import { Component, Input } from '@angular/core';

export interface FeedbackView {
  mensaje: string;
  tipo: 'pedagogica' | 'correctiva' | 'refuerzo';
  referenciaTeorica: string | null;
  puntajeObtenido?: number;
}

@Component({
  selector: 'app-feedback-panel',
  standalone: true,
  templateUrl: './feedback-panel.component.html',
  styleUrl: './feedback-panel.component.scss',
})
export class FeedbackPanelComponent {
  @Input({ required: true }) feedback!: FeedbackView;
}
