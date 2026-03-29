import type { APICallResult, APIClientConfig } from '../types/index.js';

export class BaseAPIClient {
  protected config: APIClientConfig;
  private cache = new Map<string, { data: unknown; timestamp: number }>();

  constructor(config: APIClientConfig) {
    this.config = config;
  }

  protected async callAPI<T>(
    method: 'GET' | 'POST' | 'PUT',
    endpoint: string,
    options?: {
      query?: Record<string, unknown>;
      body?: unknown;
      headers?: Record<string, string>;
      cacheKey?: string;
      cacheTTLSeconds?: number;
    }
  ): Promise<APICallResult<T>> {
    const startTime = Date.now();

    // Cache check
    if (options?.cacheKey) {
      const cached = this.cache.get(options.cacheKey);
      const ttl = (options.cacheTTLSeconds ?? 3600) * 1000;
      if (cached && Date.now() - cached.timestamp < ttl) {
        return { success: true, data: cached.data as T, executionTimeMs: 0 };
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `${this.config.baseUrl}${endpoint}`);

        if (options?.query) {
          for (const [k, v] of Object.entries(options.query)) {
            if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
          }
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url.toString(), {
          method,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this.getAuthHeaders(),
            ...(options?.headers ?? {}),
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
        });

        clearTimeout(timer);

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const data = (await response.json()) as T;

        if (options?.cacheKey) {
          this.cache.set(options.cacheKey, { data, timestamp: Date.now() });
        }

        return {
          success: true,
          data,
          statusCode: response.status,
          retryCount: attempt,
          executionTimeMs: Date.now() - startTime,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.config.retries) {
          await this.sleep(this.config.backoffMs * Math.pow(2, attempt));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message ?? 'Unknown error',
      executionTimeMs: Date.now() - startTime,
      retryCount: this.config.retries,
    };
  }

  protected getAuthHeaders(): Record<string, string> {
    return this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {};
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  clearCache(prefix?: string): void {
    if (!prefix) { this.cache.clear(); return; }
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }
}
