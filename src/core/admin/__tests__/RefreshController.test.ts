import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RefreshController, REFRESH_INTERVALS } from '../RefreshController.js';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RefreshController', () => {
  let controller: RefreshController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new RefreshController();
  });

  afterEach(() => {
    controller.stopAll();
    vi.useRealTimers();
  });

  // ── registerMonitor() ─────────────────────────────────────────────────────

  describe('registerMonitor()', () => {
    it('creates a config for the monitor', () => {
      controller.registerMonitor('page-1', async () => undefined);
      expect(controller.getConfig('page-1')).toBeDefined();
    });

    it('config has correct interval_ms', () => {
      controller.registerMonitor('page-1', async () => undefined, 15_000);
      expect(controller.getConfig('page-1')?.interval_ms).toBe(15_000);
    });

    it('config is_active=true for interval > 0', () => {
      controller.registerMonitor('page-1', async () => undefined, 30_000);
      expect(controller.getConfig('page-1')?.is_active).toBe(true);
    });

    it('config is_active=false for interval=0', () => {
      controller.registerMonitor('page-1', async () => undefined, 0);
      expect(controller.getConfig('page-1')?.is_active).toBe(false);
    });

    it('last_refresh is null initially', () => {
      controller.registerMonitor('page-1', async () => undefined);
      expect(controller.getConfig('page-1')?.last_refresh).toBeNull();
    });

    it('next_refresh is set when interval > 0', () => {
      controller.registerMonitor('page-1', async () => undefined, 30_000);
      expect(controller.getConfig('page-1')?.next_refresh).toBeInstanceOf(Date);
    });

    it('next_refresh is null when interval = 0', () => {
      controller.registerMonitor('page-1', async () => undefined, 0);
      expect(controller.getConfig('page-1')?.next_refresh).toBeNull();
    });

    it('triggers callback after interval elapses', async () => {
      const cb = vi.fn().mockResolvedValue(undefined);
      controller.registerMonitor('page-1', cb, 1_000);

      await vi.advanceTimersByTimeAsync(1_100);

      expect(cb).toHaveBeenCalled();
    });

    it('triggers callback multiple times', async () => {
      const cb = vi.fn().mockResolvedValue(undefined);
      controller.registerMonitor('page-1', cb, 1_000);

      await vi.advanceTimersByTimeAsync(3_100);

      expect(cb.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── getAllConfigs() ────────────────────────────────────────────────────────

  describe('getAllConfigs()', () => {
    it('returns empty array initially', () => {
      expect(controller.getAllConfigs()).toHaveLength(0);
    });

    it('returns all registered monitors', () => {
      controller.registerMonitor('a', async () => undefined);
      controller.registerMonitor('b', async () => undefined);
      controller.registerMonitor('c', async () => undefined);
      expect(controller.getAllConfigs()).toHaveLength(3);
    });
  });

  // ── updateInterval() ──────────────────────────────────────────────────────

  describe('updateInterval()', () => {
    it('updates interval_ms', () => {
      controller.registerMonitor('page-1', async () => undefined, 30_000);
      controller.updateInterval('page-1', 5_000);
      expect(controller.getConfig('page-1')?.interval_ms).toBe(5_000);
    });

    it('sets is_active=false when intervalMs=0', () => {
      controller.registerMonitor('page-1', async () => undefined, 30_000);
      controller.updateInterval('page-1', 0);
      expect(controller.getConfig('page-1')?.is_active).toBe(false);
    });

    it('sets is_active=true when intervalMs>0', () => {
      controller.registerMonitor('page-1', async () => undefined, 0);
      controller.updateInterval('page-1', 30_000);
      expect(controller.getConfig('page-1')?.is_active).toBe(true);
    });

    it('throws for unknown monitorId', () => {
      expect(() => controller.updateInterval('no-such', 5_000)).toThrow('Monitor not registered: no-such');
    });

    it('sets next_refresh=null when switching to manual', () => {
      controller.registerMonitor('page-1', async () => undefined, 30_000);
      controller.updateInterval('page-1', 0);
      expect(controller.getConfig('page-1')?.next_refresh).toBeNull();
    });

    it('cancels old interval and starts new one', async () => {
      const cb = vi.fn().mockResolvedValue(undefined);
      controller.registerMonitor('page-1', cb, 10_000);

      controller.updateInterval('page-1', 1_000);

      await vi.advanceTimersByTimeAsync(1_100);

      // Should have fired with new 1s interval
      expect(cb).toHaveBeenCalled();
    });
  });

  // ── manualRefresh() ───────────────────────────────────────────────────────

  describe('manualRefresh()', () => {
    it('updates last_refresh', async () => {
      controller.registerMonitor('page-1', async () => undefined);
      await controller.manualRefresh('page-1');
      expect(controller.getConfig('page-1')?.last_refresh).toBeInstanceOf(Date);
    });

    it('calls the refresh callback', async () => {
      const cb = vi.fn().mockResolvedValue(undefined);
      controller.registerMonitor('page-1', cb, 30_000);

      await controller.manualRefresh('page-1');

      expect(cb).toHaveBeenCalledOnce();
    });

    it('throws for unknown monitorId', async () => {
      await expect(controller.manualRefresh('no-such')).rejects.toThrow('Monitor not registered: no-such');
    });

    it('handles callback error gracefully', async () => {
      const cb = vi.fn().mockRejectedValue(new Error('refresh failed'));
      controller.registerMonitor('page-1', cb);

      await expect(controller.manualRefresh('page-1')).resolves.not.toThrow();
    });

    it('updates next_refresh when active', async () => {
      controller.registerMonitor('page-1', async () => undefined, 30_000);
      await controller.manualRefresh('page-1');

      const config = controller.getConfig('page-1');
      expect(config?.next_refresh).toBeInstanceOf(Date);
      expect(config?.next_refresh!.getTime()).toBeGreaterThan(Date.now() - 1);
    });

    it('sets next_refresh=null when not active', async () => {
      controller.registerMonitor('page-1', async () => undefined, 0);
      await controller.manualRefresh('page-1');

      expect(controller.getConfig('page-1')?.next_refresh).toBeNull();
    });
  });

  // ── stopMonitor() ─────────────────────────────────────────────────────────

  describe('stopMonitor()', () => {
    it('sets is_active=false', () => {
      controller.registerMonitor('page-1', async () => undefined, 30_000);
      controller.stopMonitor('page-1');
      expect(controller.getConfig('page-1')?.is_active).toBe(false);
    });

    it('stops the interval — callback not called after stop', async () => {
      const cb = vi.fn().mockResolvedValue(undefined);
      controller.registerMonitor('page-1', cb, 1_000);
      controller.stopMonitor('page-1');

      await vi.advanceTimersByTimeAsync(5_000);

      expect(cb).not.toHaveBeenCalled();
    });

    it('sets next_refresh=null', () => {
      controller.registerMonitor('page-1', async () => undefined, 30_000);
      controller.stopMonitor('page-1');
      expect(controller.getConfig('page-1')?.next_refresh).toBeNull();
    });
  });

  // ── stopAll() ─────────────────────────────────────────────────────────────

  describe('stopAll()', () => {
    it('stops all intervals', async () => {
      const cb = vi.fn().mockResolvedValue(undefined);
      controller.registerMonitor('a', cb, 1_000);
      controller.registerMonitor('b', cb, 1_000);

      controller.stopAll();

      await vi.advanceTimersByTimeAsync(5_000);

      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ── REFRESH_INTERVALS constants ───────────────────────────────────────────

  describe('REFRESH_INTERVALS', () => {
    it('5s = 5000ms', () => {
      expect(REFRESH_INTERVALS['5s']).toBe(5_000);
    });

    it('30s = 30000ms', () => {
      expect(REFRESH_INTERVALS['30s']).toBe(30_000);
    });

    it('1m = 60000ms', () => {
      expect(REFRESH_INTERVALS['1m']).toBe(60_000);
    });

    it('1h = 3600000ms', () => {
      expect(REFRESH_INTERVALS['1h']).toBe(3_600_000);
    });

    it('24h = 86400000ms', () => {
      expect(REFRESH_INTERVALS['24h']).toBe(86_400_000);
    });

    it('OFF = 0', () => {
      expect(REFRESH_INTERVALS['OFF']).toBe(0);
    });

    it('has all expected keys', () => {
      const expected = ['5s', '15s', '30s', '1m', '5m', '20m', '1h', '4h', '12h', '24h', 'OFF'];
      expected.forEach(key => {
        expect(REFRESH_INTERVALS).toHaveProperty(key);
      });
    });
  });
});
