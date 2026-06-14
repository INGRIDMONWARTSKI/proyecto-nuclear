import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-cambiar-contrasena-temporal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './cambiar-contrasena-temporal.component.html',
  styleUrl: './cambiar-contrasena-temporal.component.scss',
})
export class CambiarContrasenaTemporalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly showCurrentPassword = signal(false);
  protected readonly showNewPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();
    if (payload.newPassword !== payload.confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.authService.changeTemporaryPassword(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('Contraseña actualizada correctamente.');
        window.setTimeout(() => {
          const role = this.authService.role();
          if (role) {
            void this.router.navigateByUrl(
              this.authService.getDefaultRouteForRole(role),
            );
          }
        }, 800);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        const message = Array.isArray(error.error?.message)
          ? error.error.message.join(' ')
          : error.error?.message;
        this.errorMessage.set(
          message || 'No fue posible actualizar la contraseña.',
        );
      },
    });
  }

  toggleCurrentPassword() {
    this.showCurrentPassword.update((value) => !value);
  }

  toggleNewPassword() {
    this.showNewPassword.update((value) => !value);
  }

  toggleConfirmPassword() {
    this.showConfirmPassword.update((value) => !value);
  }
}
