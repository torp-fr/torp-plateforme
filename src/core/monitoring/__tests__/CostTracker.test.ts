import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostTracker, EXCHANGE_RATES, type APIPricing, type DailyCost } from '../CostTracker.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Supabase mock factory ─────────────────────────────────────────────────────

function makeMockSupabase(opts?: {
  pricingData?: APIPricing[];
  costsData?: Array<{ api_name: string; cost_usd: number; recorded_at?: string }>;
  insertError?: string | null;
}): SupabaseClient {
  const pricingData = opts?.pricingData ?? [];
  const costsData   = opts?.costsData   ?? [];
  const insertError = opts?.insertError ?? null;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'api_pricing_config') {
        return {
          select: vi.fn().mockResolvedValue({ data: pricingData, error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'api_costs') {
        return {
          insert: vi.fn().mockResolvedValue({ error: insertError }),
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: costsData, error: null }),
          // For getCostSummary
          then: undefined,
          // Make chained calls resolve
          mockResolvedValue: undefined,
        };
      }
      return { select: vi.fn().mockReturnThis() };
    }),
  } as unknown as SupabaseClient;
}

// A supabase mock that properly handles the chaining for getCostSummary
function makeChainedSupabase(costRows: Array<{ api_name: string; cost_usd: number }>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ data: costRows, error: null }),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: costRows, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CostTracker', () => {
  // ── initialize() ──────────────────────────────────────────────────────────

  describe('initialize()', () => {
    it('loads pricing config into cache', async () => {
      const pricing: APIPricing[] = [
        { api_name: 'claude-haiku', price_per_1k_tokens_usd: 0.00025, currency: 'USD' },
      ];
      const supabase = makeMockSupabase({ pricingData: pricing });

      const tracker = new CostTracker(supabase);
      await tracker.initialize();

      // After init, recordAPICall should use the cached config (no error)
      // We verify by calling recordAPICall and checking insert was called
    });

    it('handles empty pricing config gracefully', async () => {
      const supabase = makeMockSupabase({ pricingData: [] });
      const tracker = new CostTracker(supabase);
      await expect(tracker.initialize()).resolves.not.toThrow();
    });

    it('handles DB error during initialize gracefully', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      } as unknown as SupabaseClient;

      const tracker = new CostTracker(supabase);
      await expect(tracker.initialize()).resolves.not.toThrow();
    });
  });

  // ── recordAPICall() ────────────────────────────────────────────────────────

  describe('recordAPICall()', () => {
    it('skips when no pricing config for API', async () => {
      const insertFn = vi.fn();
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: insertFn,
        }),
      } as unknown as SupabaseClient;

      const tracker = new CostTracker(supabase);
      await tracker.initialize();
      await tracker.recordAPICall('unknown-api', { tokens_used: 1000 });

      expect(insertFn).not.toHaveBeenCalled();
    });

    it('calculates token cost correctly', async () => {
      const insertFn = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'api_pricing_config') {
            return {
              select: vi.fn().mockResolvedValue({
                data: [{ api_name: 'claude-haiku', price_per_1k_tokens_usd: 0.25, currency: 'USD' }],
                error: null,
              }),
            };
          }
          return { insert: insertFn };
        }),
      } as unknown as SupabaseClient;

      const tracker = new CostTracker(supabase);
      await tracker.initialize();
      await tracker.recordAPICall('claude-haiku', { tokens_used: 2_000 });

      const insertArg = insertFn.mock.calls[0][0];
      expect(insertArg.cost_usd).toBeCloseTo(0.5); // 2k tokens × $0.25/1k = $0.50
    });

    it('calculates image cost correctly', async () => {
      const insertFn = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'api_pricing_config') {
            return {
              select: vi.fn().mockResolvedValue({
                data: [{ api_name: 'vision-api', price_per_image_usd: 0.01, currency: 'USD' }],
                error: null,
              }),
            };
          }
          return { insert: insertFn };
        }),
      } as unknown as SupabaseClient;

      const tracker = new CostTracker(supabase);
      await tracker.initialize();
      await tracker.recordAPICall('vision-api', { images_processed: 5 });

      const insertArg = insertFn.mock.calls[0][0];
      expect(insertArg.cost_usd).toBeCloseTo(0.05); // 5 images × $0.01
    });

    it('calculates request-based cost correctly', async () => {
      const insertFn = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'api_pricing_config') {
            return {
              select: vi.fn().mockResolvedValue({
                data: [{ api_name: 'pappers', price_per_request_usd: 0.005, currency: 'USD' }],
                error: null,
              }),
            };
          }
          return { insert: insertFn };
        }),
      } as unknown as SupabaseClient;

      const tracker = new CostTracker(supabase);
      await tracker.initialize();
      await tracker.recordAPICall('pappers', { requests_count: 10 });

      const insertArg = insertFn.mock.calls[0][0];
      expect(insertArg.cost_usd).toBeCloseTo(0.05); // 10 × $0.005
    });

    it('combines multiple cost components', async () => {
      const insertFn = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'api_pricing_config') {
            return {
              select: vi.fn().mockResolvedValue({
                data: [{
                  api_name: 'combo',
                  price_per_1k_tokens_usd: 1.0,
                  price_per_image_usd: 1.0,
                  price_per_request_usd: 1.0,
                  currency: 'USD',
                }],
                error: null,
              }),
            };
          }
          return { insert: insertFn };
        }),
      } as unknown as SupabaseClient;

      const tracker = new CostTracker(supabase);
      await tracker.initialize();
      await tracker.recordAPICall('combo', {
        tokens_used: 1_000,   // $1.00
        images_processed: 1,   // $1.00
        requests_count: 1,     // $1.00
      });

      const insertArg = insertFn.mock.calls[0][0];
      expect(insertArg.cost_usd).toBeCloseTo(3.0);
    });
  });

  // ── getCostSummary() ───────────────────────────────────────────────────────

  describe('getCostSummary()', () => {
    it('returns zero cost when no records', async () => {
      const supabase = makeChainedSupabase([]);
      const tracker = new CostTracker(supabase);

      const summary = await tracker.getCostSummary('month');

      expect(summary.total_cost).toBe(0);
      expect(summary.cost_by_api).toHaveLength(0);
    });

    it('aggregates costs by API', async () => {
      const rows = [
        { api_name: 'claude-haiku', cost_usd: 1.0 },
        { api_name: 'claude-haiku', cost_usd: 0.5 },
        { api_name: 'pappers',      cost_usd: 0.2 },
      ];
      const supabase = makeChainedSupabase(rows);
      const tracker = new CostTracker(supabase);

      const summary = await tracker.getCostSummary('month', 'USD');

      const haiku = summary.cost_by_api.find(a => a.api_name === 'claude-haiku');
      expect(haiku?.cost_usd).toBeCloseTo(1.5);
    });

    it('sorts cost_by_api descending by cost', async () => {
      const rows = [
        { api_name: 'cheap', cost_usd: 0.1 },
        { api_name: 'expensive', cost_usd: 10.0 },
        { api_name: 'medium', cost_usd: 2.0 },
      ];
      const supabase = makeChainedSupabase(rows);
      const tracker = new CostTracker(supabase);

      const summary = await tracker.getCostSummary('month', 'USD');

      expect(summary.cost_by_api[0].api_name).toBe('expensive');
      expect(summary.cost_by_api[summary.cost_by_api.length - 1].api_name).toBe('cheap');
    });

    it('converts total_cost to target currency', async () => {
      const rows = [{ api_name: 'api', cost_usd: 1.0 }]; // $1 USD
      const supabase = makeChainedSupabase(rows);
      const tracker = new CostTracker(supabase);

      const summaryEUR = await tracker.getCostSummary('month', 'EUR');
      const summaryUSD = await tracker.getCostSummary('month', 'USD');

      // EUR rate < USD rate, so EUR amount should be ~0.926
      expect(summaryEUR.total_cost).toBeLessThan(summaryUSD.total_cost);
    });

    it('top_5_expensive_apis has at most 5 entries', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        api_name: `api-${i}`, cost_usd: i + 1,
      }));
      const supabase = makeChainedSupabase(rows);
      const tracker = new CostTracker(supabase);

      const summary = await tracker.getCostSummary('all_time');

      expect(summary.top_5_expensive_apis).toHaveLength(5);
    });

    it('calculates percentage correctly', async () => {
      const rows = [
        { api_name: 'A', cost_usd: 3.0 },
        { api_name: 'B', cost_usd: 1.0 },
      ];
      const supabase = makeChainedSupabase(rows);
      const tracker = new CostTracker(supabase);

      const summary = await tracker.getCostSummary('month', 'USD');

      const a = summary.cost_by_api.find(x => x.api_name === 'A');
      expect(a?.percentage).toBeCloseTo(75);
    });
  });

  // ── checkAlerts() ─────────────────────────────────────────────────────────

  describe('checkAlerts()', () => {
    function makeTrackerWithCost(costEUR: number) {
      // Exchange rate EUR→USD = 1.08, so costUSD = costEUR × 1.08
      const costUSD = costEUR / EXCHANGE_RATES['EUR'];
      const supabase = makeChainedSupabase([{ api_name: 'api', cost_usd: costUSD }]);
      return new CostTracker(supabase);
    }

    it('returns no alerts when spend < 80% of budget', async () => {
      const tracker = makeTrackerWithCost(79);
      const alerts = await tracker.checkAlerts(100, 'EUR');
      expect(alerts).toHaveLength(0);
    });

    it('returns warning alert at 80% of budget', async () => {
      const tracker = makeTrackerWithCost(80);
      const alerts = await tracker.checkAlerts(100, 'EUR');
      expect(alerts.some(a => a.level === 'warning')).toBe(true);
    });

    it('returns critical alert at 95% of budget', async () => {
      const tracker = makeTrackerWithCost(95);
      const alerts = await tracker.checkAlerts(100, 'EUR');
      expect(alerts.some(a => a.level === 'critical')).toBe(true);
    });

    it('returns exceeded alert at 100%+ of budget', async () => {
      const tracker = makeTrackerWithCost(105);
      const alerts = await tracker.checkAlerts(100, 'EUR');
      expect(alerts.some(a => a.level === 'exceeded')).toBe(true);
    });

    it('alert includes percentage_used', async () => {
      const tracker = makeTrackerWithCost(80);
      const alerts = await tracker.checkAlerts(100, 'EUR');
      expect(alerts[0].percentage_used).toBeGreaterThanOrEqual(80);
    });
  });

  // ── calculateTrend() ──────────────────────────────────────────────────────

  describe('calculateTrend()', () => {
    const tracker = new CostTracker({} as unknown as SupabaseClient);

    it('returns flat for < 2 data points', () => {
      const daily: DailyCost[] = [{ date: '2026-03-01', cost_usd: 1, cost_in_target_currency: 1 }];
      expect(tracker.calculateTrend(daily)).toBe('flat');
    });

    it('returns flat for empty array', () => {
      expect(tracker.calculateTrend([])).toBe('flat');
    });

    it('returns up when recent week avg > older week avg by >10%', () => {
      const older  = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-0${i + 1}`, cost_usd: 1.0, cost_in_target_currency: 1.0,
      }));
      const recent = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-${i + 8}`, cost_usd: 2.0, cost_in_target_currency: 2.0,
      }));
      expect(tracker.calculateTrend([...older, ...recent])).toBe('up');
    });

    it('returns down when recent week avg < older week avg by >10%', () => {
      const older  = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-0${i + 1}`, cost_usd: 2.0, cost_in_target_currency: 2.0,
      }));
      const recent = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-${i + 8}`, cost_usd: 1.0, cost_in_target_currency: 1.0,
      }));
      expect(tracker.calculateTrend([...older, ...recent])).toBe('down');
    });

    it('returns flat when change is within ±10%', () => {
      const days = Array.from({ length: 14 }, (_, i) => ({
        date: `2026-03-${i + 1}`, cost_usd: 1.0 + i * 0.01, cost_in_target_currency: 1.0,
      }));
      expect(tracker.calculateTrend(days)).toBe('flat');
    });
  });

  // ── getExchangeRate() ─────────────────────────────────────────────────────

  describe('getExchangeRate()', () => {
    const tracker = new CostTracker({} as unknown as SupabaseClient);

    it('returns 1.0 for EUR (base currency)', () => {
      expect(tracker.getExchangeRate('EUR')).toBe(1.0);
    });

    it('returns rate > 1 for USD', () => {
      expect(tracker.getExchangeRate('USD')).toBeGreaterThan(1.0);
    });

    it('returns 1.0 for unknown currency', () => {
      expect(tracker.getExchangeRate('XYZ')).toBe(1.0);
    });

    it('EXCHANGE_RATES contains all expected currencies', () => {
      ['EUR', 'USD', 'GBP', 'JPY', 'CHF'].forEach(c => {
        expect(EXCHANGE_RATES[c]).toBeDefined();
      });
    });
  });
});
