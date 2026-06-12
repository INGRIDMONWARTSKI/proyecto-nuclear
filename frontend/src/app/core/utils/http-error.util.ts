import { HttpErrorResponse } from '@angular/common/http';

interface ErrorBody {
  code?: string;
  errors?: string[];
  message?: string | string[];
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ErrorBody | null;

    if (Array.isArray(body?.message)) {
      return body.message.join('. ');
    }

    if (typeof body?.message === 'string') {
      return body.message;
    }

    if (Array.isArray(body?.errors) && body.errors.length > 0) {
      return body.errors.join('. ');
    }

    if (error.status === 0) {
      return 'No fue posible conectar con el servidor.';
    }
  }

  return fallback;
}

export function getErrorBody(error: unknown): ErrorBody | null {
  if (!(error instanceof HttpErrorResponse) || typeof error.error !== 'object' || error.error === null) {
    return null;
  }

  return error.error as ErrorBody;
}
