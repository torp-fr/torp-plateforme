// ─────────────────────────────────────────────────────────────────────────────
// APIHealthMonitor — Track real-time status of external APIs.
// Auto-detects down/degraded state + triggers retry protocol + escalates alerts.
//
// Writes health snapshots to `api_health_metrics` table.
// Read by admin API route GET /admin/api-health.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface APIConfig {
  name: string;
  healthCheckFn: () => Promise<void>;
  timeout_ms: number;
  health_check_interval_ms: number;
}

export interface APIHealthStatus {
  api_name: string;
  status: 'online' | 'degraded' | 'down' | 'unknown';
  last_check: Date | null;
  response_time_ms: number;
  error_rate: number;              // 0–1
  call_count_today: number;
  error_count_today: number;
  alerts: string[];                // ['DOWN', 'DEGRADED', 'SLOW', ...]
  is_down_since: Date | null;
  is_degraded_since: Date | null;
}

export interface RetryProtocol {
  api_name: string;
  started_at: Date;
  retry_count: number;
  next_retry_at: Date;
  is_active: boolean;
}

// ── APIHealthMonitor ──────────────────────────────────────────────────────────

export class APIHealthMonitor {
  readonly healthStatuses: Map<string, APIHealthStatus> = new Map();
  readonly retryProtocols: Map<string, RetryProtocol> = new Map();
  private intervalHandles: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Register an API for continuous monitoring.
   * Immediately performs a health check and starts the periodic interval.
   */
  registerAPI(config: APIConfig): void {
    if (!this.healthStatuses.has(config.name)) {
      this.healthStatuses.set(config.name, {
        api_name: config.name,
        status: 'unknown',
        last_check: null,
        response_time_ms: 0,
        error_rate: 0,
        call_count_today: 0,
        error_count_today: 0,
        alerts: [],
        is_down_since: null,
        is_degraded_since: null,
      });
    }

    const handle = setInterval(
      () => void this.performHealthCheck(config),
      config.health_check_interval_ms
    );
    this.intervalHandles.set(config.name, handle);
  }

  /**
   * Perform a single health check for the given API config.
   * Exposed publicly so tests can call it directly without timers.
   */
  async performHealthCheck(config: APIConfig): Promise<void> {
    const status = this.healthStatuses.get(config.name);
    if (!status) return;

    const startTime = Date.now();

    try {
      await Promise.race([
        config.healthCheckFn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), config.timeout_ms)
        ),
      ]);

      const duration = Date.now() - startTime;
      const wasDown = status.alerts.includes('DOWN');

      status.status = 'online';
      status.last_check = new Date();
      status.response_time_ms = duration;
      status.is_down_since = null;
      status.is_degraded_since = null;

      if (wasDown) {
        status.alerts = status.alerts.filter(a => a !== 'DOWN' && a !== 'DEGRADED');
        await this.alertAdminAPIRecovered(config.name, status);
      }

      await this.persistHealthCheck(config.name, 'online', duration, null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (!status.is_down_since) {
        status.is_down_since = new Date();
      }

      const downForMs = Date.now() - status.is_down_since.getTime();

      if (downForMs > 60_000) {
        status.status = 'down';
        if (!status.alerts.includes('DOWN')) {
          status.alerts.push('DOWN');
          await this.alertAdminAPIDown(config.name, downForMs, error);

          // Start retry protocol if not already running
          if (!this.retryProtocols.has(config.name)) {
            this.startRetryProtocol(config);
          }
        }
      } else if (downForMs > 30_000) {
        status.status = 'degraded';
        if (!status.alerts.includes('DEGRADED')) {
          status.alerts.push('DEGRADED');
          status.is_degraded_since = new Date();
        }
      }

      status.last_check = new Date();
      status.error_count_today++;
      status.error_rate = status.error_count_today /
        Math.max(1, status.call_count_today + status.error_count_today);

      await this.persistHealthCheck(config.name, status.status, Date.now() - startTime, error.message);
    }
  }

  /** Stop monitoring a specific API. */
  stopMonitoring(apiName: string): void {
    const handle = this.intervalHandles.get(apiName);
    if (handle) {
      clearInterval(handle);
      this.intervalHandles.delete(apiName);
    }
  }

  /** Stop all monitors (for server shutdown / test teardown). */
  stopAll(): void {
    for (const [name] of this.intervalHandles) {
      this.stopMonitoring(name);
    }
    for (const [, protocol] of this.retryProtocols) {
      protocol.is_active = false;
    }
  }

  /** Get all current health statuses (for admin dashboard). */
  getAllAPIStatus(): APIHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  /** Get health status for a specific API. */
  getAPIStatus(apiName: string): APIHealthStatus | undefined {
    return this.healthStatuses.get(apiName);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private startRetryProtocol(config: APIConfig): void {
    let retryCount = 0;
    const maxRetries = 5;

    const protocol: RetryProtocol = {
      api_name: config.name,
      started_at: new Date(),
      retry_count: 0,
      next_retry_at: new Date(),
      is_active: true,
    };

    this.retryProtocols.set(config.name, protocol);

    // Exponential backoff: 10s, 30s, 90s, 270s, 810s
    const schedule = () => {
      if (retryCount >= maxRetries) {
        protocol.is_active = false;
        this.retryProtocols.delete(config.name);
        return;
      }

      retryCount++;
      protocol.retry_count = retryCount;
      const delay = 10_000 * Math.pow(3, retryCount - 1);
      protocol.next_retry_at = new Date(Date.now() + delay);

      setTimeout(async () => {
        if (!protocol.is_active) return;

        try {
          await Promise.race([
            config.healthCheckFn(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), config.timeout_ms)
            ),
          ]);

          // Recovered!
          const status = this.healthStatuses.get(config.name);
          if (status) {
            status.status = 'online';
            status.is_down_since = null;
            status.alerts = status.alerts.filter(a => a !== 'DOWN' && a !== 'DEGRADED');
          }

          protocol.is_active = false;
          this.retryProtocols.delete(config.name);

          console.info(`[APIHealthMonitor] ${config.name} recovered via retry protocol (attempt ${retryCount})`);
        } catch {
          schedule(); // Schedule next retry
        }
      }, delay);
    };

    schedule();
  }

  private async persistHealthCheck(
    apiName: string,
    status: string,
    responseTimeMs: number,
    errorMessage: string | null
  ): Promise<void> {
    try {
      await this.supabase.from('api_health_metrics').insert({
        api_name: apiName,
        status,
        response_time_ms: responseTimeMs,
        error_message: errorMessage,
        checked_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn(`[APIHealthMonitor] Failed to persist health check for ${apiName}:`, err);
    }
  }

  protected async alertAdminAPIDown(apiName: string, downForMs: number, error: Error): Promise<void> {
    console.error(`[APIHealthMonitor] API DOWN: ${apiName} (down for ${downForMs}ms) — ${error.message}`);
  }

  protected async alertAdminAPIRecovered(apiName: string, _status: APIHealthStatus): Promise<void> {
    console.info(`[APIHealthMonitor] API RECOVERED: ${apiName}`);
  }
}
