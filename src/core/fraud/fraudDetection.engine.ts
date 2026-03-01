/**
 * Fraud Detection Engine v1.0
 * Identifies suspicious behaviors and critical incoherences using Knowledge Core + Adaptive Scoring
 * Executes AFTER StructuralConsistencyEngine without modifying any existing scores or logic
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { TORP_KNOWLEDGE_CORE } from '@/core/knowledge/knowledgeRegistry';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Risk indicator flags
 */
export interface RiskIndicators {
  pricingRisk: boolean; // Pricing anomalies detected
  complianceRisk: boolean; // Regulatory non-compliance
  enterpriseRisk: boolean; // Enterprise strength mismatch
  structuralRisk: boolean; // Structural incoherences
}

/**
 * Fraud detection result
 */
export interface FraudDetectionResult {
  fraudScore: number; // 0-100 risk level
  fraudLevel: 'low' | 'moderate' | 'high' | 'critical';
  detectedPatterns: string[]; // Pattern IDs and descriptions
  riskIndicators: RiskIndicators;
  metadata: {
    version: string;
    createdAt: string;
    rationale?: string;
  };
}

/**
 * Check pricing fraud patterns
 */
function checkPricingFraud(context: EngineExecutionContext): { score: number; patterns: string[] } {
  try {
    const patterns: string[] = [];
    let fraudScore = 0;

    // Get adaptive scoring penalty
    const adaptiveScore = (context as any)?.adaptiveScore;
    const pricingPenalty = adaptiveScore?.adjustmentBreakdown?.pricingPenalty || 0;

    // Check for severe underpricing
    if (pricingPenalty >= 10) {
      // Severe underpricing detected
      fraudScore += 30;
      patterns.push('fraud_001_severe_underpricing');
      log('[FraudDetection] Severe underpricing detected (+30)');
    } else if (pricingPenalty >= 5) {
      // Moderate underpricing
      fraudScore += 15;
      patterns.push('fraud_pricing_moderate');
      log('[FraudDetection] Moderate underpricing detected (+15)');
    }

    // Check for extreme overpricing
    const totalAmount = (context.pricing as any)?.totalAmount || 0;
    const lotCount = (context.lots as any)?.normalizedLots?.length || 1;
    const avgPrice = totalAmount / lotCount;

    // If price seems unreasonably high for the work
    if (avgPrice > 10000) {
      // Very expensive per-lot average
      fraudScore += 15;
      patterns.push('fraud_extreme_overpricing');
      log('[FraudDetection] Extreme overpricing detected (+15)');
    }

    // Check for repeated pricing anomalies
    if (pricingPenalty >= 15) {
      // Multiple pricing issues
      const hasCriticalLots = (context.lots as any)?.normalizedLots?.some((lot: any) =>
        ['gros_oeuvre', 'demolition', 'toiture', 'charpente'].includes(lot.type)
      );

      if (hasCriticalLots) {
        // Pricing anomaly on critical lots
        fraudScore += 20;
        patterns.push('fraud_critical_lot_pricing_anomaly');
        log('[FraudDetection] Pricing anomaly on critical lots (+20)');
      }
    }

    return { score: fraudScore, patterns };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    warn(`[FraudDetection] Error in pricing check: ${errorMessage}`);
    return { score: 0, patterns: [] };
  }
}

/**
 * Check compliance fraud patterns
 */
