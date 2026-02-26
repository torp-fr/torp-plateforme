/**
 * Trust Capping Engine v1.0
 * Intelligent grade capping based on Trust Framework Registry
 * Phase 23: Intelligent Professional Reliability Capping
 *
 * This engine:
 * 1. Detects obligation-lot coherence issues
 * 2. Checks price anomalies against ranges
 * 3. Identifies grade-blocking obligations
 * 4. Applies intelligent grade capping
 *
 * Pure rule-based logic - no APIs, no external calls
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import {
  TRUST_FRAMEWORK_REGISTRY,
  getLotProfile,
  getObligationProfile,
} from './trustFramework.registry';
import { blocksGrade } from './trustTypes';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Incoherence detected in project
 */
export interface DetectedIncoherence {
  type: 'missing_obligation' | 'extra_obligation' | 'lot_type_mismatch';
  detail: string;
  severity: 'warning' | 'error' | 'critical';
}

/**
 * Price anomaly detected
 */
export interface PriceAnomaly {
  lotType: string;
  actualPrice: number;
  minPrice?: number;
  maxPrice?: number;
  anomalyType: 'too_low' | 'too_high' | 'no_range';
  severity: 'warning' | 'error';
}

/**
 * Grade-blocking obligation
 */
export interface BlockingObligation {
  obligationId: string;
  blocksGradeAbove: string;
  reason: string;
}

/**
 * Trust Capping Engine Result
 */
export interface TrustCappingResult {
  // Grade information
  originalGrade: string;          // Grade from GlobalScoringEngine
  maxAllowedGrade: string;        // Grade after capping
  finalGrade: string;             // min(originalGrade, maxAllowedGrade)

  // Detected issues
  incoherences: DetectedIncoherence[];
  priceAnomalies: PriceAnomaly[];
  blockingObligations: BlockingObligation[];

  // Metadata
  cappingApplied: boolean;        // true if finalGrade < originalGrade
  metadata: {
    engineVersion: string;
    createdAt: string;
  };
}

/**
 * Grade comparison utility
 */
function gradeToScore(grade: string): number {
  const scores: Record<string, number> = {
    A: 4,
    B: 3,
    C: 2,
    D: 1,
    E: 0,
  };
  return scores[grade] || 0;
}

/**
 * Score to grade conversion
 */
function scoreToGrade(score: number): string {
  if (score >= 4) return 'A';
  if (score >= 3) return 'B';
  if (score >= 2) return 'C';
  if (score >= 1) return 'D';
  return 'E';
}

/**
 * Check lot-obligation coherence
 */
function checkCoherence(context: EngineExecutionContext): DetectedIncoherence[] {
  const incoherences: DetectedIncoherence[] = [];

  try {
    const lots = context.lots?.normalizedLots || [];
    const obligationIds = (context.rules?.uniqueDetailedObligations || [])
      .map((obl: any) => obl.id);

    if (lots.length === 0 || obligationIds.length === 0) {
      return incoherences;
    }

    // Check each lot has expected obligations
    lots.forEach((lot: any) => {
      const lotProfile = getLotProfile(lot.category);

      if (!lotProfile) {
        incoherences.push({
          type: 'lot_type_mismatch',
          detail: `Lot type '${lot.category}' not found in Trust Framework`,
          severity: 'warning',
        });
        return;
      }

      // Check each expected obligation is present
      lotProfile.expectedObligations.forEach((expectedOblId: string) => {
        if (!obligationIds.includes(expectedOblId)) {
          incoherences.push({
            type: 'missing_obligation',
            detail: `Lot '${lot.category}' is missing expected obligation '${expectedOblId}'`,
            severity: lotProfile.criticality === 'critical' ? 'critical' : 'error',
          });
        }
      });
    });

    return incoherences;
  } catch (error) {
    warn('[TrustCappingEngine] Error checking coherence', error);
    return incoherences;
  }
}

/**
 * Check price anomalies
 */
