/**
 * PHASE 35: Market Intelligence Service
 * Manages market data ingestion, normalization, and learning
 * Only uses whitelisted sources - NO free scraping
 */

import { supabase } from '@/lib/supabase';
import { knowledgeBrainService } from './knowledge-brain.service';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface MarketDataSource {
  name: string;
  url?: string;
  category: 'price_survey' | 'regulatory' | 'user_feedback';
  reliability: number; // 0-100
  region?: string;
}

// Whitelisted data sources only
const WHITELISTED_SOURCES: Record<string, MarketDataSource> = {
  'insee_data': {
    name: 'INSEE Official Data',
    category: 'regulatory',
    reliability: 95,
  },
  'aeme_standards': {
    name: 'ADEME Standards',
    category: 'regulatory',
    reliability: 90,
  },
  'fevrier_report': {
    name: 'Février Construction Index',
    category: 'price_survey',
    reliability: 85,
  },
  'user_feedback': {
    name: 'User Feedback (Verified)',
    category: 'user_feedback',
    reliability: 60,
  },
};

class MarketIntelligenceService {
  /**
   * Ingest market data from whitelisted source
   */
  async ingestMarketData(
    source_key: string,
    data: Array<{
      type_travaux: string;
      region: string;
      min_price: number;
      avg_price: number;
      max_price: number;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<number> {
    try {
      const source = WHITELISTED_SOURCES[source_key];
      if (!source) {
        warn('[MARKET INTELLIGENCE] Unauthorized source:', source_key);
        return 0;
      }

      log('[MARKET INTELLIGENCE] Ingesting from source:', source.name, '- Records:', data.length);

      let insertedCount = 0;

      for (const record of data) {
        const { error } = await supabase.from('market_price_references').insert({
          type_travaux: record.type_travaux,
          region: record.region,
          min_price: record.min_price,
          avg_price: record.avg_price,
          max_price: record.max_price,
          source: source.name,
          reliability_score: source.reliability,
          metadata: record.metadata || {},
          data_count: 1,
        });

        if (!error) {
          insertedCount++;

          // Also store as knowledge document
          const docAdded = await knowledgeBrainService.addKnowledgeDocument(
            source.name,
            'pricing',
            `Market pricing for ${record.type_travaux} in ${record.region}: €${record.min_price} - €${record.max_price} (avg: €${record.avg_price})`,
            {
              region: record.region,
              reliability_score: source.reliability,
              metadata: {
                type_travaux: record.type_travaux,
                data_type: 'market_reference',
              },
            }
          );

          if (docAdded) {
            log('[MARKET INTELLIGENCE] Knowledge document created:', docAdded.id);
          }
        } else {
          console.error('[MARKET INTELLIGENCE] Failed to insert record:', error);
        }
      }

      log('[MARKET INTELLIGENCE] Ingestion complete:', insertedCount, '/', data.length, 'records');
      return insertedCount;
    } catch (error) {
      console.error('[MARKET INTELLIGENCE] Ingestion error:', error);
      return 0;
    }
  }

  /**
   * Update market price average based on new analysis data
   */
  async updatePriceAverage(
    type_travaux: string,
    region: string,
    new_price: number,
    source: string = 'user_feedback'
  ): Promise<boolean> {
    try {
      log('[MARKET INTELLIGENCE] Updating price average:', { type_travaux, region, new_price });

      // Get existing reference
      const { data: existing, error: fetchError } = await supabase
        .from('market_price_references')
        .select('*')
        .eq('type_travaux', type_travaux)
        .eq('region', region)
        .eq('source', 'User Feedback (Verified)')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows - that's fine
        warn('[MARKET INTELLIGENCE] Fetch error:', fetchError);
      }

      if (existing) {
        // Update existing with new data point
        const new_count = existing.data_count + 1;
        const new_avg = (existing.avg_price * existing.data_count + new_price) / new_count;
        const new_min = Math.min(existing.min_price, new_price);
        const new_max = Math.max(existing.max_price, new_price);

        const { error: updateError } = await supabase
          .from('market_price_references')
          .update({
            min_price: new_min,
            avg_price: new_avg,
            max_price: new_max,
            data_count: new_count,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('[MARKET INTELLIGENCE] Update error:', updateError);
          return false;
        }

        log('[MARKET INTELLIGENCE] Price average updated:', {
          old_avg: existing.avg_price,
          new_avg,
          data_count: new_count,
        });
      } else {
        // Create new reference
        const { error: insertError } = await supabase.from('market_price_references').insert({
          type_travaux,
          region,
          min_price: new_price,
          avg_price: new_price,
          max_price: new_price,
          source: 'User Feedback (Verified)',
          reliability_score: 60,
          data_count: 1,
        });

        if (insertError) {
          console.error('[MARKET INTELLIGENCE] Insert error:', insertError);
          return false;
        }

        log('[MARKET INTELLIGENCE] New price reference created');
      }

      return true;
    } catch (error) {
      console.error('[MARKET INTELLIGENCE] Update error:', error);
      return false;
    }
  }

  /**
   * Detect price anomalies (> 20% deviation from market average)
   */
  async detectAnomalies(
    type_travaux: string,
    region: string,
    quote_price: number
  ): Promise<{
    is_anomaly: boolean;
    deviation_percent: number;
    market_avg: number;
  } | null> {
    try {
      const market = await knowledgeBrainService.getMarketPricing(type_travaux, region);
      if (!market) {
        log('[MARKET INTELLIGENCE] No market data for comparison');
        return null;
      }

      const deviation_percent = ((quote_price - market.avg_price) / market.avg_price) * 100;
      const is_anomaly = Math.abs(deviation_percent) > 20;

      log('[MARKET INTELLIGENCE] Anomaly check:', {
        quote_price,
        market_avg: market.avg_price,
        deviation_percent: deviation_percent.toFixed(1),
        is_anomaly,
      });

      return { is_anomaly, deviation_percent, market_avg: market.avg_price };
    } catch (error) {
      console.error('[MARKET INTELLIGENCE] Anomaly detection error:', error);
      return null;
    }
  }

  /**
   * Adjust price score based on market comparison
   */
  async adjustPriceScore(
    quote_price: number,
    type_travaux: string,
    region: string,
    base_score: number
  ): Promise<number> {
    try {
      log('[MARKET INTELLIGENCE] Adjusting price score based on market data');

      const market = await knowledgeBrainService.getMarketPricing(type_travaux, region);
      if (!market) {
        log('[MARKET INTELLIGENCE] No market adjustment available');
        return base_score;
      }

      // Calculate score adjustment
      const min_range = market.min_price * 0.9; // 10% below market min
      const max_range = market.max_price * 1.1; // 10% above market max

      let adjusted_score = base_score;

      if (quote_price < min_range) {
        // Suspiciously low - might be missing services
        adjusted_score = Math.max(0, base_score - 30);
        log('[MARKET INTELLIGENCE] Price suspiciously low - decreased score by 30');
      } else if (quote_price > max_range) {
        // Suspiciously high - might be overpriced
        adjusted_score = Math.max(0, base_score - 20);
        log('[MARKET INTELLIGENCE] Price suspiciously high - decreased score by 20');
      } else if (quote_price < market.min_price) {
        // Below market but reasonable
        adjusted_score = base_score - 5;
      } else if (quote_price > market.max_price) {
        // Above market but reasonable
        adjusted_score = base_score - 10;
      } else {
        // Within market range - bonus
        adjusted_score = Math.min(100, base_score + 10);
        log('[MARKET INTELLIGENCE] Price within market range - increased score by 10');
      }

      log('[MARKET INTELLIGENCE] Score adjusted:', { base_score, adjusted_score, market_avg: market.avg_price });
      return adjusted_score;
    } catch (error) {
      console.error('[MARKET INTELLIGENCE] Score adjustment error:', error);
      return base_score;
    }
  }

  /**
   * Get market intelligence summary
   */
  async getMarketSummary(
    type_travaux?: string,
    region?: string
  ): Promise<{
    total_references: number;
    avg_reliability: number;
    regions_covered: number;
    work_types_covered: number;
  } | null> {
    try {
      let query = supabase.from('market_price_references').select('*', { count: 'exact' }).eq('is_active', true);

      if (type_travaux) query = query.eq('type_travaux', type_travaux);
      if (region) query = query.eq('region', region);

      const { data, count, error } = await query;

      if (error || !data) {
        console.error('[MARKET INTELLIGENCE] Summary query error:', error);
        return null;
      }

      const regions = new Set(
        data.map((d: Record<string, unknown>) => d.region as string)
      );
      const types = new Set(
        data.map((d: Record<string, unknown>) => d.type_travaux as string)
      );
      const avg_reliability = data.reduce(
        (sum: number, d: Record<string, unknown>) =>
          sum + (typeof d.reliability_score === 'number' ? d.reliability_score : 0),
        0
      ) / data.length;

      return {
        total_references: count || 0,
        avg_reliability,
        regions_covered: regions.size,
        work_types_covered: types.size,
      };
    } catch (error) {
      console.error('[MARKET INTELLIGENCE] Summary error:', error);
      return null;
    }
  }
}

export const marketIntelligenceService = new MarketIntelligenceService();
