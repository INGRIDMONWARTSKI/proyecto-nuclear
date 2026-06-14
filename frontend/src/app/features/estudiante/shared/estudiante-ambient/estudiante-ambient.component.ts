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
  selector: 'app-estudiante-ambient',
  standalone: true,
  templateUrl: './estudiante-ambient.component.html',
  styleUrl: './estudiante-ambient.component.scss',
})
export class EstudianteAmbientComponent {
  /** 16 hojas en desktop; 8 en tablet; 3 en móvil — solo decoración ambiental. */
  readonly leaves: AmbientLeaf[] = [
    { id: 1,  top: '6%',  left: '3vw',  size: 26, color: '#7CB342', opacity: 0.62, duration: 13,   delay: 0,   variant: 'a', visibility: 'all' },
    { id: 2,  top: '15%', left: '12vw', size: 20, color: '#9CCC65', opacity: 0.36, duration: 15,   delay: 2.4, variant: 'b', visibility: 'tablet-up' },
    { id: 3,  top: '26%', left: '6vw',  size: 30, color: '#689F38', opacity: 0.7,  duration: 11,   delay: 4.8, variant: 'a', visibility: 'all' },
    { id: 4,  top: '38%', left: '16vw', size: 18, color: '#4F7F3A', opacity: 0.4,  duration: 17,   delay: 1.6, variant: 'b', visibility: 'tablet-up' },
    { id: 5,  top: '50%', left: '4vw',  size: 24, color: '#7CB342', opacity: 0.54, duration: 12,   delay: 6.5, variant: 'a', visibility: 'tablet-up' },
    { id: 6,  top: '62%', left: '18vw', size: 16, color: '#2F5D34', opacity: 0.3,  duration: 14.5, delay: 3.2, variant: 'b', visibility: 'desktop' },
    { id: 7,  top: '74%', left: '9vw',  size: 28, color: '#689F38', opacity: 0.66, duration: 10,   delay: 7.8, variant: 'a', visibility: 'tablet-up' },
    { id: 8,  top: '86%', left: '5vw',  size: 20, color: '#9CCC65', opacity: 0.44, duration: 16,   delay: 5.3, variant: 'b', visibility: 'desktop' },
    { id: 9,  top: '8%',  left: '83vw', size: 24, color: '#7CB342', opacity: 0.6,  duration: 12.5, delay: 1.8, variant: 'b', visibility: 'all' },
    { id: 10, top: '20%', left: '92vw', size: 18, color: '#9CCC65', opacity: 0.34, duration: 14,   delay: 4.3, variant: 'a', visibility: 'tablet-up' },
    { id: 11, top: '31%', left: '86vw', size: 32, color: '#689F38', opacity: 0.72, duration: 11,   delay: 7.1, variant: 'b', visibility: 'tablet-up' },
    { id: 12, top: '44%', left: '78vw', size: 20, color: '#4F7F3A', opacity: 0.42, duration: 16,   delay: 0.9, variant: 'a', visibility: 'desktop' },
    { id: 13, top: '57%', left: '93vw', size: 16, color: '#2F5D34', opacity: 0.28, duration: 13,   delay: 5.7, variant: 'b', visibility: 'desktop' },
    { id: 14, top: '68%', left: '82vw', size: 26, color: '#7CB342', opacity: 0.58, duration: 10.5, delay: 3.6, variant: 'a', visibility: 'tablet-up' },
    { id: 15, top: '79%', left: '88vw', size: 22, color: '#689F38', opacity: 0.5,  duration: 15,   delay: 8.2, variant: 'b', visibility: 'all' },
    { id: 16, top: '91%', left: '80vw', size: 18, color: '#9CCC65', opacity: 0.36, duration: 18,   delay: 6.1, variant: 'a', visibility: 'tablet-up' },
  ];
}
