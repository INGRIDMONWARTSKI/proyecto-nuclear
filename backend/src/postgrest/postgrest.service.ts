import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type FilterValue = string | number | boolean | Array<string | number>;

interface QueryOptions {
  filters?: Record<string, FilterValue>;
  select?: string;
  order?: string;
  limit?: number;
}

interface MutationOptions {
  filters?: Record<string, FilterValue>;
  select?: string;
}

@Injectable()
export class PostgrestService {
  private readonly baseUrl: string;
  private readonly schema: string;
  private readonly headers: HeadersInit;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.getOrThrow<string>('POSTGREST_URL');
    this.schema = this.configService.get<string>('POSTGREST_SCHEMA', 'public');

    const apiKey = this.configService.get<string>('POSTGREST_API_KEY');

    this.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(apiKey ? { apikey: apiKey, Authorization: `Bearer ${apiKey}` } : {}),
    };
  }

  async select<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
    const response = await this.request(table, {
      method: 'GET',
      query: options,
    });

    return (await response.json()) as T[];
  }

  async insert<T>(
    table: string,
    payload: object,
    options: MutationOptions = {},
  ): Promise<T> {
    const response = await this.request(table, {
      method: 'POST',
      query: options,
      body: payload,
      headers: {
        Prefer: 'return=representation',
      },
    });

    const data = (await response.json()) as T[];
    return data[0];
  }

  async update<T>(
    table: string,
    payload: object,
    options: MutationOptions = {},
  ): Promise<T[]> {
    const response = await this.request(table, {
      method: 'PATCH',
      query: options,
      body: payload,
      headers: {
        Prefer: 'return=representation',
      },
    });

    return (await response.json()) as T[];
  }

  private async request(
    table: string,
    options: {
      method: 'GET' | 'POST' | 'PATCH';
      query?: QueryOptions;
      body?: object;
      headers?: HeadersInit;
    },
  ) {
    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/${table}`);
    this.appendQuery(url, options.query?.filters);

    if (options.query?.select) {
      url.searchParams.set('select', options.query.select);
    }

    if ('order' in (options.query ?? {}) && options.query?.order) {
      url.searchParams.set('order', options.query.order);
    }

    if ('limit' in (options.query ?? {}) && options.query?.limit) {
      url.searchParams.set('limit', String(options.query.limit));
    }

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: {
          ...this.headers,
          'Accept-Profile': this.schema,
          'Content-Profile': this.schema,
          ...options.headers,
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });

      if (!response.ok) {
        const detail = await this.safeReadError(response);
        throw new InternalServerErrorException(
          `PostgREST error (${response.status}): ${detail}`,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'No fue posible comunicarse con PostgREST.',
      );
    }
  }

  private appendQuery(
    url: URL,
    filters: Record<string, FilterValue> | undefined,
  ) {
    if (!filters) {
      return;
    }

    for (const [field, rawValue] of Object.entries(filters)) {
      if (Array.isArray(rawValue)) {
        url.searchParams.set(
          field,
          `in.(${rawValue.map((item) => encodeURIComponent(String(item))).join(',')})`,
        );
        continue;
      }

      url.searchParams.set(field, `eq.${encodeURIComponent(String(rawValue))}`);
    }
  }

  private async safeReadError(response: Response) {
    try {
      const body = (await response.json()) as {
        code?: string;
        details?: string;
        hint?: string;
        message?: string;
      };

      return [body.code, body.message, body.details, body.hint]
        .filter(Boolean)
        .join(' | ');
    } catch {
      return response.statusText;
    }
  }
}
