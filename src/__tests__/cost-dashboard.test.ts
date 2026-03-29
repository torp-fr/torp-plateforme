/**
 * Phase 6-P4 — CostDashboardPage unit tests.
 *
 * Tests cover pure logic extracted from CostDashboardPage:
 * 1. Currency conversion (usdToTarget)
 * 2. Period cutoff (periodCutoff)
 * 3. Cost aggregation (aggregateCosts)
 * 4. CSV row formatting (formatCSVRows)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// ── Types ─────────────────────────────────────────────────────────────────────

type Currency = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CHF';
type Period   = 'today' | 'month' | 'all_time';

interface RawCostRow {
  api_name: string;
  cost_usd: number;
}

interface CostBreakdown {
  api_name: string;
  cost_usd: number;
  cost_in_currency: number;
  percentage: number;
}

// ── Pure helpers (mirrors CostDashboardPage.tsx) ──────────────────────────────

const USD_TO_EUR = 1 / 1.08;
const EUR_TO: Record<Currency, number> = {
  EUR: 1.00,
  USD: 1 / USD_TO_EUR,
  GBP: 1 / 0.86,
  JPY: 164,
  CHF: 1 / 0.97,
};

function usdToTarget(costUsd: number, currency: Currency): number {
  return costUsd * USD_TO_EUR * EUR_TO[currency];
}

function periodCutoff(period: Period, now: Date = new Date()): Date {
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(0);
}

function aggregateCosts(rows: RawCostRow[], currency: Currency): {
  breakdowns: CostBreakdown[];
  totalUsd: number;
} {
  const byCost: Record<string, number> = {};
  for (const row of rows) {
    byCost[row.api_name] = (byCost[row.api_name] ?? 0) + row.cost_usd;
  }

  const totalUsd = Object.values(byCost).reduce((s, c) => s + c, 0);

  const breakdowns: CostBreakdown[] = Object.entries(byCost)
    .map(([api_name, cost_usd]) => ({
      api_name,
      cost_usd,
      cost_in_currency: usdToTarget(cost_usd, currency),
      percentage: totalUsd > 0 ? (cost_usd / totalUsd) * 100 : 0,
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd);

  return { breakdowns, totalUsd };
}

function formatCSVRows(breakdowns: CostBreakdown[], currency: Currency): string {
  const header = 'API,USD,Amount,Percentage\n';
  const rows = breakdowns.map(b =>
    `${b.api_name},${b.cost_usd.toFixed(6)},${b.cost_in_currency.toFixed(6)},${b.percentage.toFixed(2)}`
  ).join('\n');
  return header + rows;
}

// ── Suite 1: currency conversion ──────────────────────────────────────────────

describe('usdToTarget — currency conversion', () => {
  it('USD stays the same (no double conversion)', () => {
    // 1 USD → EUR → USD = 1 USD (within floating point tolerance)
    const result = usdToTarget(1.0, 'USD');
    expect(result).toBeCloseTo(1.0, 2);
  });

  it('1 USD to EUR uses approximate rate ~0.926', () => {
    const eur = usdToTarget(1.0, 'EUR');
    // 1 / 1.08 ≈ 0.9259
    expect(eur).toBeCloseTo(0.9259, 3);
  });

  it('larger amount converts linearly', () => {
    const a = usdToTarget(1.0, 'EUR');
    const b = usdToTarget(100.0, 'EUR');
    expect(b).toBeCloseTo(a * 100, 4);
  });

  it('zero cost stays zero in any currency', () => {
    for (const c of ['EUR', 'USD', 'GBP', 'JPY', 'CHF'] as Currency[]) {
      expect(usdToTarget(0, c)).toBe(0);
    }
  });

  it('JPY has higher absolute value per USD than EUR', () => {
    const eur = usdToTarget(1.0, 'EUR');
    const jpy = usdToTarget(1.0, 'JPY');
    expect(jpy).toBeGreaterThan(eur);
  });
});

// ── Suite 2: period cutoff ────────────────────────────────────────────────────

describe('periodCutoff — date boundary', () => {
  const fixedNow = new Date('2026-03-29T14:35:00Z');

  it('today returns midnight of the same day', () => {
    const cutoff = periodCutoff('today', fixedNow);
    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(2);  // March = 2 (0-indexed)
    expect(cutoff.getDate()).toBe(29);
    expect(cutoff.getHours()).toBe(0);
    expect(cutoff.getMinutes()).toBe(0);
  });

  it('month returns the 1st of the current month at midnight', () => {
    const cutoff = periodCutoff('month', fixedNow);
    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(2);
    expect(cutoff.getDate()).toBe(1);
    expect(cutoff.getHours()).toBe(0);
  });

  it('all_time returns epoch (Jan 1 1970)', () => {
    const cutoff = periodCutoff('all_time', fixedNow);
    expect(cutoff.getTime()).toBe(0);
  });

  it('today cutoff is always after month cutoff', () => {
    const today = periodCutoff('today', fixedNow);
    const month = periodCutoff('month', fixedNow);
    expect(today.getTime()).toBeGreaterThanOrEqual(month.getTime());
  });
});

// ── Suite 3: cost aggregation ─────────────────────────────────────────────────

describe('aggregateCosts — grouping and sorting', () => {
  it('returns empty breakdowns for empty input', () => {
    const { breakdowns, totalUsd } = aggregateCosts([], 'EUR');
    expect(breakdowns).toHaveLength(0);
    expect(totalUsd).toBe(0);
  });

  it('sums multiple rows for the same API', () => {
    const rows: RawCostRow[] = [
      { api_name: 'claude', cost_usd: 0.01 },
      { api_name: 'claude', cost_usd: 0.02 },
      { api_name: 'claude', cost_usd: 0.03 },
    ];
    const { breakdowns, totalUsd } = aggregateCosts(rows, 'EUR');
    expect(breakdowns).toHaveLength(1);
    expect(breakdowns[0].cost_usd).toBeCloseTo(0.06, 6);
    expect(totalUsd).toBeCloseTo(0.06, 6);
  });

  it('sorts by cost descending', () => {
    const rows: RawCostRow[] = [
      { api_name: 'cheap-api', cost_usd: 0.001 },
      { api_name: 'expensive-api', cost_usd: 0.5 },
      { api_name: 'mid-api', cost_usd: 0.05 },
    ];
    const { breakdowns } = aggregateCosts(rows, 'EUR');
    expect(breakdowns[0].api_name).toBe('expensive-api');
    expect(breakdowns[1].api_name).toBe('mid-api');
    expect(breakdowns[2].api_name).toBe('cheap-api');
  });

  it('percentages sum to 100 (within floating point tolerance)', () => {
    const rows: RawCostRow[] = [
      { api_name: 'a', cost_usd: 0.1 },
      { api_name: 'b', cost_usd: 0.3 },
      { api_name: 'c', cost_usd: 0.6 },
    ];
    const { breakdowns } = aggregateCosts(rows, 'EUR');
    const total = breakdowns.reduce((s, b) => s + b.percentage, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('percentage is 0 when total is 0 (no division by zero)', () => {
    // Edge: all costs are 0 (e.g., free tier)
    const rows: RawCostRow[] = [
      { api_name: 'free-api', cost_usd: 0 },
    ];
    const { breakdowns } = aggregateCosts(rows, 'EUR');
    expect(breakdowns[0].percentage).toBe(0);
  });

  it('cost_in_currency is correctly converted', () => {
    const rows: RawCostRow[] = [
      { api_name: 'openai', cost_usd: 1.0 },
    ];
    const { breakdowns } = aggregateCosts(rows, 'EUR');
    expect(breakdowns[0].cost_in_currency).toBeCloseTo(usdToTarget(1.0, 'EUR'), 6);
  });
});

// ── Suite 4: CSV formatting ───────────────────────────────────────────────────

describe('formatCSVRows — CSV export format', () => {
  const sampleBreakdowns: CostBreakdown[] = [
    { api_name: 'claude', cost_usd: 0.05, cost_in_currency: 0.0463, percentage: 83.33 },
    { api_name: 'openai', cost_usd: 0.01, cost_in_currency: 0.0093, percentage: 16.67 },
  ];

  it('starts with the correct header row', () => {
    const csv = formatCSVRows(sampleBreakdowns, 'EUR');
    expect(csv.startsWith('API,USD,Amount,Percentage\n')).toBe(true);
  });

  it('contains one data row per API', () => {
    const csv = formatCSVRows(sampleBreakdowns, 'EUR');
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('data row includes api_name as first field', () => {
    const csv = formatCSVRows(sampleBreakdowns, 'EUR');
    expect(csv).toContain('claude,');
    expect(csv).toContain('openai,');
  });

  it('returns only header when breakdowns are empty', () => {
    const csv = formatCSVRows([], 'EUR');
    expect(csv).toBe('API,USD,Amount,Percentage\n');
  });

  it('formats cost_usd to 6 decimal places', () => {
    const csv = formatCSVRows(sampleBreakdowns, 'EUR');
    expect(csv).toContain('0.050000');
    expect(csv).toContain('0.010000');
  });
});
