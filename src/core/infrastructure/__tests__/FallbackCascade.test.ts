import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FallbackCascade, type FallbackLayer } from '../FallbackCascade.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLayer<T>(
  name: string,
  execute: () => Promise<T>,
  opts?: { isRetryable?: (e: Error) => boolean; timeout_ms?: number }
): FallbackLayer<T> {
  return {
    name,
    priority: 0,
    execute,
    timeout_ms: opts?.timeout_ms ?? 5_000,
    isRetryable: opts?.isRetryable ?? (() => false),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FallbackCascade', () => {
  let cascade: FallbackCascade;

  beforeEach(() => {
    cascade = new FallbackCascade();
  });

  // ── Core cascade logic ────────────────────────────────────────────────────

  describe('executeWithFallback()', () => {
    it('returns data from first layer when it succeeds', async () => {
      const layers = [
        makeLayer('Primary', async () => ({ name: 'pappers' })),
        makeLayer('Fallback', async () => ({ name: 'insee' })),
      ];

      const result = await cascade.executeWithFallback('req-1', layers);

      expect(result.status).toBe('success');
      expect(result.data).toEqual({ name: 'pappers' });
      expect(result.layer_used).toBe('Primary');
    });

    it('falls through to second layer when first fails', async () => {
      const layers = [
        makeLayer('Primary', async () => { throw new Error('Primary down'); }),
        makeLayer('Fallback1', async () => 'fallback-data'),
      ];

      const result = await cascade.executeWithFallback('req-2', layers);

      expect(result.status).toBe('success');
      expect(result.data).toBe('fallback-data');
      expect(result.layer_used).toBe('Fallback1');
    });

    it('falls through to third layer when first two fail', async () => {
      const layers = [
        makeLayer('Primary',   async () => { throw new Error('P1 down'); }),
        makeLayer('Fallback1', async () => { throw new Error('P2 down'); }),
        makeLayer('Fallback2', async () => 'layer-3'),
      ];

      const result = await cascade.executeWithFallback('req-3', layers);

      expect(result.status).toBe('success');
      expect(result.data).toBe('layer-3');
      expect(result.layer_used).toBe('Fallback2');
    });

    it('returns cascaded_exhausted when all layers fail', async () => {
      const layers = [
        makeLayer('L1', async () => { throw new Error('L1'); }),
        makeLayer('L2', async () => { throw new Error('L2'); }),
      ];

      const result = await cascade.executeWithFallback('req-4', layers);

      expect(result.status).toBe('cascaded_exhausted');
      expect(result.data).toBeNull();
    });

    it('health_status=online when layer 0 succeeds', async () => {
      const result = await cascade.executeWithFallback('req-a', [
        makeLayer('Primary', async () => 'ok'),
      ]);
      expect(result.health_status).toBe('online');
    });

    it('health_status=degraded when layer 1 succeeds', async () => {
      const layers = [
        makeLayer('L0', async () => { throw new Error(); }),
        makeLayer('L1', async () => 'ok'),
      ];
      const result = await cascade.executeWithFallback('req-b', layers);
      expect(result.health_status).toBe('degraded');
    });

    it('health_status=severely_degraded when layer 2 succeeds', async () => {
      const layers = [
        makeLayer('L0', async () => { throw new Error(); }),
        makeLayer('L1', async () => { throw new Error(); }),
        makeLayer('L2', async () => 'ok'),
      ];
      const result = await cascade.executeWithFallback('req-c', layers);
      expect(result.health_status).toBe('severely_degraded');
    });

    it('health_status=all_apis_down when all layers fail', async () => {
      const result = await cascade.executeWithFallback('req-d', [
        makeLayer('L0', async () => { throw new Error(); }),
      ]);
      expect(result.health_status).toBe('all_apis_down');
    });

    it('records timeline events for each layer attempt', async () => {
      const layers = [
        makeLayer('Primary',   async () => { throw new Error('down'); }),
        makeLayer('Fallback1', async () => 'ok'),
      ];

      const result = await cascade.executeWithFallback('req-e', layers);

      const layerNames = result.timeline.map(e => e.layer_name);
      expect(layerNames).toContain('Primary');
      expect(layerNames).toContain('Fallback1');
    });

    it('timeline contains failed event for failing layer', async () => {
      const layers = [
        makeLayer('Bad', async () => { throw new Error('boom'); }),
        makeLayer('Good', async () => 'ok'),
      ];

      const result = await cascade.executeWithFallback('req-f', layers);

      const badEvent = result.timeline.find(e => e.layer_name === 'Bad' && e.status === 'failed');
      expect(badEvent).toBeDefined();
      expect(badEvent?.error).toBe('boom');
    });

    it('timeline contains success event for successful layer', async () => {
      const result = await cascade.executeWithFallback('req-g', [
        makeLayer('OK', async () => 'win'),
      ]);

      const ok = result.timeline.find(e => e.layer_name === 'OK' && e.status === 'success');
      expect(ok).toBeDefined();
    });

    it('adds QUEUE_FOR_RETRY event when all layers fail', async () => {
      const result = await cascade.executeWithFallback('req-h', [
        makeLayer('L0', async () => { throw new Error(); }),
      ]);

      const queued = result.timeline.find(e => e.status === 'queued');
      expect(queued).toBeDefined();
    });

    it('sets queued_request_id when cascade is exhausted', async () => {
      const result = await cascade.executeWithFallback('req-i', [
        makeLayer('L0', async () => { throw new Error(); }),
      ]);

      expect(result.queued_request_id).toBe('req-i');
    });

    it('includes duration_ms in result', async () => {
      const result = await cascade.executeWithFallback('req-j', [
        makeLayer('L0', async () => 'ok'),
      ]);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('passes context to execute function', async () => {
      const ctx = { entityId: 'siret-123', entityType: 'enterprise' };
      const received: unknown[] = [];

      const layers = [makeLayer('L0', async (c) => { received.push(c); return 'ok'; })];
      await cascade.executeWithFallback('req-k', layers, ctx);

      expect(received[0]).toMatchObject(ctx);
    });

    it('queues request with entity info from context', async () => {
      const ctx = { entityId: 'ENT-001', entityType: 'enterprise' };
      await cascade.executeWithFallback('req-q', [
        makeLayer('L0', async () => { throw new Error(); }),
      ], ctx);

      const queued = cascade.getQueuedRequests().find(r => r.id === 'req-q');
      expect(queued?.entity_id).toBe('ENT-001');
      expect(queued?.entity_type).toBe('enterprise');
    });
  });

  // ── Retry logic ───────────────────────────────────────────────────────────

  describe('executeLayerWithRetry()', () => {
    it('succeeds on first attempt without retrying', async () => {
      const executeFn = vi.fn().mockResolvedValue('data');
      const layer = makeLayer('L', async () => executeFn());

      const result = await cascade.executeLayerWithRetry(layer);

      expect(result).toBe('data');
      expect(executeFn).toHaveBeenCalledOnce();
    });

    it('does not retry non-retryable errors', async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error('permanent'));
      const layer = makeLayer('L', async () => executeFn(), {
        isRetryable: () => false,
      });

      await expect(cascade.executeLayerWithRetry(layer)).rejects.toThrow('permanent');
      expect(executeFn).toHaveBeenCalledOnce();
    });

    it('throws timeout error when execution exceeds timeout', async () => {
      const layer = makeLayer('L', () => new Promise(r => setTimeout(r, 1_000)), {
        timeout_ms: 10,
      });

      await expect(cascade.executeLayerWithRetry(layer)).rejects.toThrow(/Timeout after 10ms/);
    });

    it('succeeds on second attempt after first fails (retryable)', async () => {
      let callCount = 0;
      const layer = makeLayer(
        'L',
        async () => {
          callCount++;
          if (callCount < 2) throw new Error('transient');
          return 'recovered';
        },
        { isRetryable: () => true, timeout_ms: 100 }
      );

      // Stub setTimeout to avoid 2s wait
      vi.useFakeTimers();
      const promise = cascade.executeLayerWithRetry(layer);
      await vi.runAllTimersAsync();
      const result = await promise;
      vi.useRealTimers();

      expect(result).toBe('recovered');
    });
  });

  // ── Queue management ──────────────────────────────────────────────────────

  describe('getQueuedRequests()', () => {
    it('returns empty array initially', () => {
      expect(cascade.getQueuedRequests()).toHaveLength(0);
    });

    it('returns queued requests after cascade exhaustion', async () => {
      await cascade.executeWithFallback('req-1', [
        makeLayer('L0', async () => { throw new Error(); }),
      ]);
      await cascade.executeWithFallback('req-2', [
        makeLayer('L0', async () => { throw new Error(); }),
      ]);

      expect(cascade.getQueuedRequests()).toHaveLength(2);
    });

    it('replaces existing request with same ID', async () => {
      const layer = makeLayer('L0', async () => { throw new Error(); });
      await cascade.executeWithFallback('same-id', [layer]);
      await cascade.executeWithFallback('same-id', [layer]);

      const matching = cascade.getQueuedRequests().filter(r => r.id === 'same-id');
      expect(matching).toHaveLength(1);
    });
  });

  describe('manuallyRetry()', () => {
    it('increments retry_count', async () => {
      await cascade.executeWithFallback('retry-me', [
        makeLayer('L0', async () => { throw new Error(); }),
      ]);

      cascade.manuallyRetry('retry-me');

      const req = cascade.getQueuedRequests().find(r => r.id === 'retry-me');
      expect(req?.retry_count).toBe(1);
    });

    it('sets status to retrying', async () => {
      await cascade.executeWithFallback('retry-me2', [
        makeLayer('L0', async () => { throw new Error(); }),
      ]);

      cascade.manuallyRetry('retry-me2');

      const req = cascade.getQueuedRequests().find(r => r.id === 'retry-me2');
      expect(req?.status).toBe('retrying');
    });

    it('throws for unknown requestId', () => {
      expect(() => cascade.manuallyRetry('does-not-exist')).toThrow('Request not found: does-not-exist');
    });
  });

  describe('resolveRequest()', () => {
    it('sets status to resolved', async () => {
      await cascade.executeWithFallback('to-resolve', [
        makeLayer('L0', async () => { throw new Error(); }),
      ]);

      cascade.resolveRequest('to-resolve');

      const req = cascade.getQueuedRequests().find(r => r.id === 'to-resolve');
      expect(req?.status).toBe('resolved');
    });

    it('throws for unknown requestId', () => {
      expect(() => cascade.resolveRequest('nope')).toThrow('Request not found: nope');
    });
  });
});