function checkComplianceFraud(context: EngineExecutionContext): { score: number; patterns: string[] } {
  try {
    const patterns: string[] = [];
    let fraudScore = 0;

    // Get normative penalty from adaptive scoring
    const adaptiveScore = (context as any)?.adaptiveScore;
    const normativePenalty = adaptiveScore?.adjustmentBreakdown?.normativePenalty || 0;

    // High normative penalty = compliance fraud risk
    if (normativePenalty >= 20) {
      // Multiple critical violations
      fraudScore += 40;
      patterns.push('fraud_high_compliance_violation');
      log('[FraudDetection] High compliance violation detected (+40)');
    } else if (normativePenalty >= 10) {
      // Some critical violations
      fraudScore += 25;
      patterns.push('fraud_compliance_violation');
      log('[FraudDetection] Compliance violation detected (+25)');
    } else if (normativePenalty >= 5) {
      // Minor violations
      fraudScore += 10;
      patterns.push('fraud_minor_compliance_issue');
      log('[FraudDetection] Minor compliance issue detected (+10)');
    }

    // Check for blocking obligation + high grade mismatch
    const obligations = (context.rules as any)?.uniqueDetailedObligations || [];
    const hasBlockingObligation = obligations.some((o: any) =>
      ['ELEC_NFC15100', 'ELEC_DECLARATION', 'ASBESTOS'].includes(o.type)
    );

    const finalGrade = (context as any)?.finalProfessionalGrade || 'E';
    if (hasBlockingObligation && ['A', 'B'].includes(finalGrade)) {
      // Blocking obligation but high grade = suspicious
      fraudScore += 20;
      patterns.push('fraud_blocking_obligation_mismatch');
      log('[FraudDetection] Blocking obligation + high grade mismatch (+20)');
    }

    // Check for critical incoherences
    const consistencyScore = (context as any)?.structuralConsistency?.consistencyScore || 100;
    const flagsDetected = (context as any)?.structuralConsistency?.flagsDetected || [];

    if (consistencyScore < 40) {
      // Very low consistency score
      fraudScore += 30;
      patterns.push('fraud_critical_incoherence');
      log('[FraudDetection] Critical incoherence detected (+30)');
    } else if (consistencyScore < 60 && flagsDetected.length >= 3) {
      // Low consistency with multiple flags
      fraudScore += 20;
      patterns.push('fraud_multiple_incoherences');
      log('[FraudDetection] Multiple incoherences detected (+20)');
    }

    return { score: fraudScore, patterns };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    warn(`[FraudDetection] Error in compliance check: ${errorMessage}`);
    return { score: 0, patterns: [] };
  }
}

/**
 * Check enterprise risk patterns
 */
function checkEnterpriseRisk(context: EngineExecutionContext): { score: number; patterns: string[] } {
  try {
    const patterns: string[] = [];
    let fraudScore = 0;

    // Get enterprise score
    const enterpriseScore = (context.enterprise as any)?.score || 50;
    const finalGrade = (context as any)?.finalProfessionalGrade || 'E';

    // Very weak enterprise with high grade = suspicious
    if (enterpriseScore < 30 && ['A', 'B'].includes(finalGrade)) {
      fraudScore += 35;
      patterns.push('fraud_weak_enterprise_high_grade');
      log('[FraudDetection] Weak enterprise + high grade mismatch (+35)');
    } else if (enterpriseScore < 30 && finalGrade === 'C') {
      fraudScore += 20;
      patterns.push('fraud_weak_enterprise');
      log('[FraudDetection] Weak enterprise (+20)');
    } else if (enterpriseScore < 50 && ['A', 'B'].includes(finalGrade)) {
      fraudScore += 15;
      patterns.push('fraud_medium_enterprise_high_grade');
      log('[FraudDetection] Medium enterprise + high grade (+15)');
    }

    // Check sector mismatch
    const sector = (context as any)?.projectData?.sector || 'residential';
    const hasCriticalLots = (context.lots as any)?.normalizedLots?.some((lot: any) =>
      ['gros_oeuvre', 'demolition', 'toiture'].includes(lot.type)
    );

    if (
      enterpriseScore < 40 &&
      hasCriticalLots &&
      ['industrial', 'heritage', 'public'].includes(sector.toLowerCase())
    ) {
      // Weak enterprise on critical work in complex sector
      fraudScore += 20;
      patterns.push('fraud_enterprise_sector_mismatch');
      log('[FraudDetection] Enterprise-sector mismatch detected (+20)');
    }

    // Check for new enterprise (< 2 years) with no insurance
    const yearsInBusiness = (context.enterprise as any)?.summary?.yearsInBusiness || 0;
    const hasInsurance = (context.enterprise as any)?.summary?.hasInsurance || false;

    if (yearsInBusiness < 2 && !hasInsurance && hasCriticalLots) {
      // New, uninsured enterprise on critical work
      fraudScore += 25;
      patterns.push('fraud_new_uninsured_critical_work');
      log('[FraudDetection] New uninsured enterprise on critical work (+25)');
    }

    return { score: fraudScore, patterns };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    warn(`[FraudDetection] Error in enterprise check: ${errorMessage}`);
    return { score: 0, patterns: [] };
  }
}