function checkPriceAnomalies(context: EngineExecutionContext): PriceAnomaly[] {
  const anomalies: PriceAnomaly[] = [];

  try {
    const lots = context.lots?.normalizedLots || [];
    const projectData = context.projectData || {};

    if (lots.length === 0) {
      return anomalies;
    }

    lots.forEach((lot: any) => {
      const lotProfile = getLotProfile(lot.category);

      if (!lotProfile || !lotProfile.priceRange) {
        return;
      }

      const minPrice = lotProfile.priceRange.minPerUnit;
      const maxPrice = lotProfile.priceRange.maxPerUnit;

      // Get actual price for this lot (simplified - use total if lot-level not available)
      const actualPrice = projectData.totalAmount ? projectData.totalAmount / lots.length : 0;

      if (actualPrice > 0) {
        if (minPrice && actualPrice < minPrice) {
          anomalies.push({
            lotType: lot.category,
            actualPrice,
            minPrice,
            maxPrice,
            anomalyType: 'too_low',
            severity: lotProfile.criticality === 'critical' ? 'error' : 'warning',
          });
        }

        if (maxPrice && actualPrice > maxPrice) {
          anomalies.push({
            lotType: lot.category,
            actualPrice,
            minPrice,
            maxPrice,
            anomalyType: 'too_high',
            severity: lotProfile.criticality === 'critical' ? 'error' : 'warning',
          });
        }
      }
    });

    return anomalies;
  } catch (error) {
    warn('[TrustCappingEngine] Error checking price anomalies', error);
    return anomalies;
  }
}

/**
 * Identify grade-blocking obligations
 */
function identifyBlockingObligations(context: EngineExecutionContext): BlockingObligation[] {
  const blockingObligations: BlockingObligation[] = [];

  try {
    const obligationIds = (context.rules?.uniqueDetailedObligations || [])
      .map((obl: any) => obl.id);

    if (obligationIds.length === 0) {
      return blockingObligations;
    }

    obligationIds.forEach((oblId: string) => {
      const oblProfile = getObligationProfile(oblId);

      if (oblProfile && oblProfile.blocksGradeAbove) {
        blockingObligations.push({
          obligationId: oblId,
          blocksGradeAbove: oblProfile.blocksGradeAbove,
          reason: `Obligation '${oblId}' requires grade ceiling of '${oblProfile.blocksGradeAbove}'`,
        });
      }
    });

    return blockingObligations;
  } catch (error) {
    warn('[TrustCappingEngine] Error identifying blocking obligations', error);
    return blockingObligations;
  }
}

/**
 * Calculate maximum allowed grade from blocking obligations
 */
function calculateMaxAllowedGrade(blockingObligations: BlockingObligation[]): string {
  if (blockingObligations.length === 0) {
    return 'A'; // No restrictions
  }

  // Find the most restrictive blocking obligation
  let maxScore = 4; // A = score 4

  blockingObligations.forEach((blocking: BlockingObligation) => {
    const blockingScore = gradeToScore(blocking.blocksGradeAbove);
    maxScore = Math.min(maxScore, blockingScore);
  });

  return scoreToGrade(maxScore);
}

/**
 * Calculate maximum allowed grade from price anomalies
 */
function calculateMaxGradeFromPricing(
  priceAnomalies: PriceAnomaly[],
  criticalities: Record<string, string>
): string {
  if (priceAnomalies.length === 0) {
    return 'A';
  }

  let maxScore = 4; // A = score 4

  priceAnomalies.forEach((anomaly: PriceAnomaly) => {
    const criticality = criticalities[anomaly.lotType] || 'low';

    if (anomaly.severity === 'error') {
      // Critical errors cap to D
      if (criticality === 'critical') {
        maxScore = Math.min(maxScore, 1); // D
      } else {
        maxScore = Math.min(maxScore, 2); // C
      }
    } else if (anomaly.severity === 'warning') {
      // Warnings reduce by 1 grade
      if (criticality === 'critical') {
        maxScore = Math.min(maxScore, 2); // C
      } else {
        maxScore = Math.min(maxScore, 3); // B
      }
    }
  });

  return scoreToGrade(maxScore);
}

/**
 * Run Trust Capping Engine
 */
