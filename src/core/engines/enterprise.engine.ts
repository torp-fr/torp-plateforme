/**
 * Enterprise Engine v1.0
 * Evaluate structural reliability of the enterprise
 * Pure rule-based scoring - no external APIs
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';

/**
 * Enterprise breakdown scores
 */
export interface EnterpriseBreakdown {
  longevityScore: number;      // 0-5: Enterprise age/maturity
  insuranceScore: number;      // 0-5: Insurance coverage
  certificationsScore: number; // 0-5: Professional certifications
  structureScore: number;      // 0-5: Legal structure
  consistencyScore: number;    // 0-5: Project consistency
}

/**
 * Enterprise Engine Result
 */
export interface EnterpriseEngineResult {
  enterpriseScore: number;  // 0-25 raw
  breakdown: EnterpriseBreakdown;
  normalizedScore: number;  // 0-25 normalized
  meta: {
    engineVersion: string;
    createdAt: string;
  };
}

/**
 * Calculate longevity score based on enterprise age
 */
function calculateLongevityScore(context: EngineExecutionContext): number {
  try {
    const enterpriseAge = context.context?.enterpriseAge || null;

    if (typeof enterpriseAge === 'number') {
      if (enterpriseAge > 5) return 5;
      if (enterpriseAge > 2) return 3;
      return 1;
    }

    // No data = neutral
    return 2;
  } catch (error) {
    console.warn('[EnterpriseEngine] Error calculating longevity score', error);
    return 0;
  }
}

/**
 * Calculate insurance score
 */
function calculateInsuranceScore(context: EngineExecutionContext): number {
  try {
    const insuranceDeclared = context.context?.insuranceCovered === true;
    return insuranceDeclared ? 5 : 0;
  } catch (error) {
    console.warn('[EnterpriseEngine] Error calculating insurance score', error);
    return 0;
  }
}

/**
 * Calculate certifications score
 */
function calculateCertificationsScore(context: EngineExecutionContext): number {
  try {
    const certifications = context.context?.certifications || [];
    if (Array.isArray(certifications) && certifications.length > 0) {
      return 5;
    }
    return 0;
  } catch (error) {
    console.warn('[EnterpriseEngine] Error calculating certifications score', error);
    return 0;
  }
}

/**
 * Calculate legal structure score
 */
function calculateStructureScore(context: EngineExecutionContext): number {
  try {
    const legalStructure = context.context?.legalStructure || null;

    if (legalStructure && typeof legalStructure === 'string' && legalStructure.length > 0) {
      return 5;
    }

    return 2; // Partial score for unclear structure
  } catch (error) {
    console.warn('[EnterpriseEngine] Error calculating structure score', error);
    return 0;
  }
}

/**
 * Calculate consistency score
 */
function calculateConsistencyScore(context: EngineExecutionContext): number {
  try {
    const totalAmount = context.projectData?.totalAmount || 0;
    const lotsCount = context.lots?.normalizedLots?.length || 0;

    if (!totalAmount || !lotsCount) {
      return 2; // Partial score for missing data
    }

    // Check if amount is coherent with complexity
    const avgAmountPerLot = totalAmount / lotsCount;

    // Heuristic: if average per lot is reasonable (>100), consistency is good
    if (avgAmountPerLot > 100) {
      return 5;
    }

    if (avgAmountPerLot > 50) {
      return 3;
    }

    return 1;
  } catch (error) {
    console.warn('[EnterpriseEngine] Error calculating consistency score', error);
    return 0;
  }
}

/**
 * Run Enterprise Engine
 */
export async function runEnterpriseEngine(
  executionContext: EngineExecutionContext
): Promise<EnterpriseEngineResult> {
  const startTime = Date.now();

  try {
    console.log('[EnterpriseEngine] Starting enterprise evaluation');

    // Calculate individual scores
    const longevityScore = calculateLongevityScore(executionContext);
    const insuranceScore = calculateInsuranceScore(executionContext);
    const certificationsScore = calculateCertificationsScore(executionContext);
    const structureScore = calculateStructureScore(executionContext);
    const consistencyScore = calculateConsistencyScore(executionContext);

    // Calculate raw total
    const enterpriseScore = longevityScore + insuranceScore + certificationsScore + structureScore + consistencyScore;

    // Normalize to 0-25
    const normalizedScore = Math.min(Math.max(enterpriseScore, 0), 25);

    const result: EnterpriseEngineResult = {
      enterpriseScore,
      breakdown: {
        longevityScore,
        insuranceScore,
        certificationsScore,
        structureScore,
        consistencyScore,
      },
      normalizedScore,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
      },
    };

    console.log('[EnterpriseEngine] Evaluation complete', {
      enterpriseScore: result.enterpriseScore,
      normalizedScore: result.normalizedScore,
      processingTime: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    console.error('[EnterpriseEngine] Unexpected error', error);

    // Return fallback result
    return {
      enterpriseScore: 0,
      breakdown: {
        longevityScore: 0,
        insuranceScore: 0,
        certificationsScore: 0,
        structureScore: 0,
        consistencyScore: 0,
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
 * Get Enterprise Engine metadata
 */
export function getEnterpriseEngineMetadata() {
  return {
    id: 'enterpriseEngine',
    name: 'Enterprise Engine',
    version: '1.0',
    description: 'Evaluate structural reliability of the enterprise',
    scoringMaximum: 25,
    breakdown: {
      longevityScore: { max: 5, description: 'Enterprise age and maturity' },
      insuranceScore: { max: 5, description: 'Insurance coverage' },
      certificationsScore: { max: 5, description: 'Professional certifications' },
      structureScore: { max: 5, description: 'Legal structure' },
      consistencyScore: { max: 5, description: 'Project amount coherence' },
    },
  };
}
