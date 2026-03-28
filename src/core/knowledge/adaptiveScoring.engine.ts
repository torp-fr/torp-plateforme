/**
 * Adaptive Scoring Engine v1.0
 * Applies context-aware adjustments to scoring using TORP Knowledge Core
 * Executes AFTER GlobalScoringEngine without modifying original score
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import {
  getSectorCoefficient,
  getPricingReference,
  getRiskFactor,
  getNormativeRule,
} from './knowledgeRegistry';
import { TORP_KNOWLEDGE_CORE } from './knowledgeRegistry';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Adjustment breakdown details
 */
export interface AdjustmentBreakdown {
  sectorMultiplier?: number; // Complexity adjustment
  riskMultiplier?: number; // Risk-based adjustment
  normativePenalty?: number; // Regulatory requirement penalties
  pricingPenalty?: number; // Pricing anomaly penalties
}

/**
 * Result of adaptive scoring
 */
export interface AdaptiveScoringResult {
  baseScore: number; // Original score from GlobalScoringEngine
  adjustedScore: number; // Final adjusted score (0-100)
  adjustmentBreakdown: AdjustmentBreakdown; // Detailed breakdown
  metadata: {
    version: string;
    createdAt: string;
    rationale?: string;
  };
}

/**
 * Determine project sector from execution context
 */
function detectProjectSector(context: EngineExecutionContext): string {
  try {
    // Try to detect from project data
    const projectData = (context as any)?.projectData;
    if (projectData?.sector) {
      return projectData.sector.toLowerCase();
    }

    // Try to detect from lots
    const lots = (context.lots as any)?.normalizedLots || [];
    if (lots.length > 0) {
      const firstLot = lots[0];
      // Check if it's likely a specific sector
      if (firstLot?.type?.includes('heritage') || firstLot?.type?.includes('monument')) {
        return 'heritage';
      }
      if (firstLot?.type?.includes('industrial')) {
        return 'industrial';
      }
      if (firstLot?.type?.includes('commercial')) {
        return 'commercial';
      }
    }

    // Default to residential
    return 'residential';
  } catch (error) {
    warn('[AdaptiveScoring] Failed to detect sector, defaulting to residential');
    return 'residential';
  }
}

/**
 * Get base score from execution context
 */
function getBaseScore(context: EngineExecutionContext): number {
  // Score from GlobalScoringEngine (most recent scoring)
  const globalScore = (context as any)?.globalScore?.score;
  if (globalScore !== undefined && globalScore >= 0 && globalScore <= 100) {
    return globalScore;
  }

  // Fallback to audit score
  const auditScore = (context.audit as any)?.globalScore;
  if (auditScore !== undefined && auditScore >= 0 && auditScore <= 100) {
    return auditScore;
  }

  // Final fallback
  return 50;
}

/**
 * Calculate sector multiplier adjustment
 */
function calculateSectorMultiplier(context: EngineExecutionContext): number {
  try {
    const sector = detectProjectSector(context);
    const coefficient = getSectorCoefficient(sector);

    if (!coefficient) {
      warn(`[AdaptiveScoring] No coefficient found for sector: ${sector}`);
      return 1.0; // No adjustment
    }

    // Apply complexity multiplier
    // Score increases with higher complexity (up to a limit)
    // Multiplier effect: 1.0 = no change, 1.2 = +20%, etc.
    const multiplier = Math.min(coefficient.complexityMultiplier, 1.5); // Cap at 1.5x

    log(`[AdaptiveScoring] Sector multiplier for ${sector}:`, multiplier);
    return multiplier;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    warn(`[AdaptiveScoring] Error calculating sector multiplier: ${errorMessage}`);
    return 1.0;
  }
}

/**
 * Calculate risk multiplier adjustment
 */
