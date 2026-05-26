import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthResponse, AuthSession, LoginPayload } from '../models/auth.model';
import { Role } from '../models/role.enum';
import { Usuario } from '../models/usuario.model';

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

  login(payload: LoginPayload) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, payload)
      .pipe(tap((response) => this.persistSession(response)));
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

  hasRole(...roles: Role[]): boolean {
    const currentRole = this.role();
    return currentRole ? roles.includes(currentRole) : false;
  }

  canManageGrupos(): boolean {
    return this.hasRole(Role.ADMIN, Role.PROFESOR);
  }

  private persistSession(response: AuthResponse) {
    const session: AuthSession = {
      accessToken: response.accessToken,
      user: response.user,
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
      return JSON.parse(raw) as AuthSession;
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
