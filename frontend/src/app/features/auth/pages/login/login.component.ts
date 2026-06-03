import { NgStyle } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

interface DemoAccount {
  label: string;
  role: 'admin' | 'profesor' | 'estudiante';
  email: string;
  password: string;
}

interface StoryCard {
  title: string;
  description: string;
  icon: 'cases' | 'decisions' | 'feedback';
}

interface Pillar {
  label: string;
  icon: string;
}

interface FloatingLeaf {
  id: number;
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
  variant: 1 | 2 | 3;
  depth: number;
}

interface OrbitalIcon {
  id: string;
  label: string;
  icon: 'sprout' | 'heart' | 'brain';
  delay: number;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgStyle],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly loginSuccess = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly demoPulse = signal<string | null>(null);
  protected readonly parallaxX = signal(0);
  protected readonly parallaxY = signal(0);
  protected readonly btnPressed = signal(false);

  protected readonly floatingLeaves: FloatingLeaf[] = [
    { id: 1, top: '6%', left: '4%', size: 28, delay: 0, duration: 18, variant: 1, depth: 6 },
    { id: 2, top: '18%', left: '88%', size: 22, delay: -3, duration: 22, variant: 2, depth: 10 },
    { id: 3, top: '42%', left: '8%', size: 32, delay: -6, duration: 20, variant: 3, depth: 8 },
    { id: 4, top: '68%', left: '78%', size: 26, delay: -9, duration: 24, variant: 1, depth: 12 },
    { id: 5, top: '32%', left: '52%', size: 20, delay: -4, duration: 16, variant: 2, depth: 5 },
    { id: 6, top: '82%', left: '14%', size: 24, delay: -11, duration: 21, variant: 3, depth: 7 },
    { id: 7, top: '12%', left: '62%', size: 18, delay: -7, duration: 19, variant: 1, depth: 9 },
    { id: 8, top: '55%', left: '92%', size: 30, delay: -13, duration: 23, variant: 2, depth: 11 },
  ];

  protected readonly orbitIcons: OrbitalIcon[] = [
    { id: 'sprout', label: 'Decisión consciente', icon: 'sprout', delay: 0 },
    { id: 'heart', label: 'Empatía clínica', icon: 'heart', delay: -8 },
    { id: 'brain', label: 'Reflexión', icon: 'brain', delay: -16 },
  ];

  protected readonly storyCards: StoryCard[] = [
    {
      title: 'Casos reales',
      description: 'Explora situaciones clínicas guiadas paso a paso.',
      icon: 'cases',
    },
    {
      title: 'Decisiones conscientes',
      description: 'Elige rutas y analiza el impacto de cada acción.',
      icon: 'decisions',
    },
    {
      title: 'Retroalimentación',
      description: 'Recibe orientación pedagógica inmediata.',
      icon: 'feedback',
    },
  ];

  protected readonly pillars: Pillar[] = [
    { label: 'Experiencias inmersivas', icon: '🧠' },
    { label: 'Aprendizaje significativo', icon: '💬' },
    { label: 'Empatía y ciencia', icon: '🌸' },
    { label: 'Desarrollo profesional', icon: '📈' },
    { label: 'Seguridad y privacidad', icon: '🛡' },
  ];

  protected readonly demoAccounts: DemoAccount[] = [
    {
      label: 'Admin',
      role: 'admin',
      email: 'admin@nuclear.local',
      password: 'Admin123*',
    },
    {
      label: 'Profesor',
      role: 'profesor',
      email: 'profesor@nuclear.local',
      password: 'Profesor123*',
    },
    {
      label: 'Estudiante',
      role: 'estudiante',
      email: 'estudiante1@nuclear.local',
      password: 'Estudiante123*',
    },
  ];

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid || this.loading() || this.loginSuccess()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.loginSuccess.set(true);
        window.setTimeout(() => {
          const role = this.authService.role();
          if (role) {
            void this.router.navigateByUrl(
              this.authService.getDefaultRouteForRole(role),
            );
          }
        }, 900);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(this.resolveLoginError(error));
      },
    });
  }

  fillDemo(account: DemoAccount) {
    this.form.patchValue({
      email: account.email,
      password: account.password,
    });
    this.errorMessage.set(null);
    this.demoPulse.set(account.label);
    window.setTimeout(() => this.demoPulse.set(null), 700);
  }

  togglePassword() {
    this.showPassword.update((value) => !value);
  }

  onPageMove(event: MouseEvent) {
    const x = (event.clientX / window.innerWidth - 0.5) * 2;
    const y = (event.clientY / window.innerHeight - 0.5) * 2;
    this.parallaxX.set(x);
    this.parallaxY.set(y);
  }

  onPageLeave() {
    this.parallaxX.set(0);
    this.parallaxY.set(0);
  }

  parallaxStyle(depth: number): Record<string, string> {
    const x = this.parallaxX() * depth;
    const y = this.parallaxY() * depth;
    return { transform: `translate3d(${x}px, ${y}px, 0)` };
  }

  orbitParallaxStyle(): Record<string, string> {
    const x = this.parallaxX() * 18;
    const y = this.parallaxY() * 18;
    return { transform: `translate3d(${x}px, ${y}px, 0)` };
  }

  private resolveLoginError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'No hay conexión con el servidor. Verifica que el backend esté activo.';
      }

      const body = error.error as { message?: string | string[] };
      const message = Array.isArray(body?.message)
        ? body.message.join(' ')
        : typeof body?.message === 'string'
          ? body.message
          : '';

      const lower = message.toLowerCase();
      if (
        lower.includes('postgrest') ||
        lower.includes('conectar con el servidor') ||
        lower.includes('comunicarse con')
      ) {
        return 'No hay conexión con el servidor. Verifica que el backend esté activo.';
      }

      if (error.status === 401 || error.status === 403) {
        return 'No pudimos iniciar sesión. Verifica tus credenciales.';
      }
    }

    return 'No pudimos iniciar sesión. Verifica tus credenciales.';
  }
}
