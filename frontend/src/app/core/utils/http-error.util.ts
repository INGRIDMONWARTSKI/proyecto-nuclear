import { HttpErrorResponse } from '@angular/common/http';

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string | string[] };

    if (Array.isArray(body?.message)) {
      return body.message.join('. ');
    }

    if (typeof body?.message === 'string') {
      return body.message;
    }

    if (error.status === 0) {
      return 'No fue posible conectar con el servidor.';
    }
  }

  return fallback;
}
