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

  protected reflectionHeading(): string {
    if (this.feedback.tipo === 'correctiva' || this.feedback.tipo === 'refuerzo') {
      return 'Consecuencia de tu decisión';
    }

    return 'Reflexión central';
  }

  protected tipoLabel(): string {
    switch (this.feedback.tipo) {
      case 'pedagogica':
        return 'Pedagógica';
      case 'correctiva':
        return 'Correctiva';
      case 'refuerzo':
        return 'Refuerzo';
      default:
        return this.feedback.tipo;
    }
  }

  protected tipoModifier(): string {
    switch (this.feedback.tipo) {
      case 'correctiva':
        return 'correctiva';
      case 'refuerzo':
        return 'refuerzo';
      default:
        return 'pedagogica';
    }
  }
}