function calculateRiskMultiplier(context: EngineExecutionContext): number {
  try {
    let riskMultiplier = 1.0;
    const riskFactors: string[] = [];

    // Check enterprise strength
    const enterpriseScore = (context.enterprise as any)?.score || 50;
    if (enterpriseScore < 30) {
      riskMultiplier *= 0.85; // Reduce by 15% if enterprise too weak
      riskFactors.push('weak_enterprise');
    } else if (enterpriseScore < 50) {
      riskMultiplier *= 0.92; // Reduce by 8% if enterprise medium-weak
      riskFactors.push('medium_enterprise_risk');
    }

    // Check for urgent timeline (inferred from context)
    const createdAt = (context as any)?.bridgeMetadata?.loadedAt;
    if (createdAt) {
      // If quote was very recent or marked as urgent
      const daysOld = Math.floor(
        (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysOld === 0) {
        // Same day submission might indicate urgency
        riskMultiplier *= 0.95; // Small penalty for urgency
        riskFactors.push('urgent_submission');
      }
    }

    // Check for geographic risk
    const department = (context as any)?.geography?.department;
    if (!department) {
      riskMultiplier *= 0.97; // Slight penalty if no geographic info
      riskFactors.push('missing_geographic_data');
    }

    log(`[AdaptiveScoring] Risk multiplier: ${riskMultiplier}, factors:`, riskFactors);
    return Math.max(riskMultiplier, 0.5); // Don't reduce below 50%
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    warn(`[AdaptiveScoring] Error calculating risk multiplier: ${errorMessage}`);
    return 1.0;
  }
}

/**
 * Calculate normative rule penalties
 */
function calculateNormativePenalty(context: EngineExecutionContext): number {
  try {
    const lots = (context.lots as any)?.normalizedLots || [];
    const violations: string[] = [];
    let totalPenalty = 0;

    // Check each normative rule
    TORP_KNOWLEDGE_CORE.normativeRules.forEach((rule) => {
      // Check if this rule applies to any of the project's lots
      const applicable = rule.relatedLots.some((ruleLot) =>
        lots.some((projectLot: any) => projectLot.type === ruleLot)
      );

      if (!applicable) {
        return; // Rule doesn't apply to this project
      }

      // Check if critical rule is violated
      if (rule.severity === 'critical') {
        // Check if required documents are mentioned in context
        const hasDocumentation = rule.requiredDocuments?.some((doc) => {
          const contextStr = JSON.stringify(context).toLowerCase();
          return contextStr.includes(doc.toLowerCase());
        });

        if (!hasDocumentation) {
          // Critical requirement not met
          violations.push(rule.id);
          totalPenalty += 10; // -10 points per critical violation
          log(`[AdaptiveScoring] Critical violation: ${rule.label}`);
        }
      } else if (rule.severity === 'high') {
        // High severity: smaller penalty if missing
        const hasDocumentation = rule.requiredDocuments?.some((doc) => {
          const contextStr = JSON.stringify(context).toLowerCase();
          return contextStr.includes(doc.toLowerCase());
        });

        if (!hasDocumentation) {
          violations.push(rule.id);
          totalPenalty += 5; // -5 points per high violation
          log(`[AdaptiveScoring] High severity violation: ${rule.label}`);
        }
      }
    });

    log(`[AdaptiveScoring] Normative penalty: ${totalPenalty}, violations:`, violations);
    return totalPenalty;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    warn(`[AdaptiveScoring] Error calculating normative penalty: ${errorMessage}`);
    return 0;
  }
}

/**
 * Calculate pricing penalty
 */
function calculatePricingPenalty(context: EngineExecutionContext): number {
  try {
    const totalAmount = (context.pricing as any)?.totalAmount || 0;
    const lots = (context.lots as any)?.normalizedLots || [];
    const violations: string[] = [];
    let totalPenalty = 0;

    if (!totalAmount || totalAmount <= 0) {
      return 0; // No pricing data
    }

    // Check pricing for each lot type
    const lotTypes = new Set(lots.map((lot: any) => lot.type));
    const region = (context as any)?.geography?.region || 'Province';

    lotTypes.forEach((lotType) => {
      try {
        const reference = getPricingReference(lotType as string, region);

        if (!reference) {
          return; // No reference for this lot type
        }

        // Calculate average price per unit if we have reference
        const lotCount = lots.filter((l: any) => l.type === lotType).length;
        const avgPriceForLot = totalAmount / lotCount;

        // Check if price is outside acceptable range
        if (reference.minPricePerUnit && reference.maxPricePerUnit) {
          if (avgPriceForLot < reference.minPricePerUnit * 0.7) {
            // Price is severely below minimum
            violations.push(`${lotType}_below_minimum`);
            totalPenalty += 10; // -10 points for severe underpricing
            log(
              `[AdaptiveScoring] Severe underpricing for ${lotType}: €${avgPriceForLot} vs €${reference.minPricePerUnit}-${reference.maxPricePerUnit}`
            );
          } else if (avgPriceForLot < reference.minPricePerUnit) {
            // Price is below minimum but not severely
            violations.push(`${lotType}_below_min_moderate`);
            totalPenalty += 5; // -5 points for moderate underpricing
          } else if (avgPriceForLot > reference.maxPricePerUnit * 1.5) {
            // Price is severely above maximum
            violations.push(`${lotType}_above_maximum`);
            totalPenalty += 7; // -7 points for severe overpricing
            log(
              `[AdaptiveScoring] Severe overpricing for ${lotType}: €${avgPriceForLot} vs €${reference.minPricePerUnit}-${reference.maxPricePerUnit}`
            );
          }
        }
      } catch (error) {
        // Continue with next lot type
        warn(`[AdaptiveScoring] Error checking pricing for ${lotType}`);
      }
    });

    log(`[AdaptiveScoring] Pricing penalty: ${totalPenalty}, violations:`, violations);
    return totalPenalty;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    warn(`[AdaptiveScoring] Error calculating pricing penalty: ${errorMessage}`);
    return 0;
  }
}

/**
 * Main adaptive scoring engine function
 */
export async function runAdaptiveScoringEngine(
  executionContext: EngineExecutionContext
): Promise<AdaptiveScoringResult> {
  try {
    log('[AdaptiveScoring] Starting adaptive scoring');

    // Step 1: Get base score
    const baseScore = getBaseScore(executionContext);
    log(`[AdaptiveScoring] Base score: ${baseScore}`);

    // Step 2: Calculate adjustments
    const sectorMultiplier = calculateSectorMultiplier(executionContext);
    const riskMultiplier = calculateRiskMultiplier(executionContext);
    const normativePenalty = calculateNormativePenalty(executionContext);
    const pricingPenalty = calculatePricingPenalty(executionContext);

    // Step 3: Calculate adjusted score
    let adjustedScore = baseScore * sectorMultiplier * riskMultiplier - normativePenalty - pricingPenalty;

    // Step 4: Ensure score stays within bounds
    adjustedScore = Math.max(0, Math.min(100, adjustedScore));

    // Step 5: Calculate adjustment details
    const adjustmentRatio = baseScore > 0 ? adjustedScore / baseScore : 1.0;

    const result: AdaptiveScoringResult = {
      baseScore,
      adjustedScore,
      adjustmentBreakdown: {
        sectorMultiplier,
        riskMultiplier,
        normativePenalty: normativePenalty > 0 ? normativePenalty : undefined,
        pricingPenalty: pricingPenalty > 0 ? pricingPenalty : undefined,
      },
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        rationale: `Adjusted from ${baseScore.toFixed(1)} to ${adjustedScore.toFixed(1)} (${(adjustmentRatio * 100).toFixed(1)}%) based on sector (${sectorMultiplier.toFixed(2)}x), risk (${riskMultiplier.toFixed(2)}x), norms (-${normativePenalty}), and pricing (-${pricingPenalty})`,
      },
    };

    // Step 6: Enrich execution context
    (executionContext as any).adaptiveScore = result;

    log(`[AdaptiveScoring] Adaptive scoring complete`, {
      baseScore,
      adjustedScore,
      change: adjustedScore - baseScore,
      changePercent: ((adjustedScore - baseScore) / baseScore) * 100,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AdaptiveScoring] Engine execution failed:', errorMessage);

    // Return fallback result
    const baseScore = getBaseScore(executionContext);
    return {
      baseScore,
      adjustedScore: baseScore,
      adjustmentBreakdown: {},
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        rationale: 'Error in adaptive scoring, returning base score',
      },
    };
  }
}

