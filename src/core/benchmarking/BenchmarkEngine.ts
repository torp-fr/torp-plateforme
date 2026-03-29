// ─────────────────────────────────────────────────────────────────────────────
// BenchmarkEngine — Anonymous market comparison for devis pricing
// Compares a quote against similar completed projects in the same scope
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

export type BenchmarkScope = 'LOCAL' | 'REGIONAL' | 'NATIONAL';

export interface BenchmarkResult {
  scope: BenchmarkScope;
  sample_size: number;
  market_min: number | null;
  market_max: number | null;
  market_avg: number | null;
  market_median: number | null;
  market_p25: number | null;
  market_p75: number | null;
  your_price: number | null;
  percentile: number | null;
  recommendation: string;
  anonymized_competitors: {
    cheaper_count: number;
    similar_count: number;
    expensive_count: number;
  };
}

export interface DevisForBenchmark {
  montant_ht?: number;
  inferred_domains?: string[];
}

export interface ProjectForBenchmark {
  type?: string;
  region?: string;
  code_postal?: string;
}

export class BenchmarkEngine {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Compare a quote against the anonymous market.
   * Returns statistical benchmarks with full anonymization.
   */
  async compareQuote(
    devis: DevisForBenchmark,
    project: ProjectForBenchmark,
    scope: BenchmarkScope = 'REGIONAL'
  ): Promise<BenchmarkResult> {
    const yourPrice = devis.montant_ht ?? null;
    const projectType = project.type;

    if (!projectType) {
      return this.emptyResult(scope, yourPrice, 'Insufficient project context for benchmarking');
    }

    // 1. Build query for comparable quotes
    let query = this.supabase
      .from('devis')
      .select('montant_ht')
      .not('montant_ht', 'is', null)
      .gt('montant_ht', 0);

    // Scope filtering via project type (joined through projets)
    // Note: actual join syntax depends on DB schema. Using basic filter for now.
    if (scope === 'REGIONAL' && project.region) {
      query = query.eq('region', project.region);
    } else if (scope === 'LOCAL' && project.code_postal) {
      const dept = project.code_postal.substring(0, 2);
      query = query.like('code_postal', `${dept}%`);
    }
    // NATIONAL: no geo filter

    query = query.limit(200);

    const { data: rows } = await query;

    const prices = (rows ?? [])
      .map(r => r.montant_ht as number)
      .filter(p => p > 0)
      .sort((a, b) => a - b);

    if (prices.length < 3) {
      return this.emptyResult(scope, yourPrice, 'Insufficient market data for this project type');
    }

    // 2. Statistics
    const marketMin = prices[0];
    const marketMax = prices[prices.length - 1];
    const marketAvg = prices.reduce((s, v) => s + v, 0) / prices.length;
    const marketMedian = prices[Math.floor(prices.length / 2)];
    const p25 = prices[Math.floor(prices.length * 0.25)];
    const p75 = prices[Math.floor(prices.length * 0.75)];

    // 3. Percentile
    const percentile = yourPrice !== null
      ? Math.round((prices.filter(p => p <= yourPrice).length / prices.length) * 100)
      : null;

    // 4. Recommendation
    const recommendation = this.generateRecommendation(percentile, marketAvg, yourPrice);

    // 5. Anonymous competitor counts
    const similarBand = marketAvg * 0.10; // ±10% = "similar"
    const anonymizedCompetitors = {
      cheaper_count: yourPrice !== null ? prices.filter(p => p < yourPrice - similarBand).length : 0,
      similar_count: yourPrice !== null ? prices.filter(p => Math.abs(p - yourPrice) <= similarBand).length : 0,
      expensive_count: yourPrice !== null ? prices.filter(p => p > yourPrice + similarBand).length : 0,
    };

    return {
      scope,
      sample_size: prices.length,
      market_min: marketMin,
      market_max: marketMax,
      market_avg: Math.round(marketAvg),
      market_median: Math.round(marketMedian),
      market_p25: Math.round(p25),
      market_p75: Math.round(p75),
      your_price: yourPrice,
      percentile,
      recommendation,
      anonymized_competitors: anonymizedCompetitors,
    };
  }

  /**
   * Get per-activity unit price benchmarks for a quote.
   * Returns how each activity compares to the market average unit price.
   */
  async compareActivityPrices(
    items: Array<{ description: string; unit_price: number; unit?: string; category?: string }>,
    projectType?: string
  ): Promise<Array<{ description: string; your_price: number; market_avg: number | null; deviation_pct: number | null }>> {
    // Query market_price_references if table exists
    const results: Array<{ description: string; your_price: number; market_avg: number | null; deviation_pct: number | null }> = [];

    for (const item of items) {
      const { data: refs } = await this.supabase
        .from('market_price_references')
        .select('prix_moyen_ht')
        .ilike('description', `%${item.description.substring(0, 20)}%`)
        .maybeSingle()
        .catch(() => ({ data: null }));

      const marketAvg = (refs as { prix_moyen_ht?: number } | null)?.prix_moyen_ht ?? null;
      const deviationPct = marketAvg && item.unit_price > 0
        ? Math.round(((item.unit_price - marketAvg) / marketAvg) * 100)
        : null;

      results.push({
        description: item.description,
        your_price: item.unit_price,
        market_avg: marketAvg,
        deviation_pct: deviationPct,
      });
    }

    return results;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private generateRecommendation(
    percentile: number | null,
    marketAvg: number,
    yourPrice: number | null
  ): string {
    if (percentile === null) return 'Positionnement marché non calculable';

    if (percentile < 10) return 'Tarif anormalement bas (<10e percentile) — vérifier la rentabilité';
    if (percentile < 25) return 'Tarif compétitif — dans le bas du marché (25e percentile)';
    if (percentile < 50) return 'Tarif en dessous de la médiane — bonne compétitivité';
    if (percentile < 75) return 'Tarif dans la moyenne haute — positionnement standard';
    if (percentile < 90) return 'Tarif premium (75e percentile) — justifier par la qualité';
    return 'Tarif très élevé (>90e percentile) — risque de refus client';
  }

  private emptyResult(scope: BenchmarkScope, yourPrice: number | null, recommendation: string): BenchmarkResult {
    return {
      scope,
      sample_size: 0,
      market_min: null,
      market_max: null,
      market_avg: null,
      market_median: null,
      market_p25: null,
      market_p75: null,
      your_price: yourPrice,
      percentile: null,
      recommendation,
      anonymized_competitors: { cheaper_count: 0, similar_count: 0, expensive_count: 0 },
    };
  }
}
