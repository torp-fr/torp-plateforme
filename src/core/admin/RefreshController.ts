// ─────────────────────────────────────────────────────────────────────────────
// RefreshController — Manage configurable refresh intervals for admin dashboards.
// Granular control: 5s, 15s, 30s, 1m, 5m, 20m, 1h, 4h, 12h, 24h, or OFF.
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────────────────────────

export const REFRESH_INTERVALS = {
  '5s':  5_000,
  '15s': 15_000,
  '30s': 30_000,
  '1m':  60_000,
  '5m':  300_000,
  '20m': 1_200_000,
  '1h':  3_600_000,
  '4h':  14_400_000,
  '12h': 43_200_000,
  '24h': 86_400_000,
  'OFF': 0,
} as const;

export type RefreshIntervalKey = keyof typeof REFRESH_INTERVALS;

// ── Types ────────────────────────────────────────────────────────────────────

export interface RefreshConfig {
  monitor_id: string;
  interval_ms: number;  // 0 = manual only
  is_active: boolean;
  last_refresh: Date | null;
  next_refresh: Date | null;
}

// ── RefreshController ─────────────────────────────────────────────────────────

export class RefreshController {
  private configs: Map<string, RefreshConfig> = new Map();
  private handles: Map<string, ReturnType<typeof setInterval>> = new Map();
  private callbacks: Map<string, () => Promise<void>> = new Map();

  /**
   * Register a monitor with an initial refresh interval.
   * If intervalMs > 0, starts the interval immediately.
   */
  registerMonitor(
    monitorId: string,
    onRefresh: () => Promise<void>,
    defaultIntervalMs: number = 30_000
  ): void {
    const config: RefreshConfig = {
      monitor_id: monitorId,
      interval_ms: defaultIntervalMs,
      is_active: defaultIntervalMs > 0,
      last_refresh: null,
      next_refresh: defaultIntervalMs > 0 ? new Date(Date.now() + defaultIntervalMs) : null,
    };

    this.configs.set(monitorId, config);
    this.callbacks.set(monitorId, onRefresh);

    if (config.is_active) {
      this.startInterval(monitorId);
    }
  }

  /**
   * Update the refresh interval for a registered monitor.
   * Pass 0 (or REFRESH_INTERVALS.OFF) to switch to manual-only mode.
   */
  updateInterval(monitorId: string, intervalMs: number): void {
    const config = this.configs.get(monitorId);
    if (!config) throw new Error(`Monitor not registered: ${monitorId}`);

    this.stopInterval(monitorId);

    config.interval_ms = intervalMs;
    config.is_active = intervalMs > 0;
    config.next_refresh = intervalMs > 0 ? new Date(Date.now() + intervalMs) : null;

    if (config.is_active) {
      this.startInterval(monitorId);
    }
  }

  /**
   * Trigger an immediate refresh for a monitor.
   * Updates last_refresh and (if active) schedules next_refresh.
   */
  async manualRefresh(monitorId: string): Promise<void> {
    const config = this.configs.get(monitorId);
    if (!config) throw new Error(`Monitor not registered: ${monitorId}`);

    config.last_refresh = new Date();
    config.next_refresh = config.is_active
      ? new Date(Date.now() + config.interval_ms)
      : null;

    const cb = this.callbacks.get(monitorId);
    if (cb) {
      try {
        await cb();
      } catch (err) {
        console.warn(`[RefreshController] Manual refresh failed for ${monitorId}:`, err);
      }
    }
  }

  /** Stop a specific monitor's interval. */
  stopMonitor(monitorId: string): void {
    this.stopInterval(monitorId);
    const config = this.configs.get(monitorId);
    if (config) {
      config.is_active = false;
      config.next_refresh = null;
    }
  }

  /** Stop all intervals (cleanup). */
  stopAll(): void {
    for (const monitorId of this.handles.keys()) {
      this.stopInterval(monitorId);
    }
  }

  /** Get config for a specific monitor. */
  getConfig(monitorId: string): RefreshConfig | undefined {
    return this.configs.get(monitorId);
  }

  /** Get all monitor configs. */
  getAllConfigs(): RefreshConfig[] {
    return Array.from(this.configs.values());
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private startInterval(monitorId: string): void {
    const config = this.configs.get(monitorId);
    const cb = this.callbacks.get(monitorId);
    if (!config || !cb || config.interval_ms <= 0) return;

    const handle = setInterval(async () => {
      try {
        await cb();
        config.last_refresh = new Date();
        config.next_refresh = new Date(Date.now() + config.interval_ms);
      } catch (err) {
        console.warn(`[RefreshController] Auto-refresh failed for ${monitorId}:`, err);
      }
    }, config.interval_ms);

    this.handles.set(monitorId, handle);
  }

  private stopInterval(monitorId: string): void {
    const handle = this.handles.get(monitorId);
    if (handle != null) {
      clearInterval(handle);
      this.handles.delete(monitorId);
    }
  }
}
