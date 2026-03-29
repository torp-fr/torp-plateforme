// ─────────────────────────────────────────────────────────────────────────────
// BasePipeline — Abstract base class for all TORP pipeline handlers
// Provides: template method pattern, caching, retry, structured logging, metrics
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { PipelineCache } from './PipelineCache.js';
import { PipelineRetry } from './PipelineRetry.js';
import type { PipelineContext, PipelineResult } from '../../types/index.js';

export abstract class BasePipeline<TInput, TOutput> {
  protected readonly name: string;
  protected readonly cache = new PipelineCache();
  protected readonly retry = new PipelineRetry();

  // Lazy Supabase client — only created if metrics emission is needed
  private _supabase?: ReturnType<typeof createClient>;
  protected get supabase() {
    if (!this._supabase) {
      this._supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
    }
    return this._supabase;
  }

  constructor(name: string) {
    this.name = name;
  }

  // ── Template method ────────────────────────────────────────────────────────

  /**
   * Public entry point. Handles caching, retry, logging, and metrics.
   * Subclasses implement executeInternal() with their business logic.
   */
  async execute(
    input: TInput,
    context: PipelineContext
  ): Promise<PipelineResult<TOutput>> {
    const startTime = Date.now();
    const logCtx = { pipeline: this.name, entityId: context.entityId };
    const maxAttempts = this.getMaxRetryAttempts();

    // ── Cache check ──────────────────────────────────────────────────────────
    const cacheKey = this.getCacheKey(input);
    if (cacheKey) {
      const cached = await this.cache.get<TOutput>(cacheKey);
      if (cached) {
        this.log('debug', 'Cache hit', { ...logCtx, cacheKey });
        return {
          status: 'completed',
          data: cached.data,
          executionTimeMs: Date.now() - startTime,
          retryable: false,
        };
      }
    }

    // ── Retry loop ────────────────────────────────────────────────────────────
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.executeInternal(input, context);

        // ── Success ────────────────────────────────────────────────────────
        if (result.status === 'completed' && result.data !== undefined && cacheKey) {
          await this.cache.set(cacheKey, result.data, this.getCacheTTL());
        }

        const duration = Date.now() - startTime;
        this.log('info', 'Pipeline completed', { ...logCtx, duration_ms: duration, attempt });
        this.emitMetrics('success', duration, attempt).catch(() => {/* non-blocking */});

        return { ...result, executionTimeMs: duration };

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const retryable = this.retry.isRetryable(lastError) && this.isRetryableError(lastError);

        this.log('warn', 'Pipeline attempt failed', {
          ...logCtx, attempt, maxAttempts, error: lastError.message,
        });

        if (!retryable || attempt === maxAttempts) {
          const duration = Date.now() - startTime;
          this.emitMetrics('failure', duration, attempt, lastError).catch(() => {/* non-blocking */});
          this.log('error', 'Pipeline failed permanently', {
            ...logCtx, error: lastError.message,
            reason: retryable ? 'max retries exceeded' : 'non-retryable error',
          });
          return {
            status: 'failed',
            error: lastError.message,
            executionTimeMs: duration,
            retryable,
          };
        }

        // ── Backoff before next attempt ─────────────────────────────────────
        const delay = this.retry.getBackoffDelay(attempt, lastError);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    return {
      status: 'failed',
      error: lastError?.message ?? 'Unknown error',
      executionTimeMs: Date.now() - startTime,
      retryable: true,
    };
  }

  // ── Abstract method ────────────────────────────────────────────────────────

  /** Subclasses implement their business logic here. */
  protected abstract executeInternal(
    input: TInput,
    context: PipelineContext
  ): Promise<PipelineResult<TOutput>>;

  // ── Overridable hooks ──────────────────────────────────────────────────────

  /** Return a cache key string, or null to disable caching for this pipeline. */
  protected getCacheKey(_input: TInput): string | null {
    return null;
  }

  /** Cache TTL in milliseconds. Default: 24h. */
  protected getCacheTTL(): number {
    return 24 * 60 * 60 * 1000;
  }

  /** Maximum retry attempts. Default: from env RETRY_MAX_ATTEMPTS or 3. */
  protected getMaxRetryAttempts(): number {
    return parseInt(process.env.RETRY_MAX_ATTEMPTS ?? '3', 10);
  }

  /** Override for pipeline-specific retryability. Called after PipelineRetry.isRetryable(). */
  protected isRetryableError(_err: Error): boolean {
    return true;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta: object): void {
    const line = `[${this.name}] ${message} ${JSON.stringify(meta)}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else if (process.env.NODE_ENV !== 'production' || level === 'info') console.log(line);
  }

  /**
   * Write pipeline execution metrics to `pipeline_metrics` table.
   * Fire-and-forget — failures are swallowed (observability must not break pipelines).
   */
  private async emitMetrics(
    status: 'success' | 'failure',
    durationMs: number,
    attempt: number,
    error?: Error
  ): Promise<void> {
    try {
      await this.supabase.from('pipeline_metrics').insert({
        pipeline_name: this.name,
        status,
        duration_ms: durationMs,
        attempt_number: attempt,
        error_message: error?.message ?? null,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Intentionally swallowed — metrics table may not exist yet
    }
  }
}