/**
 * Check structural incoherence patterns
 */
function checkStructuralIncoherence(context: EngineExecutionContext): { score: number; patterns: string[] } {
  try {
    const patterns: string[] = [];
    let fraudScore = 0;

    // Use Phase 23.2 structural consistency results
    const consistencyScore = (context as any)?.structuralConsistency?.consistencyScore || 100;
    const flagsDetected = (context as any)?.structuralConsistency?.flagsDetected || [];
    const imbalanceDetected = (context as any)?.structuralConsistency?.imbalanceDetected || false;

    // Critical structural issues
    if (consistencyScore < 40) {
      fraudScore += 35;
      patterns.push('fraud_critical_structural_issue');
      log('[FraudDetection] Critical structural issue (+35)');
    } else if (consistencyScore < 60) {
      fraudScore += 20;
      patterns.push('fraud_structural_incoherence');
      log('[FraudDetection] Structural incoherence (+20)');
    }

    // Multiple flag detection
    if (flagsDetected.length >= 4) {
      fraudScore += 25;
      patterns.push('fraud_multiple_red_flags');
      log('[FraudDetection] Multiple red flags detected (+25)');
    } else if (flagsDetected.length >= 2 && imbalanceDetected) {
      fraudScore += 15;
      patterns.push('fraud_multiple_imbalances');
      log('[FraudDetection] Multiple imbalances detected (+15)');
    }

    // Check for specific high-risk patterns
    const hasEnterpriseRiskMismatch = flagsDetected.includes('enterpriseRiskMismatch');
    const hasPricingQualityMismatch = flagsDetected.includes('pricingQualityMismatch');
    const hasCriticalLotWeakness = flagsDetected.includes('criticalLotEnterpriseWeakness');

    if (hasEnterpriseRiskMismatch && hasPricingQualityMismatch && hasCriticalLotWeakness) {
      // Multiple correlated red flags = high fraud risk
      fraudScore += 20;
      patterns.push('fraud_correlated_red_flags');
      log('[FraudDetection] Correlated red flags detected (+20)');
    }

    return { score: fraudScore, patterns };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    warn(`[FraudDetection] Error in structural check: ${errorMessage}`);
    return { score: 0, patterns: [] };
  }
}

/**
 * Determine fraud level from score
 */
function getFraudLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

/**
 * Main fraud detection engine function
 */
