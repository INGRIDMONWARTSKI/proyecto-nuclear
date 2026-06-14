import { Component } from '@angular/core';

type LeafVisibility = 'all' | 'tablet-up' | 'desktop';

interface AmbientLeaf {
  id: number;
  top: string;
  left: string;
  size: number;
  color: string;
  opacity: number;
  duration: number;
  delay: number;
  variant: 'a' | 'b';
  visibility: LeafVisibility;
}

@Component({
  selector: 'app-profesor-ambient',
  standalone: true,
  templateUrl: './profesor-ambient.component.html',
  styleUrl: './profesor-ambient.component.scss',
})
export class ProfesorAmbientComponent {
  /** 18 hojas en desktop; 10 en tablet; 4 en móvil — solo decoración lateral. */
  readonly leaves: AmbientLeaf[] = [
    { id: 1, top: '7%', left: '4vw', size: 28, color: '#7CB342', opacity: 0.68, duration: 12, delay: 0, variant: 'a', visibility: 'all' },
    { id: 2, top: '16%', left: '18vw', size: 22, color: '#9CCC65', opacity: 0.38, duration: 14, delay: 2.1, variant: 'b', visibility: 'tablet-up' },
    { id: 3, top: '24%', left: '8vw', size: 32, color: '#689F38', opacity: 0.72, duration: 10, delay: 4.5, variant: 'a', visibility: 'all' },
    { id: 4, top: '34%', left: '15vw', size: 20, color: '#4F7F3A', opacity: 0.42, duration: 16, delay: 1.3, variant: 'b', visibility: 'tablet-up' },
    { id: 5, top: '46%', left: '5vw', size: 26, color: '#7CB342', opacity: 0.58, duration: 11, delay: 6.2, variant: 'a', visibility: 'tablet-up' },
    { id: 6, top: '54%', left: '20vw', size: 18, color: '#2F5D34', opacity: 0.32, duration: 15, delay: 3.8, variant: 'b', visibility: 'desktop' },
    { id: 7, top: '63%', left: '10vw', size: 30, color: '#689F38', opacity: 0.7, duration: 9, delay: 7.4, variant: 'a', visibility: 'tablet-up' },
    { id: 8, top: '74%', left: '6vw', size: 22, color: '#9CCC65', opacity: 0.48, duration: 13, delay: 5.6, variant: 'b', visibility: 'desktop' },
    { id: 9, top: '86%', left: '17vw', size: 16, color: '#4F7F3A', opacity: 0.35, duration: 17, delay: 8.9, variant: 'a', visibility: 'desktop' },
    { id: 10, top: '11%', left: '12vw', size: 24, color: '#2F5D34', opacity: 0.4, duration: 14.5, delay: 2.7, variant: 'b', visibility: 'desktop' },
    { id: 11, top: '9%', left: '82vw', size: 26, color: '#7CB342', opacity: 0.62, duration: 11.5, delay: 1.9, variant: 'b', visibility: 'all' },
    { id: 12, top: '18%', left: '93vw', size: 20, color: '#9CCC65', opacity: 0.35, duration: 15, delay: 4.1, variant: 'a', visibility: 'tablet-up' },
    { id: 13, top: '28%', left: '87vw', size: 34, color: '#689F38', opacity: 0.74, duration: 10.5, delay: 6.8, variant: 'b', visibility: 'tablet-up' },
    { id: 14, top: '40%', left: '79vw', size: 22, color: '#4F7F3A', opacity: 0.44, duration: 16.5, delay: 0.8, variant: 'a', visibility: 'desktop' },
    { id: 15, top: '51%', left: '94vw', size: 18, color: '#2F5D34', opacity: 0.3, duration: 12.5, delay: 5.2, variant: 'b', visibility: 'desktop' },
    { id: 16, top: '58%', left: '84vw', size: 28, color: '#7CB342', opacity: 0.65, duration: 9.5, delay: 7.1, variant: 'a', visibility: 'tablet-up' },
    { id: 17, top: '71%', left: '90vw', size: 24, color: '#689F38', opacity: 0.55, duration: 13.5, delay: 3.3, variant: 'b', visibility: 'all' },
    { id: 18, top: '84%', left: '81vw', size: 20, color: '#9CCC65', opacity: 0.38, duration: 18, delay: 9.4, variant: 'a', visibility: 'tablet-up' },
    { id: 19, top: '92%', left: '92vw', size: 16, color: '#4F7F3A', opacity: 0.33, duration: 14, delay: 6.5, variant: 'b', visibility: 'desktop' },
    { id: 20, top: '32%', left: '3vw', size: 20, color: '#689F38', opacity: 0.45, duration: 12, delay: 4.9, variant: 'b', visibility: 'desktop' },
  ];
}
