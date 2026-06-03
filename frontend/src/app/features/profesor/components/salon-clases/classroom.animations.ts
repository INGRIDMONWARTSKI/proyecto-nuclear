import {
  animate,
  keyframes,
  style,
  transition,
  trigger,
} from '@angular/animations';

export const classroomAnimations = [
  trigger('fadeSlideIn', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(18px) scale(0.96)' }),
      animate(
        '420ms cubic-bezier(0.22, 1, 0.36, 1)',
        style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
      ),
    ]),
    transition(':leave', [
      animate(
        '280ms ease-in',
        style({ opacity: 0, transform: 'translateY(10px) scale(0.95)' }),
      ),
    ]),
  ]),
  trigger('deskEnter', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(24px) scale(0.8)' }),
      animate(
        '520ms 80ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
      ),
    ]),
  ]),
  trigger('studentPop', [
    transition(':enter', [
      animate(
        '600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        keyframes([
          style({ opacity: 0, transform: 'scale(0.4) translateY(20px)', offset: 0 }),
          style({ opacity: 1, transform: 'scale(1.08) translateY(-4px)', offset: 0.65 }),
          style({ opacity: 1, transform: 'scale(1) translateY(0)', offset: 1 }),
        ]),
      ),
    ]),
    transition(':leave', [
      animate(
        '320ms ease-in',
        style({ opacity: 0, transform: 'scale(0.5) translateY(16px)' }),
      ),
    ]),
  ]),
  trigger('panelSlide', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateX(24px)' }),
      animate(
        '360ms cubic-bezier(0.22, 1, 0.36, 1)',
        style({ opacity: 1, transform: 'translateX(0)' }),
      ),
    ]),
    transition(':leave', [
      animate(
        '240ms ease-in',
        style({ opacity: 0, transform: 'translateX(16px)' }),
      ),
    ]),
  ]),
];
