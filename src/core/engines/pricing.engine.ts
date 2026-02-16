/**
 * Pricing Engine v1.0
 * Evaluate pricing coherence relative to project complexity
 * Pure rule-based heuristics - no external data
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';

/**
 * Pricing breakdown scores
 */
export interface PricingBreakdown {
  ratioScore: number;        // 0-5: Obligation/price ratio
  structureScore: number;    // 0-5: HT/TTC consistency
  anomalyPenalty: number;    // -5 to 0: Price extremes penalty
  decompositionScore: number; // 0-5: Line item breakdown
}

/**
 * Pricing Engine Result
 */
export interface PricingEngineResult {
  pricingScore: number;      // 0-20 raw
  breakdown: PricingBreakdown;
  normalizedScore: number;   // 0-20 normalized
  meta: {
    engineVersion: string;
    createdAt: string;
  };
}

/**
 * Calculate ratio score based on obligations vs price
 */
function calculateRatioScore(context: EngineExecutionContext): number {
  try {
    const obligationCount = context.rules?.obligationCount || 0;
    const totalAmount = context.projectData?.totalAmount || 0;

    if (!totalAmount || !obligationCount) {
      return 2;
    }

    const pricePerObligation = totalAmount / obligationCount;

    // Heuristic: good ratio if price per obligation is between 100-10000
    if (pricePerObligation > 100 && pricePerObligation < 10000) {
      return 5;
    }

    if (pricePerObligation > 50 && pricePerObligation < 15000) {
      return 3;
    }

    return 1;
  } catch (error) {
    console.warn('[PricingEngine] Error calculating ratio score', error);
    return 0;
  }
}

/**
 * Calculate structure score for HT/TTC consistency
 */
function calculateStructureScore(context: EngineExecutionContext): number {
  try {
    const priceHT = context.projectData?.priceHT || 0;
    const priceTTC = context.projectData?.priceTTC || 0;

    if (!priceHT || !priceTTC) {
      return 2;
    }

    // HT should be less than TTC
    if (priceHT < priceTTC) {
      const vat = priceTTC - priceHT;
      const vatRate = vat / priceHT;

      // VAT should be between 0.05 (5%) and 0.25 (25%)
      if (vatRate >= 0.05 && vatRate <= 0.25) {
        return 5;
      }

      if (vatRate >= 0.02 && vatRate <= 0.35) {
        return 3;
      }
    }

    return 1;
  } catch (error) {
    console.warn('[PricingEngine] Error calculating structure score', error);
    return 0;
  }
}

/**
 * Calculate anomaly penalty for extreme prices
 */
function calculateAnomalyPenalty(context: EngineExecutionContext): number {
  try {
    const totalAmount = context.projectData?.totalAmount || 0;
    const lotsCount = context.lots?.normalizedLots?.length || 0;

    if (!totalAmount || !lotsCount) {
      return 0;
    }

    const avgPrice = totalAmount / lotsCount;

    // Penalty if average price is extremely low (<10) or extremely high (>100000)
    if (avgPrice < 10 || avgPrice > 100000) {
      return -5;
    }

    // Minor penalty if unusual (<30 or >50000)
    if (avgPrice < 30 || avgPrice > 50000) {
      return -2;
    }

    return 0;
  } catch (error) {
    console.warn('[PricingEngine] Error calculating anomaly penalty', error);
    return 0;
  }
}

/**
 * Calculate decomposition score for line items
 */
function calculateDecompositionScore(context: EngineExecutionContext): number {
  try {
    const lineItems = context.projectData?.lineItems || [];

    if (!Array.isArray(lineItems)) {
      return 2;
    }

    const itemCount = lineItems.length;

    // Excellent if 5+ line items
    if (itemCount >= 5) {
      return 5;
    }

    // Good if 3-4 items
    if (itemCount >= 3) {
      return 4;
    }

    // Partial if 1-2 items
    if (itemCount >= 1) {
      return 2;
    }

    return 0;
  } catch (error) {
    console.warn('[PricingEngine] Error calculating decomposition score', error);
    return 0;
  }
}

/**
 * Run Pricing Engine
 */
export async function runPricingEngine(
  executionContext: EngineExecutionContext
): Promise<PricingEngineResult> {
  const startTime = Date.now();

  try {
    console.log('[PricingEngine] Starting pricing evaluation');

    // Calculate individual scores
    const ratioScore = calculateRatioScore(executionContext);
    const structureScore = calculateStructureScore(executionContext);
    const anomalyPenalty = calculateAnomalyPenalty(executionContext);
    const decompositionScore = calculateDecompositionScore(executionContext);

    // Calculate raw total (5+5+(-5 to 0)+5 = 0-20)
    const pricingScore = Math.max(
      ratioScore + structureScore + anomalyPenalty + decompositionScore,
      0
    );

    // Normalize to 0-20
    const normalizedScore = Math.min(Math.max(pricingScore, 0), 20);

    const result: PricingEngineResult = {
      pricingScore,
      breakdown: {
        ratioScore,
        structureScore,
        anomalyPenalty,
        decompositionScore,
      },
      normalizedScore,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
      },
    };

    console.log('[PricingEngine] Evaluation complete', {
      pricingScore: result.pricingScore,
      normalizedScore: result.normalizedScore,
      anomalyPenalty,
      processingTime: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    console.error('[PricingEngine] Unexpected error', error);

    // Return fallback result
    return {
      pricingScore: 0,
      breakdown: {
        ratioScore: 0,
        structureScore: 0,
        anomalyPenalty: 0,
        decompositionScore: 0,
      },
      normalizedScore: 0,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Get Pricing Engine metadata
 */
export function getPricingEngineMetadata() {
  return {
    id: 'pricingEngine',
    name: 'Pricing Engine',
    version: '1.0',
    description: 'Evaluate pricing coherence relative to project complexity',
    scoringMaximum: 20,
    breakdown: {
      ratioScore: { max: 5, description: 'Obligation/price ratio coherence' },
      structureScore: { max: 5, description: 'HT/TTC consistency' },
      anomalyPenalty: { min: -5, max: 0, description: 'Extreme price penalties' },
      decompositionScore: { max: 5, description: 'Line item breakdown' },
    },
    heuristics: {
      goodRatioRange: '100-10000 per obligation',
      goodVATRange: '5-25%',
      anomalyThresholds: 'Penalty if <10 or >100000 per lot',
    },
  };
}
