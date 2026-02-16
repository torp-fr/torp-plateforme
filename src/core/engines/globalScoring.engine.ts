/**
 * Global Scoring Engine v1.0
 * Combine all scoring pillars into final weighted TORP score
 * Pure arithmetic combination of weighted pillars
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';

/**
 * Global Scoring Result
 */
export interface GlobalScoringEngineResult {
  complianceWeighted: number;  // 35% weight
  enterpriseWeighted: number;  // 25% weight
  pricingWeighted: number;     // 20% weight
  qualityWeighted: number;     // 20% weight
  weightedScore: number;       // Final 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  meta: {
    engineVersion: string;
    createdAt: string;
    weights: {
      compliance: number;
      enterprise: number;
      pricing: number;
      quality: number;
    };
  };
}

/**
 * Map score to grade
 */
function mapScoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

/**
 * Calculate compliance score from context
 * Extracted from existing scoring engine results
 */
function extractComplianceScore(context: EngineExecutionContext): number {
  try {
    // Use global score from audit if available
    const auditGlobalScore = context.audit?.globalScore || 0;

    if (auditGlobalScore > 0) {
      return auditGlobalScore;
    }

    // Fallback: calculate from severity breakdown
    const severityBreakdown = context.rules?.severityBreakdown || {};
    const critical = severityBreakdown['critical'] || 0;
    const high = severityBreakdown['high'] || 0;
    const medium = severityBreakdown['medium'] || 0;
    const low = severityBreakdown['low'] || 0;

    const total = critical + high + medium + low;

    if (total === 0) {
      return 50; // Neutral
    }

    // Penalize for critical/high
    const penaltyPoints = critical * 20 + high * 10 + medium * 5;
    const baseScore = 100 - penaltyPoints;

    return Math.max(0, Math.min(100, baseScore));
  } catch (error) {
    console.warn('[GlobalScoringEngine] Error extracting compliance score', error);
    return 50;
  }
}

/**
 * Extract enterprise score
 */
function extractEnterpriseScore(context: EngineExecutionContext): number {
  try {
    const enterpriseNormalized = context.enterprise?.normalizedScore || 0;
    return enterpriseNormalized;
  } catch (error) {
    console.warn('[GlobalScoringEngine] Error extracting enterprise score', error);
    return 0;
  }
}

/**
 * Extract pricing score
 */
function extractPricingScore(context: EngineExecutionContext): number {
  try {
    const pricingNormalized = context.pricing?.normalizedScore || 0;
    return pricingNormalized;
  } catch (error) {
    console.warn('[GlobalScoringEngine] Error extracting pricing score', error);
    return 0;
  }
}

/**
 * Extract quality score
 */
function extractQualityScore(context: EngineExecutionContext): number {
  try {
    const qualityNormalized = context.quality?.normalizedScore || 0;
    return qualityNormalized;
  } catch (error) {
    console.warn('[GlobalScoringEngine] Error extracting quality score', error);
    return 0;
  }
}

/**
 * Run Global Scoring Engine
 */
export async function runGlobalScoringEngine(
  executionContext: EngineExecutionContext
): Promise<GlobalScoringEngineResult> {
  const startTime = Date.now();

  try {
    console.log('[GlobalScoringEngine] Starting global scoring');

    // Extract individual pillar scores
    const complianceScore = extractComplianceScore(executionContext);
    const enterpriseScore = extractEnterpriseScore(executionContext);
    const pricingScore = extractPricingScore(executionContext);
    const qualityScore = extractQualityScore(executionContext);

    // Define weights (must sum to 1.0)
    const weights = {
      compliance: 0.35,
      enterprise: 0.25,
      pricing: 0.2,
      quality: 0.2,
    };

    // Calculate weighted scores
    const complianceWeighted = complianceScore * weights.compliance;
    const enterpriseWeighted = enterpriseScore * weights.enterprise;
    const pricingWeighted = pricingScore * weights.pricing;
    const qualityWeighted = qualityScore * weights.quality;

    // Calculate final weighted score
    const weightedScore =
      complianceWeighted + enterpriseWeighted + pricingWeighted + qualityWeighted;

    // Map to grade
    const grade = mapScoreToGrade(weightedScore);

    const result: GlobalScoringEngineResult = {
      complianceWeighted,
      enterpriseWeighted,
      pricingWeighted,
      qualityWeighted,
      weightedScore: Math.round(weightedScore * 10) / 10, // Round to 1 decimal
      grade,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        weights,
      },
    };

    console.log('[GlobalScoringEngine] Global scoring complete', {
      complianceScore,
      enterpriseScore,
      pricingScore,
      qualityScore,
      weightedScore: result.weightedScore,
      grade,
      processingTime: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    console.error('[GlobalScoringEngine] Unexpected error', error);

    // Return fallback result
    return {
      complianceWeighted: 0,
      enterpriseWeighted: 0,
      pricingWeighted: 0,
      qualityWeighted: 0,
      weightedScore: 0,
      grade: 'E',
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        weights: {
          compliance: 0.35,
          enterprise: 0.25,
          pricing: 0.2,
          quality: 0.2,
        },
      },
    };
  }
}

/**
 * Get Global Scoring Engine metadata
 */
export function getGlobalScoringEngineMetadata() {
  return {
    id: 'globalScoringEngine',
    name: 'Global Scoring Engine',
    version: '1.0',
    description: 'Combine all scoring pillars into final weighted TORP score',
    scoringMaximum: 100,
    pillars: {
      compliance: {
        weight: 0.35,
        description: 'Regulatory and compliance evaluation',
        maxScore: 100,
      },
      enterprise: {
        weight: 0.25,
        description: 'Enterprise structural reliability',
        maxScore: 25,
      },
      pricing: {
        weight: 0.2,
        description: 'Pricing coherence',
        maxScore: 20,
      },
      quality: {
        weight: 0.2,
        description: 'Professional quality',
        maxScore: 20,
      },
    },
    weights: {
      compliance: 0.35,
      enterprise: 0.25,
      pricing: 0.2,
      quality: 0.2,
      total: 1.0,
    },
    gradeMapping: {
      A: 'GTE 90 - Exceptional',
      B: 'GTE 75 - Good',
      C: 'GTE 60 - Satisfactory',
      D: 'GTE 40 - Poor',
      E: 'LT 40 - Critical',
    },
    formula:
      'weightedScore = (compliance * 0.35) + (enterprise * 0.25) + (pricing * 0.20) + (quality * 0.20)',
  };
}

/**
 * Explain global score calculation
 */
export function explainGlobalScore(result: GlobalScoringEngineResult): string {
  const explanation = `
GLOBAL SCORING CALCULATION
=========================

Compliance Pillar (35%):
  Score: ${result.complianceWeighted.toFixed(2)} (from compliance evaluation)

Enterprise Pillar (25%):
  Score: ${result.enterpriseWeighted.toFixed(2)} (structural reliability)

Pricing Pillar (20%):
  Score: ${result.pricingWeighted.toFixed(2)} (pricing coherence)

Quality Pillar (20%):
  Score: ${result.qualityWeighted.toFixed(2)} (professional quality)

---
FINAL WEIGHTED SCORE: ${result.weightedScore.toFixed(1)}/100
GRADE: ${result.grade}

Grade Interpretation:
A (90+) - Exceptional quality and compliance
B (75+) - Good quality with manageable issues
C (60+) - Satisfactory with noted concerns
D (40+) - Poor with significant issues
E (<40) - Critical requiring intervention
  `;

  return explanation.trim();
}
