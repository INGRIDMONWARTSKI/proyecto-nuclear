import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  AuthSession,
  ChangeTemporaryPasswordPayload,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  LoginPayload,
  ResetPasswordPayload,
  ResetPasswordResponse,
} from '../models/auth.model';
import { Role } from '../models/role.enum';
import { Usuario } from '../models/usuario.model';
import { isJwtExpired } from '../utils/jwt.util';

const SESSION_KEY = 'nuclear.auth.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sessionSignal = signal<AuthSession | null>(this.readStoredSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly user = computed(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.sessionSignal()?.accessToken));
  readonly role = computed(() => this.sessionSignal()?.user.role ?? null);

  readonly mustChangePassword = computed(
    () => this.sessionSignal()?.user.mustChangePassword ?? false,
  );

  login(payload: LoginPayload) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, payload)
      .pipe(tap((response) => this.persistSession(response)));
  }

  changeTemporaryPassword(payload: ChangeTemporaryPasswordPayload) {
    return this.http
      .post<AuthResponse>(
        `${environment.apiUrl}/auth/change-temporary-password`,
        payload,
      )
      .pipe(tap((response) => this.persistSession(response)));
  }

  forgotPassword(payload: ForgotPasswordPayload) {
    return this.http.post<ForgotPasswordResponse>(
      `${environment.apiUrl}/auth/forgot-password`,
      payload,
    );
  }

  resetPassword(payload: ResetPasswordPayload) {
    return this.http.post<ResetPasswordResponse>(
      `${environment.apiUrl}/auth/reset-password`,
      payload,
    );
  }

  logout() {
    const token = this.sessionSignal()?.accessToken;

    if (token) {
      this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({
        complete: () => this.clearSession(),
        error: () => this.clearSession(),
      });
      return;
    }

    this.clearSession();
  }

  refreshMe() {
    return this.http.get<Usuario>(`${environment.apiUrl}/auth/me`).pipe(
      tap((user) => {
        const current = this.sessionSignal();
        if (!current) {
          return;
        }

        this.persistSession({
          accessToken: current.accessToken,
          expiresIn: '1d',
          user,
        });
      }),
    );
  }

  getToken(): string | null {
    return this.sessionSignal()?.accessToken ?? null;
  }

  getValidToken(): string | null {
    const token = this.getToken();
    if (!token || this.isSessionExpired()) {
      return null;
    }

    return token;
  }

  isSessionExpired(): boolean {
    const token = this.getToken();
    if (!token) {
      return true;
    }

    return isJwtExpired(token);
  }

  hasValidSession(): boolean {
    return this.isAuthenticated() && !this.isSessionExpired();
  }

  invalidateLocalSession(): void {
    localStorage.removeItem(SESSION_KEY);
    this.sessionSignal.set(null);
    void this.router.navigate(['/login']);
  }

  hasRole(...roles: Role[]): boolean {
    const currentRole = this.role();
    return currentRole ? roles.includes(currentRole) : false;
  }

  canManageGrupos(): boolean {
    return this.hasRole(Role.ADMIN, Role.PROFESOR);
  }

  getDefaultRouteForRole(role: Role): string {
    switch (role) {
      case Role.ADMIN:
        return '/admin/dashboard';
      case Role.PROFESOR:
        return '/profesor/dashboard';
      case Role.ESTUDIANTE:
        return '/estudiante/dashboard';
      default:
        return '/login';
    }
  }

  getRoleBasePath(): string {
    const role = this.role();
    if (!role) {
      return '/login';
    }
    switch (role) {
      case Role.ADMIN:
        return '/admin';
      case Role.PROFESOR:
        return '/profesor';
      case Role.ESTUDIANTE:
        return '/estudiante';
      default:
        return '/login';
    }
  }

  private persistSession(response: AuthResponse) {
    const user: Usuario = {
      ...response.user,
      mustChangePassword:
        response.mustChangePassword ?? response.user.mustChangePassword ?? false,
    };
    const session: AuthSession = {
      accessToken: response.accessToken,
      user,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  private readStoredSession(): AuthSession | null {
    const raw = localStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    try {
      const session = JSON.parse(raw) as AuthSession;
      if (isJwtExpired(session.accessToken)) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      return {
        ...session,
        user: {
          ...session.user,
          mustChangePassword: session.user.mustChangePassword ?? false,
        },
      };
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  private clearSession() {
    localStorage.removeItem(SESSION_KEY);
    this.sessionSignal.set(null);
    void this.router.navigate(['/login']);
  }
}
