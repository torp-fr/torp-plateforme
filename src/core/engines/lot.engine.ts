/**
 * Lot Engine v1.0
 * Minimal structuring engine for lot normalization and categorization
 * Pure structuring - no AI, no external APIs, no Supabase
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Normalized lot structure
 */
export interface NormalizedLot {
  id: string;
  type: string;
  category: 'electricite' | 'plomberie' | 'toiture' | 'autre' | 'unknown';
  originalType?: string;
}

/**
 * Lot Engine result
 */
export interface LotEngineResult {
  normalizedLots: NormalizedLot[];
  primaryLots: NormalizedLot[];
  complexityScore: number;
  totalLots: number;
  categorySummary: Record<string, number>;
  meta: {
    engineVersion: string;
    createdAt: string;
    processingTime: number;
  };
}

/**
 * Run Lot Engine - normalize and categorize detected lots
 * Input: EngineExecutionContext from previous engines
 * Output: Structured lot data for downstream engines
 */
export async function runLotEngine(
  executionContext: EngineExecutionContext
): Promise<LotEngineResult> {
  const startTime = Date.now();

  try {
    log('[LotEngine] Starting lot normalization');

    // Extract detected lots from context engine results
    const detectedLots = executionContext.context?.detectedLots || [];

    // Normalize each lot
    const normalizedLots: NormalizedLot[] = detectedLots.map((lot: any) => ({
      id: lot.id || '',
      type: (lot.type || '').toLowerCase(),
      category: categorizeLot(lot.type),
      originalType: lot.type,
    }));

    // Identify primary lots (first 2 as most relevant)
    const primaryLots = normalizedLots.slice(0, 2);

    // Calculate complexity score (total lot count)
    const complexityScore = normalizedLots.length;

    // Build category summary
    const categorySummary = normalizedLots.reduce(
      (acc: Record<string, number>, lot: NormalizedLot) => {
        acc[lot.category] = (acc[lot.category] || 0) + 1;
        return acc;
      },
      {}
    );

    const processingTime = Date.now() - startTime;

    const result: LotEngineResult = {
      normalizedLots,
      primaryLots,
      complexityScore,
      totalLots: normalizedLots.length,
      categorySummary,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime,
      },
    };

    log('[LotEngine] Lot normalization completed', {
      totalLots: normalizedLots.length,
      primaryLots: primaryLots.length,
      categories: Object.keys(categorySummary),
      processingTime,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[LotEngine] Error during lot normalization', error);

    // Return graceful error result
    return {
      normalizedLots: [],
      primaryLots: [],
      complexityScore: 0,
      totalLots: 0,
      categorySummary: {},
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
    };
  }
}

/**
 * Categorize lot by type string
 * Helper function for lot classification
 */
function categorizeLot(
  type: string
): 'electricite' | 'plomberie' | 'toiture' | 'autre' | 'unknown' {
  if (!type) return 'unknown';

  const lowerType = type.toLowerCase();

  if (lowerType.includes('elec') || lowerType.includes('électr')) {
    return 'electricite';
  }
  if (lowerType.includes('plomb') || lowerType.includes('tuyau')) {
    return 'plomberie';
  }
  if (
    lowerType.includes('toit') ||
    lowerType.includes('couverture') ||
    lowerType.includes('roof')
  ) {
    return 'toiture';
  }

  return 'autre';
}

/**
 * Get Lot Engine metadata
 * Describes engine capabilities
 */
export function getLotEngineMetadata() {
  return {
    id: 'lotEngine',
    name: 'Lot Engine',
    version: '1.0',
    description: 'Normalize and categorize detected lots for further processing',
    capabilities: [
      'Lot normalization',
      'Type categorization',
      'Complexity scoring',
      'Primary lot identification',
    ],
    inputs: ['detectedLots from contextEngine'],
    outputs: ['normalizedLots', 'primaryLots', 'complexityScore'],
    dependencies: ['contextEngine'],
  };
}
