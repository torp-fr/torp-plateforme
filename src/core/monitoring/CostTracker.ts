// ─────────────────────────────────────────────────────────────────────────────
// CostTracker — Track API spend across all external sources.
// Multi-devise: EUR, USD, GBP, JPY, CHF.
// Per-API breakdown + spend alerts at 80%, 95%, 100% of budget.
//
// Writes to `api_costs` table. Reads from `api_costs` + `api_pricing_config`.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface APIPricing {
  api_name: string;
  price_per_1k_tokens_usd?: number;
  price_per_image_usd?: number;
  price_per_request_usd?: number;
  currency: string;
}

export interface CostSummary {
  period: 'today' | 'month' | 'all_time';
  currency: string;
  total_cost: number;
  total_cost_usd: number;
  cost_by_api: CostBreakdown[];
  top_5_expensive_apis: CostBreakdown[];
}

export interface CostBreakdown {
  api_name: string;
  cost_usd: number;
  cost_in_target_currency: number;
  percentage: number;
}

export interface APIDetailCost {
  api_name: string;
  currency: string;
  total_cost: number;
  total_cost_usd: number;
  daily_costs: DailyCost[];
  trend: 'up' | 'down' | 'flat';
}

export interface DailyCost {
  date: string;
  cost_usd: number;
  cost_in_target_currency: number;
}

export interface SpendAlert {
  level: 'warning' | 'critical' | 'exceeded';
  message: string;
  percentage_used: number;
  timestamp: Date;
}

export interface CallMetrics {
  tokens_used?: number;
  images_processed?: number;
  requests_count?: number;
  duration_ms?: number;
}

// EUR/1 unit = exchange rate (base: EUR)
export const EXCHANGE_RATES: Record<string, number> = {
  EUR: 1.00,
  USD: 1.08,
  GBP: 0.86,
  JPY: 161.5,
  CHF: 0.96,
};

// ── CostTracker ───────────────────────────────────────────────────────────────

export class CostTracker {
  private pricingConfig: Map<string, APIPricing> = new Map();

  constructor(private readonly supabase: SupabaseClient) {}

  /** Load pricing config from DB into memory cache. */
  async initialize(): Promise<void> {
    const { data, error } = await this.supabase
      .from('api_pricing_config')
      .select('*');

    if (error) {
      console.warn('[CostTracker] Failed to load pricing config:', error.message);
      return;
    }

    (data ?? []).forEach((row: APIPricing) => {
      this.pricingConfig.set(row.api_name, row);
    });
  }

  /**
   * Record an API call and compute its cost.
   * Cost is stored in USD; converted to target currency on read.
   */
  async recordAPICall(apiName: string, metrics: CallMetrics): Promise<void> {
    const pricing = this.pricingConfig.get(apiName);
    if (!pricing) {
      console.warn(`[CostTracker] No pricing config for ${apiName} — cost not recorded`);
      return;
    }

    let costUsd = 0;

    if (metrics.tokens_used != null && pricing.price_per_1k_tokens_usd != null) {
      costUsd += (metrics.tokens_used / 1_000) * pricing.price_per_1k_tokens_usd;
    }
    if (metrics.images_processed != null && pricing.price_per_image_usd != null) {
      costUsd += metrics.images_processed * pricing.price_per_image_usd;
    }
    if (metrics.requests_count != null && pricing.price_per_request_usd != null) {
      costUsd += metrics.requests_count * pricing.price_per_request_usd;
    }

    await this.supabase.from('api_costs').insert({
      api_name: apiName,
      cost_usd: costUsd,
      metrics,
      recorded_at: new Date().toISOString(),
    });
  }

  /** Get cost summary for a period, in the requested currency. */
  async getCostSummary(
    period: 'today' | 'month' | 'all_time',
    currency: string = 'EUR'
  ): Promise<CostSummary> {
    const startDate = this.periodStartDate(period);

    const { data: costs } = await this.supabase
      .from('api_costs')
      .select('api_name, cost_usd')
      .gte('recorded_at', startDate.toISOString());

    if (!costs || costs.length === 0) {
      return {
        period,
        currency,
        total_cost: 0,
        total_cost_usd: 0,
        cost_by_api: [],
        top_5_expensive_apis: [],
      };
    }

    const rate = this.getExchangeRate(currency);
    const costByApi = new Map<string, number>();
    let totalUsd = 0;

    for (const record of costs as Array<{ api_name: string; cost_usd: number }>) {
      costByApi.set(record.api_name, (costByApi.get(record.api_name) ?? 0) + record.cost_usd);
      totalUsd += record.cost_usd;
    }

    const breakdown: CostBreakdown[] = Array.from(costByApi.entries())
      .map(([apiName, costUsd]) => ({
        api_name: apiName,
        cost_usd: costUsd,
        cost_in_target_currency: costUsd * rate,
        percentage: totalUsd > 0 ? (costUsd / totalUsd) * 100 : 0,
      }))
      .sort((a, b) => b.cost_usd - a.cost_usd);

    return {
      period,
      currency,
      total_cost: totalUsd * rate,
      total_cost_usd: totalUsd,
      cost_by_api: breakdown,
      top_5_expensive_apis: breakdown.slice(0, 5),
    };
  }

