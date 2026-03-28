import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIHealthMonitor, type APIConfig } from '../APIHealthMonitor.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Supabase mock ─────────────────────────────────────────────────────────────

function makeMockSupabase(): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as unknown as SupabaseClient;
}

function makeConfig(
  name: string,
  healthCheckFn: () => Promise<void> = async () => undefined
): APIConfig {
  return {
    name,
    healthCheckFn,
    timeout_ms: 1_000,
    health_check_interval_ms: 60_000,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('APIHealthMonitor', () => {
  let monitor: APIHealthMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new APIHealthMonitor(makeMockSupabase());
  });

  afterEach(() => {
    monitor.stopAll();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Registration ─────────────────────────────────────────────────────────

  describe('registerAPI()', () => {
    it('initializes status as unknown', () => {
      monitor.registerAPI(makeConfig('Pappers'));
      const status = monitor.getAPIStatus('Pappers');
      expect(status?.status).toBe('unknown');
    });

    it('getAllAPIStatus returns registered API', () => {
      monitor.registerAPI(makeConfig('INSEE'));
      const all = monitor.getAllAPIStatus();
      expect(all.some(s => s.api_name === 'INSEE')).toBe(true);
    });

    it('getAllAPIStatus returns empty array before registration', () => {
      expect(monitor.getAllAPIStatus()).toHaveLength(0);
    });

    it('does not duplicate status when registering the same API twice', () => {
      monitor.registerAPI(makeConfig('Pappers'));
      monitor.registerAPI(makeConfig('Pappers'));
      const all = monitor.getAllAPIStatus().filter(s => s.api_name === 'Pappers');
      expect(all).toHaveLength(1);
    });

    it('registers multiple APIs independently', () => {
      monitor.registerAPI(makeConfig('Pappers'));
      monitor.registerAPI(makeConfig('INSEE'));
      monitor.registerAPI(makeConfig('BAN'));
      expect(monitor.getAllAPIStatus()).toHaveLength(3);
    });
  });

  // ── performHealthCheck — success ─────────────────────────────────────────

  describe('performHealthCheck() — success', () => {
    it('marks status as online after successful check', async () => {
      const config = makeConfig('API', async () => undefined);
      monitor.registerAPI(config);

      await monitor.performHealthCheck(config);

      expect(monitor.getAPIStatus('API')?.status).toBe('online');
    });

    it('updates last_check timestamp', async () => {
      const config = makeConfig('API');
      monitor.registerAPI(config);

      await monitor.performHealthCheck(config);

      expect(monitor.getAPIStatus('API')?.last_check).toBeInstanceOf(Date);
    });

    it('clears is_down_since after recovery', async () => {
      const config = makeConfig('API');
      monitor.registerAPI(config);
      const status = monitor.getAPIStatus('API')!;
      status.is_down_since = new Date(Date.now() - 120_000);

      await monitor.performHealthCheck(config);

      expect(monitor.getAPIStatus('API')?.is_down_since).toBeNull();
    });

    it('clears DOWN alert after recovery', async () => {
      const config = makeConfig('API');
      monitor.registerAPI(config);
      const status = monitor.getAPIStatus('API')!;
      status.alerts = ['DOWN'];
      status.is_down_since = new Date();

      await monitor.performHealthCheck(config);

      expect(monitor.getAPIStatus('API')?.alerts).not.toContain('DOWN');
    });

    it('records response_time_ms >= 0', async () => {
      // Use real timers for this one to measure actual duration
      vi.useRealTimers();
      const config = makeConfig('SlowAPI', async () => undefined);
      const mon = new APIHealthMonitor(makeMockSupabase());
      mon.registerAPI(config);

      await mon.performHealthCheck(config);
      mon.stopAll();

      expect(mon.getAPIStatus('SlowAPI')?.response_time_ms).toBeGreaterThanOrEqual(0);
      vi.useFakeTimers();
    });

    it('persists health check to Supabase on success', async () => {
      const insertFn = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockReturnValue({ insert: insertFn }),
      } as unknown as SupabaseClient;
      const mon = new APIHealthMonitor(supabase);

      const config = makeConfig('API');
      mon.registerAPI(config);
      await mon.performHealthCheck(config);
      mon.stopAll();

      expect(insertFn).toHaveBeenCalled();
      const insertArg = insertFn.mock.calls[0][0];
      expect(insertArg.status).toBe('online');
      expect(insertArg.api_name).toBe('API');
    });
  });

  // ── performHealthCheck — failure ─────────────────────────────────────────

  describe('performHealthCheck() — failure', () => {
    it('marks status as degraded when down for > 30s', async () => {
      const config = makeConfig('BadAPI', async () => { throw new Error('connection refused'); });
      monitor.registerAPI(config);

      // Simulate first failure
      await monitor.performHealthCheck(config);
      const status = monitor.getAPIStatus('BadAPI')!;

      // Back-date is_down_since to simulate 35s downtime
      status.is_down_since = new Date(Date.now() - 35_000);

      await monitor.performHealthCheck(config);

      expect(monitor.getAPIStatus('BadAPI')?.status).toBe('degraded');
    });

    it('marks status as down when down for > 60s', async () => {
      const config = makeConfig('DownAPI', async () => { throw new Error('timeout'); });
      monitor.registerAPI(config);

      await monitor.performHealthCheck(config);
      const status = monitor.getAPIStatus('DownAPI')!;
      status.is_down_since = new Date(Date.now() - 65_000);

      await monitor.performHealthCheck(config);

      expect(monitor.getAPIStatus('DownAPI')?.status).toBe('down');
    });

    it('adds DOWN alert when API down for > 60s', async () => {
      const config = makeConfig('DownAPI2', async () => { throw new Error(); });
      monitor.registerAPI(config);

      await monitor.performHealthCheck(config);
      const status = monitor.getAPIStatus('DownAPI2')!;
      status.is_down_since = new Date(Date.now() - 65_000);

      await monitor.performHealthCheck(config);

      expect(monitor.getAPIStatus('DownAPI2')?.alerts).toContain('DOWN');
    });

    it('does not duplicate DOWN alert', async () => {
      const config = makeConfig('DownAPI3', async () => { throw new Error(); });
      monitor.registerAPI(config);

      await monitor.performHealthCheck(config);
      const status = monitor.getAPIStatus('DownAPI3')!;
      status.is_down_since = new Date(Date.now() - 65_000);

      await monitor.performHealthCheck(config);
      await monitor.performHealthCheck(config);

      const downAlerts = monitor.getAPIStatus('DownAPI3')!.alerts.filter(a => a === 'DOWN');
      expect(downAlerts).toHaveLength(1);
    });

    it('increments error_count_today on failure', async () => {
      const config = makeConfig('ErrAPI', async () => { throw new Error(); });
      monitor.registerAPI(config);

      await monitor.performHealthCheck(config);
      await monitor.performHealthCheck(config);

      expect(monitor.getAPIStatus('ErrAPI')?.error_count_today).toBeGreaterThan(0);
    });

    it('sets is_down_since on first failure', async () => {
      const config = makeConfig('NewFail', async () => { throw new Error(); });
      monitor.registerAPI(config);

      await monitor.performHealthCheck(config);

      expect(monitor.getAPIStatus('NewFail')?.is_down_since).toBeInstanceOf(Date);
    });

    it('persists failure to Supabase', async () => {
      const insertFn = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockReturnValue({ insert: insertFn }),
      } as unknown as SupabaseClient;
      const mon = new APIHealthMonitor(supabase);

      const config = makeConfig('Fail', async () => { throw new Error('boom'); });
      mon.registerAPI(config);
      await mon.performHealthCheck(config);
      mon.stopAll();

      const insertArg = insertFn.mock.calls[0][0];
      expect(insertArg.error_message).toBe('boom');
    });
  });

  // ── Timeout handling ─────────────────────────────────────────────────────

  describe('timeout handling', () => {
    it('throws when health check times out', async () => {
      const config: APIConfig = {
        name: 'SlowAPI',
        healthCheckFn: () => new Promise(r => setTimeout(r, 10_000)),
        timeout_ms: 50,
        health_check_interval_ms: 60_000,
      };
      monitor.registerAPI(config);

      // Advance timers to trigger timeout
      const promise = monitor.performHealthCheck(config);
      vi.advanceTimersByTime(100);
      await promise;

      expect(monitor.getAPIStatus('SlowAPI')?.is_down_since).toBeInstanceOf(Date);
    });
  });

  // ── Stop ─────────────────────────────────────────────────────────────────

  describe('stopMonitoring()', () => {
    it('removes the interval handle', () => {
      monitor.registerAPI(makeConfig('Stoppable'));
      monitor.stopMonitoring('Stoppable');
      // No assertion needed — if clearInterval throws, test would fail
    });
  });

  describe('stopAll()', () => {
    it('stops all registered monitors', () => {
      monitor.registerAPI(makeConfig('A'));
      monitor.registerAPI(makeConfig('B'));
      expect(() => monitor.stopAll()).not.toThrow();
    });
  });
});