export async function runFraudDetectionEngine(
  executionContext: EngineExecutionContext
): Promise<FraudDetectionResult> {
  try {
    log('[FraudDetection] Starting fraud detection analysis');

    // Initialize tracking
    let totalFraudScore = 0;
    const allPatterns: string[] = [];

    // Check 1: Pricing fraud
    const pricingCheck = checkPricingFraud(executionContext);
    totalFraudScore += pricingCheck.score;
    allPatterns.push(...pricingCheck.patterns);

    // Check 2: Compliance fraud
    const complianceCheck = checkComplianceFraud(executionContext);
    totalFraudScore += complianceCheck.score;
    allPatterns.push(...complianceCheck.patterns);

    // Check 3: Enterprise risk
    const enterpriseCheck = checkEnterpriseRisk(executionContext);
    totalFraudScore += enterpriseCheck.score;
    allPatterns.push(...enterpriseCheck.patterns);

    // Check 4: Structural incoherence
    const structuralCheck = checkStructuralIncoherence(executionContext);
    totalFraudScore += structuralCheck.score;
    allPatterns.push(...structuralCheck.patterns);

    // Bound fraud score to [0, 100]
    totalFraudScore = Math.max(0, Math.min(100, totalFraudScore));

    // Determine fraud level
    const fraudLevel = getFraudLevel(totalFraudScore);

    // Build risk indicators
    const riskIndicators: RiskIndicators = {
      pricingRisk: pricingCheck.score > 0,
      complianceRisk: complianceCheck.score > 0,
      enterpriseRisk: enterpriseCheck.score > 0,
      structuralRisk: structuralCheck.score > 0,
    };

    // Build result
    const result: FraudDetectionResult = {
      fraudScore: totalFraudScore,
      fraudLevel,
      detectedPatterns: allPatterns,
      riskIndicators,
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        rationale: `Fraud analysis complete. Score: ${totalFraudScore}/100 (${fraudLevel}). ${allPatterns.length} pattern(s) detected. Pricing: ${pricingCheck.score}, Compliance: ${complianceCheck.score}, Enterprise: ${enterpriseCheck.score}, Structural: ${structuralCheck.score}`,
      },
    };

    // Enrich execution context
    (executionContext as any).fraudDetection = result;

    log('[FraudDetection] Fraud detection complete', {
      fraudScore: totalFraudScore,
      fraudLevel,
      patternCount: allPatterns.length,
      riskIndicators,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FraudDetection] Engine execution failed:', errorMessage);

    // Return safe fallback result
    return {
      fraudScore: 0,
      fraudLevel: 'low',
      detectedPatterns: [],
      riskIndicators: {
        pricingRisk: false,
        complianceRisk: false,
        enterpriseRisk: false,
        structuralRisk: false,
      },
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        rationale: 'Error in fraud detection, returning safe baseline',
      },
    };
  }
}

/**
 * Format fraud detection result as text
 */
export function formatFraudDetectionResultAsText(result: FraudDetectionResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════',
    'Fraud Detection Analysis',
    '═══════════════════════════════════════════════',
    '',
    `Fraud Score: ${result.fraudScore}/100`,
    `Fraud Level: ${result.fraudLevel.toUpperCase()}`,
    '',
    '─ Risk Indicators ─',
    `Pricing Risk:      ${result.riskIndicators.pricingRisk ? '🚩 YES' : '✓ No'}`,
    `Compliance Risk:   ${result.riskIndicators.complianceRisk ? '🚩 YES' : '✓ No'}`,
    `Enterprise Risk:   ${result.riskIndicators.enterpriseRisk ? '🚩 YES' : '✓ No'}`,
    `Structural Risk:   ${result.riskIndicators.structuralRisk ? '🚩 YES' : '✓ No'}`,
    '',
  ];

  if (result.detectedPatterns.length > 0) {
    lines.push('─ Detected Patterns ─');
    result.detectedPatterns.forEach((pattern) => {
      lines.push(`• ${pattern}`);
    });
    lines.push('');
  }

  lines.push('─ Metadata ─');
  lines.push(`Version: ${result.metadata.version}`);
  lines.push(`Created: ${result.metadata.createdAt}`);

  if (result.metadata.rationale) {
    lines.push('');
    lines.push('─ Analysis ─');
    lines.push(result.metadata.rationale);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Get engine metadata
 */
export function getFraudDetectionMetadata(): Record<string, any> {
  return {
    name: 'Fraud Detection Engine',
    version: '1.0',
    purpose: 'Identify suspicious behaviors and critical incoherences',
    executionOrder: 'After StructuralConsistencyEngine (final stage)',
    capabilities: {
      pricingFraudDetection: true,
      complianceFraudDetection: true,
      enterpriseRiskDetection: true,
      structuralIncoherenceDetection: true,
      patternMatching: true,
      contextEnrichment: true,
    },
    fraudLevels: {
      low: '0-24 points',
      moderate: '25-49 points',
      high: '50-74 points',
      critical: '75-100 points',
    },
    constraints: {
      noEngineModification: true,
      noScoringLogicChange: true,
      purelyAdditive: true,
      readOnlyContext: true,
      fraudScoreRange: [0, 100],
    },
  };
}