  /** Get daily cost breakdown for a specific API over the last 30 entries. */
  async getAPIDetail(apiName: string, currency: string = 'EUR'): Promise<APIDetailCost> {
    const { data: costs } = await this.supabase
      .from('api_costs')
      .select('cost_usd, recorded_at')
      .eq('api_name', apiName)
      .order('recorded_at', { ascending: false })
      .limit(30);

    if (!costs || costs.length === 0) {
      return {
        api_name: apiName,
        currency,
        total_cost: 0,
        total_cost_usd: 0,
        daily_costs: [],
        trend: 'flat',
      };
    }

    const rate = this.getExchangeRate(currency);
    const dailyMap = new Map<string, number>();

    for (const record of costs as Array<{ cost_usd: number; recorded_at: string }>) {
      const day = record.recorded_at.substring(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + record.cost_usd);
    }

    // Chronological order
    const daily: DailyCost[] = Array.from(dailyMap.entries())
      .map(([date, costUsd]) => ({
        date,
        cost_usd: costUsd,
        cost_in_target_currency: costUsd * rate,
      }))
      .reverse();

    const totalUsd = daily.reduce((sum, d) => sum + d.cost_usd, 0);

    return {
      api_name: apiName,
      currency,
      total_cost: totalUsd * rate,
      total_cost_usd: totalUsd,
      daily_costs: daily,
      trend: this.calculateTrend(daily),
    };
  }

  /** Returns alerts if monthly spend crosses 80%, 95%, or 100% of budget. */
  async checkAlerts(monthlyBudget: number, currency: string = 'EUR'): Promise<SpendAlert[]> {
    const summary = await this.getCostSummary('month', currency);
    const alerts: SpendAlert[] = [];

    const thresholds: Array<{ pct: number; level: SpendAlert['level']; label: string }> = [
      { pct: 0.80, level: 'warning',  label: '80%'  },
      { pct: 0.95, level: 'critical', label: '95%'  },
      { pct: 1.00, level: 'exceeded', label: '100%' },
    ];

    for (const t of thresholds) {
      if (summary.total_cost >= monthlyBudget * t.pct) {
        alerts.push({
          level: t.level,
          message: `${t.label} of monthly budget: ${summary.total_cost.toFixed(2)} ${currency} / ${monthlyBudget} ${currency}`,
          percentage_used: (summary.total_cost / monthlyBudget) * 100,
          timestamp: new Date(),
        });
      }
    }

    return alerts;
  }

  /** Update pricing config in cache and DB. */
  async updatePricing(config: APIPricing): Promise<void> {
    this.pricingConfig.set(config.api_name, config);

    await this.supabase.from('api_pricing_config').upsert({
      api_name: config.api_name,
      price_per_1k_tokens_usd: config.price_per_1k_tokens_usd ?? null,
      price_per_image_usd: config.price_per_image_usd ?? null,
      price_per_request_usd: config.price_per_request_usd ?? null,
      currency: config.currency,
      updated_at: new Date().toISOString(),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private periodStartDate(period: 'today' | 'month' | 'all_time'): Date {
    const now = new Date();
    if (period === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (period === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return new Date('2026-01-01');
  }

  getExchangeRate(currency: string): number {
    return EXCHANGE_RATES[currency] ?? 1.0;
  }

  calculateTrend(daily: DailyCost[]): 'up' | 'down' | 'flat' {
    if (daily.length < 2) return 'flat';
    const recent = daily.slice(-7).map(d => d.cost_usd);
    const older  = daily.slice(-14, -7).map(d => d.cost_usd);
    if (older.length === 0) return 'flat';
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg  = older.reduce((a, b) => a + b, 0) / older.length;
    if (olderAvg === 0) return 'flat';
    if (recentAvg > olderAvg * 1.1) return 'up';
    if (recentAvg < olderAvg * 0.9) return 'down';
    return 'flat';
  }
}
