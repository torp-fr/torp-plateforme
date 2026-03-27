/**
 * Lot Engine v1.0
 * Minimal structuring engine for lot normalization and categorization
 * Pure structuring - no AI, no external APIs, no Supabase
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Mapping from lot category to DB rules domain.
 * Used by rule.engine.ts to fetch relevant rules from the `rules` table.
 * trustCapping.engine.ts keeps using `category` (the trust framework key).
 */
const LOT_TO_DOMAIN: Record<string, string | null> = {
  electricite: 'électrique',
  plomberie:   'hydraulique',
  toiture:     'structure',
  structure:   'structure',
  chauffage:   'thermique',
  autre:       null,
  unknown:     null,
};

/**
 * Normalized lot structure
 */
export interface NormalizedLot {
  id: string;
  type: string;
  category: 'electricite' | 'plomberie' | 'toiture' | 'structure' | 'chauffage' | 'autre' | 'unknown';
  /** DB rules domain — use this for rule fetching, not `category`. */
  domain: string | null;
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
    const normalizedLots: NormalizedLot[] = detectedLots.map((lot: any) => {
      const category = categorizeLot(lot.type);
      return {
        id: lot.id || '',
        type: (lot.type || '').toLowerCase(),
        category,
        domain: LOT_TO_DOMAIN[category] ?? null,
        originalType: lot.type,
      };
    });

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
 * Categorize lot by type string.
 * Exported for unit testing.
 *
 * Priority order matters — more specific checks first.
 * All checks are case-insensitive via .toLowerCase().
 */
export function categorizeLot(
  type: string
): 'electricite' | 'plomberie' | 'toiture' | 'structure' | 'chauffage' | 'autre' | 'unknown' {
  if (!type) return 'unknown';

  const t = type.toLowerCase();

  // ── Électricité ───────────────────────────────────────────────────────────
  if (
    t.includes('elec') || t.includes('électr') ||
    t.includes('câbl') || t.includes('cablag') ||
    t.includes('tableau') || t.includes('circuit') ||
    t.includes('prises') || t.includes('interrupteur')
  ) {
    return 'electricite';
  }

  // ── Plomberie / hydraulique ───────────────────────────────────────────────
  // Note: 'pompe' alone is too broad (thermopompe, pompe à chaleur → chauffage).
  // Use 'circulation', 'relevage', etc. for specific hydraulic pumps.
  if (
    t.includes('plomb') || t.includes('tuyau') ||
    t.includes('sanitair') || t.includes('robinet') ||
    t.includes('filtr') || t.includes('circulation') ||
    t.includes('assainissement') || t.includes('canalisation') ||
    t.includes('eau chaude') || t.includes('eau froide') ||
    t.includes('réseau eau') || t.includes('evacuation')
  ) {
    return 'plomberie';
  }

  // ── Toiture / couverture ──────────────────────────────────────────────────
  if (
    t.includes('toit') || t.includes('couverture') || t.includes('roof') ||
    t.includes('zinguerie') || t.includes('ardoise') || t.includes('tuile')
  ) {
    return 'toiture';
  }

  // ── Structure / gros œuvre ────────────────────────────────────────────────
  if (
    t.includes('terrassement') || t.includes('terras') ||
    t.includes('fouille') || t.includes('excavation') ||
    t.includes('fondation') || t.includes('béton') || t.includes('beton') ||
    t.includes('armature') || t.includes('ferraillage') || t.includes('ferrail') ||
    t.includes('coffrage') || t.includes('dalle') ||
    t.includes('maçon') || t.includes('macon') ||
    t.includes('gros') || // gros oeuvre, gros œuvre
    t.includes('structur') || // structure, structural
    t.includes('mur porteur') || t.includes('voile')
  ) {
    return 'structure';
  }

  // ── Chauffage / thermique ─────────────────────────────────────────────────
  if (
    t.includes('chauffage') || t.includes('chauffant') ||
    t.includes('climatisation') || t.includes('clim') ||
    t.includes('ventilation') || t.includes('vmc') || t.includes('cvc') ||
    t.includes('thermopompe') || t.includes('pompe') || t.includes('chaleur') ||
    t.includes('chaudière') || t.includes('chaudiere') ||
    t.includes('radiateur')
  ) {
    return 'chauffage';
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
