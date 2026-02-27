/**
 * PHASE 36 Extension: Pricing Extraction Service
 * Extracts numerical pricing data from documents
 */

import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface PricingData {
  min_price?: number;
  avg_price?: number;
  max_price?: number;
  currency?: string;
  unit?: string; // m², m, kg, etc.
  type_travaux?: string;
  region?: string;
  source_text?: string;
}

class PricingExtractionService {
  /**
   * Extract pricing data from document content
   */
  extractPricingData(content: string, category: string, type_travaux?: string): PricingData | null {
    if (category !== 'PRICING_REFERENCE') {
      return null;
    }

    try {
      log('[PRICING] 💰 Extracting pricing data...');

      // Regex patterns for price extraction
      const patterns = [
        // Format: "80-120€/m²" or "80 à 120 €/m²"
        /(\d+)\s*(?:-|à)\s*(\d+)\s*€\s*\/\s*(m²|m|kg|kWh)/gi,
        // Format: "environ 100€/m²"
        /environ\s+(\d+)\s*€\s*\/\s*(m²|m|kg|kWh)/gi,
        // Format: "8000€ à 15000€"
        /(\d+)\s*€\s*(?:à|-)\s*(\d+)\s*€/gi,
      ];

      const prices: number[] = [];
      let unit = 'm²';
      let foundMatch = false;

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          foundMatch = true;
          log('[PRICING] 🔍 Found price match:', match[0]);

          if (match.length >= 3) {
            const num1 = parseInt(match[1]);
            const num2 = parseInt(match[2]);
            prices.push(num1);
            prices.push(num2);
            if (match[3]) {
              unit = match[3];
            }
          }
        }
      }

      if (!foundMatch || prices.length === 0) {
        log('[PRICING] ℹ️ No pricing data found');
        return null;
      }

      // Calculate statistics
      const min_price = Math.min(...prices);
      const max_price = Math.max(...prices);
      const avg_price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

      const pricingData: PricingData = {
        min_price,
        avg_price,
        max_price,
        currency: '€',
        unit,
        type_travaux: type_travaux || this.inferWorkType(content),
        source_text: content.substring(0, 500),
      };

      log('[PRICING] ✅ Pricing extracted:', pricingData);
      return pricingData;
    } catch (error) {
      console.error('[PRICING] ❌ Extraction error:', error);
      return null;
    }
  }

  /**
   * Infer work type from content
   */
  private inferWorkType(content: string): string {
    const keywords: Record<string, string> = {
      'isolation thermique': 'isolation',
      'pompe à chaleur': 'chauffage',
      'fenêtre': 'menuiserie',
      'porte': 'menuiserie',
      'chauffage': 'chauffage',
      'eau chaude': 'eau_chaude',
      'panneaux solaires': 'energie_renouvelable',
      'ventilation': 'ventilation',
      'électricité': 'electricite',
      'plomberie': 'plomberie',
      'maçonnerie': 'gros_oeuvre',
      'toiture': 'toiture',
      'façade': 'facade',
    };

    const lowerContent = content.toLowerCase();
    for (const [keyword, type] of Object.entries(keywords)) {
      if (lowerContent.includes(keyword)) {
        return type;
      }
    }

    return 'renovation';
  }

  /**
   * Store pricing data in market_price_references
   */
  async storePricingReference(
    document_id: string,
    pricingData: PricingData,
    region?: string
  ): Promise<boolean> {
    try {
      if (!pricingData.type_travaux) {
        warn('[PRICING] ⚠️ No type_travaux, skipping storage');
        return false;
      }

      log('[PRICING] 💾 Storing pricing reference...');

      const { error } = await supabase.from('market_price_references').insert({
        type_travaux: pricingData.type_travaux,
        region: region || 'National',
        min_price: pricingData.min_price || 0,
        avg_price: pricingData.avg_price || 0,
        max_price: pricingData.max_price || 0,
        source: `document_${document_id}`,
        reliability_score: 70, // User-provided references
        metadata: {
          unit: pricingData.unit,
          document_id,
          extracted_at: new Date().toISOString(),
        },
      });

      if (error) {
        console.error('[PRICING] ❌ Storage error:', error);
        return false;
      }

      // Mark document as pricing reference
      await supabase
        .from('knowledge_documents')
        .update({
          is_pricing_reference: true,
          pricing_data: pricingData,
        })
        .eq('id', document_id);

      log('[PRICING] ✅ Pricing reference stored');
      return true;
    } catch (error) {
      console.error('[PRICING] 💥 Error:', error);
      return false;
    }
  }

  /**
   * Get pricing reference statistics for analytics
   */
  async getPricingStats(): Promise<{
    total_references: number;
    by_work_type: Record<string, number>;
    avg_price_by_type: Record<string, number>;
  } | null> {
    try {
      log('[PRICING] 📊 Fetching pricing statistics...');

      // PHASE 36.2 FIX: Remove is_active filter (column doesn't exist in market_price_references)
      const { data: references, error } = await supabase
        .from('market_price_references')
        .select('*');

      if (error || !references) {
        console.error('[PRICING] ❌ Fetch error:', error?.message || 'Unknown error');
        return null;
      }

      const by_work_type: Record<string, number> = {};
      const avg_price_by_type: Record<string, number> = {};
      const price_sum: Record<string, number> = {};
      const price_count: Record<string, number> = {};

      references.forEach((ref: Record<string, unknown>) => {
        const type = ref.type_travaux as string;
        const price = typeof ref.avg_price === 'number' ? ref.avg_price : 0;
        by_work_type[type] = (by_work_type[type] || 0) + 1;
        price_sum[type] = (price_sum[type] || 0) + price;
        price_count[type] = (price_count[type] || 0) + 1;
      });

      // Calculate averages
      for (const type in price_count) {
        avg_price_by_type[type] = Math.round(price_sum[type] / price_count[type]);
      }

      const stats = {
        total_references: references.length,
        by_work_type,
        avg_price_by_type,
      };

      log('[PRICING] ✅ Statistics fetched:', stats);
      return stats;
    } catch (error) {
      console.error('[PRICING] 💥 Stats error:', error instanceof Error ? error.message : error);
      return null;
    }
  }
}

export const pricingExtractionService = new PricingExtractionService();
