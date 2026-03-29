import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BenchmarkEngine } from '../BenchmarkEngine.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Mock Supabase ─────────────────────────────────────────────────────────────

function makeMockSupabase(prices: number[]) {
  const queryChain = {
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: prices.map(p => ({ montant_ht: p })),
      error: null,
    }),
  };
  return { from: vi.fn().mockReturnValue(queryChain) } as unknown as SupabaseClient;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BenchmarkEngine', () => {
  describe('compareQuote()', () => {
    it('returns empty result when no comparable quotes exist', async () => {
      const engine = new BenchmarkEngine(makeMockSupabase([]));
      const result = await engine.compareQuote(
        { montant_ht: 50_000 },
        { type: 'piscine', region: 'IDF' },
        'REGIONAL'
      );

      expect(result.sample_size).toBe(0);
      expect(result.percentile).toBeNull();
      expect(result.market_avg).toBeNull();
      expect(result.recommendation).toMatch(/insufficient/i);
    });

    it('returns empty result when project type is missing', async () => {
      const engine = new BenchmarkEngine(makeMockSupabase([10000, 20000, 30000]));
      const result = await engine.compareQuote(
        { montant_ht: 15000 },
        {}
      );
      expect(result.sample_size).toBe(0);
    });

    it('computes correct percentile', async () => {
      // 10 prices: [10k, 20k, 30k, 40k, 50k, 60k, 70k, 80k, 90k, 100k]
      const prices = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => p * 1000);
      const engine = new BenchmarkEngine(makeMockSupabase(prices));

      // yourPrice = 50k → 5 prices are ≤ 50k → percentile = 50%
      const result = await engine.compareQuote(
        { montant_ht: 50_000 },
        { type: 'renovation', region: 'IDF' },
        'NATIONAL'
      );

      expect(result.sample_size).toBe(10);
      expect(result.percentile).toBe(50);
      expect(result.your_price).toBe(50_000);
      expect(result.market_avg).toBe(55_000);
    });

    it('computes market statistics correctly', async () => {
      const prices = [10_000, 20_000, 30_000, 40_000, 50_000];
      const engine = new BenchmarkEngine(makeMockSupabase(prices));

      const result = await engine.compareQuote(
        { montant_ht: 25_000 },
        { type: 'toiture' },
        'NATIONAL'
      );

      expect(result.market_min).toBe(10_000);
      expect(result.market_max).toBe(50_000);
      expect(result.market_avg).toBe(30_000);
      expect(result.market_median).toBe(30_000); // middle of 5 sorted values
    });

    it('recommendation is competitive for bottom 25%', async () => {
      const prices = Array.from({ length: 100 }, (_, i) => (i + 1) * 1000);
      const engine = new BenchmarkEngine(makeMockSupabase(prices));

      const result = await engine.compareQuote(
        { montant_ht: 5_000 }, // bottom 5%
        { type: 'isolation' },
        'NATIONAL'
      );

      expect(result.recommendation).toMatch(/bas/i);
    });

    it('recommendation is premium for top 25%', async () => {
      const prices = Array.from({ length: 100 }, (_, i) => (i + 1) * 1000);
      const engine = new BenchmarkEngine(makeMockSupabase(prices));

      const result = await engine.compareQuote(
        { montant_ht: 90_000 }, // top 10%
        { type: 'isolation' },
        'NATIONAL'
      );

      expect(result.recommendation).toMatch(/élevé|premium/i);
    });

    it('counts anonymized competitors correctly', async () => {
      const prices = [10_000, 20_000, 30_000, 40_000, 50_000];
      const engine = new BenchmarkEngine(makeMockSupabase(prices));

      // yourPrice = 30k, avg = 30k, band = 3k → similar: [27k-33k] → just 30k itself
      const result = await engine.compareQuote(
        { montant_ht: 30_000 },
        { type: 'piscine' },
        'NATIONAL'
      );

      const { cheaper_count, expensive_count } = result.anonymized_competitors;
      expect(cheaper_count + expensive_count).toBeLessThan(prices.length);
    });

    it('handles null montant_ht gracefully', async () => {
      const engine = new BenchmarkEngine(makeMockSupabase([10_000, 20_000, 30_000, 40_000]));
      const result = await engine.compareQuote({}, { type: 'renovation' }, 'NATIONAL');

      expect(result.your_price).toBeNull();
      expect(result.percentile).toBeNull();
    });
  });
});