/**
 * Format adaptive scoring result as text
 */
export function formatAdaptiveScoringResultAsText(result: AdaptiveScoringResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════',
    'Adaptive Scoring Result',
    '═══════════════════════════════════════════════',
    '',
    `Base Score:    ${result.baseScore.toFixed(1)}`,
    `Adjusted Score: ${result.adjustedScore.toFixed(1)}`,
    `Change: ${((result.adjustedScore - result.baseScore) / result.baseScore * 100).toFixed(1)}%`,
    '',
    '─ Adjustment Breakdown ─',
  ];

  if (result.adjustmentBreakdown.sectorMultiplier !== undefined) {
    lines.push(`Sector Multiplier:  ${result.adjustmentBreakdown.sectorMultiplier.toFixed(3)}x`);
  }

  if (result.adjustmentBreakdown.riskMultiplier !== undefined) {
    lines.push(`Risk Multiplier:    ${result.adjustmentBreakdown.riskMultiplier.toFixed(3)}x`);
  }

  if (result.adjustmentBreakdown.normativePenalty !== undefined && result.adjustmentBreakdown.normativePenalty > 0) {
    lines.push(`Normative Penalty:  -${result.adjustmentBreakdown.normativePenalty}`);
  }

  if (result.adjustmentBreakdown.pricingPenalty !== undefined && result.adjustmentBreakdown.pricingPenalty > 0) {
    lines.push(`Pricing Penalty:    -${result.adjustmentBreakdown.pricingPenalty}`);
  }

  lines.push('');
  lines.push('─ Metadata ─');
  lines.push(`Version: ${result.metadata.version}`);
  lines.push(`Created: ${result.metadata.createdAt}`);

  if (result.metadata.rationale) {
    lines.push('');
    lines.push('─ Rationale ─');
    lines.push(result.metadata.rationale);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Get engine metadata
 */
export function getAdaptiveScoringMetadata(): Record<string, any> {
  return {
    name: 'Adaptive Scoring Engine',
    version: '1.0',
    purpose: 'Apply context-aware scoring adjustments using TORP Knowledge Core',
    executionOrder: 'After GlobalScoringEngine, before TrustCappingEngine',
    capabilities: {
      sectorAdjustment: true,
      riskAdjustment: true,
      normativeValidation: true,
      pricingValidation: true,
      contextEnrichment: true,
    },
    adjustmentFactors: {
      sector: 'Complexity multiplier per sector (1.0-1.5x)',
      risk: 'Risk reduction multiplier (0.5-1.0x)',
      normative: 'Penalty points for regulatory violations',
      pricing: 'Penalty points for market anomalies',
    },
    constraints: {
      noEngineModification: true,
      noScoringLogicChange: true,
      purelyAdditive: true,
      outputScoreRange: [0, 100],
    },
  };
}
