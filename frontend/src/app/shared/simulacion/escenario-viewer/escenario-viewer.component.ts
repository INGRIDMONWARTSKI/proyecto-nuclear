import { NgStyle } from '@angular/common';
import { Component, Input } from '@angular/core';
import { EscenarioActual } from '../../../features/simulacion/models/escenario-actual.model';
import { EditorElement } from '../../../features/simulacion/models/docente/editor-layout.model';

@Component({
  selector: 'app-escenario-viewer',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './escenario-viewer.component.html',
  styleUrl: './escenario-viewer.component.scss',
})
export class EscenarioViewerComponent {
  @Input({ required: true }) escenario!: EscenarioActual;

  visibleElements(): EditorElement[] {
    return [...this.escenario.layout.elements]
      .filter((item) => !item.hidden && item.type !== 'background')
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  contentText(element: EditorElement, key = 'texto'): string {
    const value = element.content[key];
    return typeof value === 'string' ? value : '';
  }

  contentLabel(element: EditorElement, key: string): string {
    const value = element.content[key];
    return typeof value === 'string' ? value : '';
  }

  elementStyle(element: EditorElement): Record<string, string> {
    return {
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      width: `${element.size.width}px`,
      height: `${element.size.height}px`,
      transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
      zIndex: String(element.zIndex),
    };
  }

  stageBackgroundStyle(): Record<string, string> {
    const imageUrl = this.backgroundImageUrl();

    if (imageUrl) {
      return {
        backgroundImage: `linear-gradient(rgba(31, 61, 46, 0.08), rgba(31, 61, 46, 0.08)), url('${imageUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }

    return {
      background: this.backgroundStyle(),
    };
  }

  hasBackgroundImage(): boolean {
    return Boolean(this.backgroundImageUrl());
  }

  elementImageUrl(element: EditorElement): string {
    return this.contentLabel(element, 'imageUrl');
  }

  elementObjectFit(element: EditorElement): string {
    const value = element.style['objectFit'];
    return typeof value === 'string' ? value : 'contain';
  }

  backgroundStyle(): string {
    const code = this.escenario.fondoCodigo.toLowerCase();

    if (code.includes('hospital')) {
      return 'linear-gradient(160deg, #f5fbff 0%, #dbeeff 58%, #bcd9ef 100%)';
    }

    if (code.includes('casa')) {
      return 'linear-gradient(160deg, #fff7ed 0%, #ffe0b2 55%, #ffcc80 100%)';
    }

    if (code.includes('aula')) {
      return 'linear-gradient(160deg, #fefce8 0%, #dcedc8 55%, #c5e1a5 100%)';
    }

    if (code.includes('oficina')) {
      return 'linear-gradient(160deg, #f4f7fb 0%, #dce7f7 55%, #c5d6f2 100%)';
    }

    return 'linear-gradient(160deg, #eff7f0 0%, #dbead8 48%, #bfd8be 100%)';
  }

  characterGradient(element: EditorElement): string {
    const avatar = this.contentLabel(element, 'avatar').toLowerCase();
    const rol = this.contentLabel(element, 'rol').toLowerCase();

    if (avatar.includes('therapist') || rol.includes('psico')) {
      return 'linear-gradient(180deg, #CDE8B5 0%, #7CB342 100%)';
    }

    if (rol.includes('familiar')) {
      return 'linear-gradient(180deg, #ffe0b2 0%, #ffb74d 100%)';
    }

    return 'linear-gradient(180deg, #f4c7ab 0%, #d79a7a 100%)';
  }

  private backgroundImageUrl(): string {
    const background = this.escenario.layout.elements.find((item) => item.type === 'background');
    if (!background) {
      return '';
    }

    const styleUrl = background.style['imageUrl'];
    if (typeof styleUrl === 'string' && styleUrl.trim()) {
      return styleUrl.trim();
    }

    const contentUrl = background.content['imageUrl'];
    if (typeof contentUrl === 'string' && contentUrl.trim()) {
      return contentUrl.trim();
    }

    return '';
  }
}
