import { Component, output, signal } from '@angular/core';
import { GuideChoice, getGuideChoice } from '../../utils/video-guide.util';

@Component({
  selector: 'app-video-guide-picker',
  standalone: true,
  templateUrl: './video-guide-picker.component.html',
  styleUrl: './video-guide-picker.component.scss',
})
export class VideoGuidePickerComponent {
  readonly guideSelected = output<GuideChoice>();
  readonly pickerClosed = output<void>();

  // Pre-select the stored choice so "Cambiar guía" reflects the current selection.
  protected readonly selected = signal<GuideChoice>(getGuideChoice());

  selectGuide(choice: GuideChoice): void {
    this.selected.set(choice);
  }

  confirm(): void {
    this.guideSelected.emit(this.selected());
  }

  close(): void {
    this.pickerClosed.emit();
  }
}
