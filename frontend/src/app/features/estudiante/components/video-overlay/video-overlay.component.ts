import { Component, effect, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-video-overlay',
  standalone: true,
  templateUrl: './video-overlay.component.html',
  styleUrl: './video-overlay.component.scss',
})
export class VideoOverlayComponent {
  readonly src = input.required<string>();
  readonly titulo = input<string>('');
  readonly descripcion = input<string>('');
  readonly ended = output<void>();

  protected readonly videoError = signal(false);
  protected readonly isExiting = signal(false);
  private finished = false;

  constructor() {
    // When source changes between video phases, reset all local state.
    effect(() => {
      this.src();
      this.finished = false;
      this.videoError.set(false);
      this.isExiting.set(false);
    });
  }

  onEnded(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    // Play fade-out animation, then notify parent.
    this.isExiting.set(true);
    setTimeout(() => {
      this.ended.emit();
    }, 380);
  }

  onError(): void {
    this.videoError.set(true);
  }

  onContinuarClick(): void {
    this.onEnded();
  }
}