export async function runTrustCappingEngine(
  executionContext: EngineExecutionContext
): Promise<TrustCappingResult> {
  const startTime = Date.now();

  try {
    log('[TrustCappingEngine] Starting trust capping evaluation');

    // Get original grade from global scoring
    const originalGrade = executionContext.globalScore?.grade || 'C';

    // Step 1: Check coherence
    const incoherences = checkCoherence(executionContext);

    // Step 2: Check price anomalies
    const priceAnomalies = checkPriceAnomalies(executionContext);

    // Step 3: Identify blocking obligations
    const blockingObligations = identifyBlockingObligations(executionContext);

    // Step 4: Calculate maximum allowed grades
    const maxGradeFromBlocking = calculateMaxAllowedGrade(blockingObligations);

    // Build criticality map for pricing calculation
    const criticalities: Record<string, string> = {};
    const lots = executionContext.lots?.normalizedLots || [];
    lots.forEach((lot: any) => {
      const profile = getLotProfile(lot.category);
      if (profile) {
        criticalities[lot.category] = profile.criticality;
      }
    });

    const maxGradeFromPricing = calculateMaxGradeFromPricing(priceAnomalies, criticalities);

    // Step 5: Apply most restrictive cap
    const maxAllowedGrade =
      scoreToGrade(
        Math.min(
          gradeToScore(maxGradeFromBlocking),
          gradeToScore(maxGradeFromPricing)
        )
      ) || 'E';

    // Step 6: Calculate final grade
    const finalGradeScore = Math.min(
      gradeToScore(originalGrade),
      gradeToScore(maxAllowedGrade)
    );
    const finalGrade = scoreToGrade(finalGradeScore) || 'E';

    const cappingApplied = finalGrade !== originalGrade;

    const result: TrustCappingResult = {
      originalGrade,
      maxAllowedGrade,
      finalGrade,
      incoherences,
      priceAnomalies,
      blockingObligations,
      cappingApplied,
      metadata: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
      },
    };

    log('[TrustCappingEngine] Trust capping complete', {
      originalGrade,
      maxAllowedGrade,
      finalGrade,
      cappingApplied,
      incoherenceCount: incoherences.length,
      anomalyCount: priceAnomalies.length,
      blockingObligationCount: blockingObligations.length,
      processingTime: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    console.error('[TrustCappingEngine] Unexpected error', error);

    // Return safe fallback
    return {
      originalGrade: 'E',
      maxAllowedGrade: 'E',
      finalGrade: 'E',
      incoherences: [],
      priceAnomalies: [],
      blockingObligations: [],
      cappingApplied: false,
      metadata: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Format capping result as readable text
 */
export function formatCappingResultAsText(result: TrustCappingResult): string {
  let text = `
TRUST CAPPING RESULT
====================

Original Grade: ${result.originalGrade}
Max Allowed Grade: ${result.maxAllowedGrade}
Final Grade: ${result.finalGrade}
Capping Applied: ${result.cappingApplied ? 'YES' : 'NO'}

INCOHERENCES (${result.incoherences.length})
═════════════════════════════════════════
${
  result.incoherences.length > 0
    ? result.incoherences.map((inc) => `- [${inc.severity.toUpperCase()}] ${inc.detail}`).join('\n')
    : '(None detected)'
}

PRICE ANOMALIES (${result.priceAnomalies.length})
═══════════════════════════════════════════
${
  result.priceAnomalies.length > 0
    ? result.priceAnomalies
        .map((anom) => `- [${anom.severity.toUpperCase()}] ${anom.lotType}: ${anom.actualPrice}€ (${anom.anomalyType})`)
        .join('\n')
    : '(None detected)'
}

BLOCKING OBLIGATIONS (${result.blockingObligations.length})
══════════════════════════════════════════════════
${
  result.blockingObligations.length > 0
    ? result.blockingObligations
        .map((block) => `- ${block.obligationId} (blocks grade > ${block.blocksGradeAbove})`)
        .join('\n')
    : '(None)'
}
`;

  return text.trim();
}

/**
 * Get Trust Capping Engine metadata
 */
export function getTrustCappingEngineMetadata() {
  return {
    id: 'trustCappingEngine',
    name: 'Trust Capping Engine',
    version: '1.0',
    description: 'Intelligent grade capping based on Trust Framework Registry',
    type: 'capping-engine',
    capabilities: [
      'Coherence checking (lot-obligation alignment)',
      'Price anomaly detection',
      'Grade-blocking obligation identification',
      'Intelligent grade capping',
      'Result formatting and reporting',
    ],
    cappingRules: {
      coherence: 'Missing critical obligations can reduce grade',
      pricing: 'Price anomalies cap grade based on lot criticality',
      blocking: 'Blocking obligations enforce grade ceilings',
      final: 'Final grade = min(original, maxAllowed)',
    },
    dependencies: [
      'Trust Framework Registry',
      'ExecutionContext from GlobalScoringEngine',
      'Lot profiles and obligation profiles',
    ],
  };
}
