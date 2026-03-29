/**
 * Structural Consistency Engine v1.0
 * Detects structural imbalances between TORP model pillars
 * Pure analytical function - zero impact on scoring or grading
 * In-memory analysis with comprehensive diagnostics
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Structural flag - detected imbalance between two pillars
 */
export interface StructuralFlag {
  complianceQualityMismatch: boolean;
  enterpriseRiskMismatch: boolean;
  pricingQualityMismatch: boolean;
  criticalLotEnterpriseWeakness: boolean;
}

/**
 * Structural consistency analysis result
 */
export interface StructuralConsistencyResult {
  imbalanceDetected: boolean;
  consistencyScore: number; // 0-100
  riskPatterns: string[];
  structuralFlags: StructuralFlag;
  metadata: {
    createdAt: string;
    version: string;
  };
}

/**
 * Extract compliance score from execution context
 * Compliance = Global Score / 100 * 100 (normalized)
 */
function getComplianceScore(executionContext: EngineExecutionContext): number {
  try {
    // Compliance is derived from the global score (Phase 21 weighted calculation)
    const globalScore = executionContext.globalScore?.score || 0;
    return Math.min(100, Math.max(0, globalScore));
  } catch {
    return 0;
  }
}

/**
 * Extract enterprise score from execution context
 * Enterprise Engine (Phase 21) produces 0-25 points
 * Normalize to 0-100 scale
 */
function getEnterpriseScore(executionContext: EngineExecutionContext): number {
  try {
    const enterprisePoints = executionContext.enterprise?.score || 0;
    // Enterprise engine produces 0-25 points, normalize to 0-100
    return (enterprisePoints / 25) * 100;
  } catch {
    return 0;
  }
}

/**
 * Extract pricing score from execution context
 * Pricing Engine (Phase 21) produces 0-20 points
 * Normalize to 0-100 scale
 */
function getPricingScore(executionContext: EngineExecutionContext): number {
  try {
    const pricingPoints = executionContext.pricing?.score || 0;
    // Pricing engine produces 0-20 points, normalize to 0-100
    return (pricingPoints / 20) * 100;
  } catch {
    return 0;
  }
}

/**
 * Extract quality score from execution context
 * Quality Engine (Phase 21) produces 0-20 points
 * Normalize to 0-100 scale
 */
function getQualityScore(executionContext: EngineExecutionContext): number {
  try {
    const qualityPoints = executionContext.quality?.score || 0;
    // Quality engine produces 0-20 points, normalize to 0-100
    return (qualityPoints / 20) * 100;
  } catch {
    return 0;
  }
}

/**
 * Extract final professional grade from execution context
 */
function getFinalProfessionalGrade(executionContext: EngineExecutionContext): string {
  try {
    return executionContext.finalProfessionalGrade || 'C';
  } catch {
    return 'C';
  }
}

/**
 * Check if project has critical lots
 */
function hasCriticalLots(executionContext: EngineExecutionContext): boolean {
  try {
    const lots = executionContext.lots?.normalizedLots || [];
    if (!Array.isArray(lots)) return false;

    // Check if any lot has critical criticality
    return lots.some((lot: any) => {
      const lotType = lot.type || '';
      // Critical lot types based on Trust Framework
      const criticalTypes = ['gros_oeuvre', 'charpente', 'toiture', 'facade'];
      return criticalTypes.includes(lotType.toLowerCase());
    });
  } catch {
    return false;
  }
}

/**
 * Rule 1: Compliance vs Quality Mismatch
 * High compliance but low quality indicates scoring inconsistency
 */
function checkComplianceQualityMismatch(
  complianceScore: number,
  qualityScore: number
): boolean {
  try {
    return complianceScore >= 75 && qualityScore < 40;
  } catch {
    return false;
  }
}

/**
 * Rule 2: Enterprise vs Final Grade Mismatch
 * Weak enterprise profile contradicts high grade
 */
function checkEnterpriseRiskMismatch(
  enterpriseScore: number,
  finalGrade: string
): boolean {
  try {
    const highGrades = ['A', 'B'];
    return enterpriseScore < 30 && highGrades.includes(finalGrade);
  } catch {
    return false;
  }
}

/**
 * Rule 3: Pricing vs Quality Mismatch
 * Low pricing but high quality is structurally inconsistent
 */
function checkPricingQualityMismatch(pricingScore: number, qualityScore: number): boolean {
  try {
    return pricingScore < 40 && qualityScore >= 70;
  } catch {
    return false;
  }
}

/**
 * Rule 4: Critical Lot Enterprise Weakness
 * Critical lots require strong enterprise profile
 */
function checkCriticalLotEnterpriseWeakness(
  hasCritical: boolean,
  enterpriseScore: number
): boolean {
  try {
    return hasCritical && enterpriseScore < 40;
  } catch {
    return false;
  }
}

/**
 * Calculate consistency score from structural flags
 * Base: 100
 * Each flag true: -20 points
 * Min: 0
 */
function calculateConsistencyScore(flags: StructuralFlag): number {
  try {
    let score = 100;
    const flagCount = Object.values(flags).filter((flag) => flag === true).length;
    score -= flagCount * 20;
    return Math.max(0, score);
  } catch {
    return 0;
  }
}

/**
 * Build risk pattern descriptions
 */
function buildRiskPatterns(
  complianceScore: number,
  enterpriseScore: number,
  pricingScore: number,
  qualityScore: number,
  flags: StructuralFlag
): string[] {
  const patterns: string[] = [];

  try {
    if (flags.complianceQualityMismatch) {
      patterns.push(
        `Compliance-Quality Mismatch: Compliance ${complianceScore.toFixed(0)}/100 vs Quality ${qualityScore.toFixed(0)}/100`
      );
    }

    if (flags.enterpriseRiskMismatch) {
      patterns.push(
        `Enterprise-Grade Mismatch: Enterprise profile ${enterpriseScore.toFixed(0)}/100 contradicts high grade`
      );
    }

    if (flags.pricingQualityMismatch) {
      patterns.push(
        `Pricing-Quality Mismatch: Pricing ${pricingScore.toFixed(0)}/100 inconsistent with Quality ${qualityScore.toFixed(0)}/100`
      );
    }

    if (flags.criticalLotEnterpriseWeakness) {
      patterns.push(
        `Critical Lot Risk: Project has critical lots but Enterprise strength is ${enterpriseScore.toFixed(0)}/100`
      );
    }
  } catch {
    // Safe fallback
  }

  return patterns;
}

/**
 * Format consistency result as text
 */
export function formatConsistencyResultAsText(result: StructuralConsistencyResult): string {
  try {
    const lines: string[] = [
      '=== Structural Consistency Analysis ===',
      `Imbalance Detected: ${result.imbalanceDetected ? 'YES' : 'NO'}`,
      `Consistency Score: ${result.consistencyScore}/100`,
      `Version: ${result.metadata.version}`,
      `Created: ${result.metadata.createdAt}`,
      '',
      '--- Structural Flags ---',
      `Compliance-Quality Mismatch: ${result.structuralFlags.complianceQualityMismatch}`,
      `Enterprise-Grade Mismatch: ${result.structuralFlags.enterpriseRiskMismatch}`,
      `Pricing-Quality Mismatch: ${result.structuralFlags.pricingQualityMismatch}`,
      `Critical Lot Enterprise Weakness: ${result.structuralFlags.criticalLotEnterpriseWeakness}`,
    ];

    if (result.riskPatterns.length > 0) {
      lines.push('', '--- Risk Patterns ---');
      result.riskPatterns.forEach((pattern) => {
        lines.push(`• ${pattern}`);
      });
    }

    return lines.join('\n');
  } catch (error) {
    return 'Unable to format consistency result as text';
  }
}

/**
 * Get Structural Consistency Engine metadata
 */
export function getStructuralConsistencyEngineMetadata(): Record<string, any> {
  return {
    engineName: 'StructuralConsistencyEngine',
    version: '1.0',
    createdAt: '2026-02-16',
    purpose: 'Detect structural imbalances between TORP model pillars',
    rules: {
      complianceQualityMismatch: 'Compliance >= 75 AND Quality < 40',
      enterpriseRiskMismatch: 'Enterprise < 30 AND Grade in [A,B]',
      pricingQualityMismatch: 'Pricing < 40 AND Quality >= 70',
      criticalLotEnterpriseWeakness: 'Critical lots exist AND Enterprise < 40',
    },
    scoringFormula: {
      base: 100,
      perFlagPenalty: 20,
      minimum: 0,
      imbalanceThreshold: 80,
    },
    characteristics: {
      noAlgorithmChanges: true,
      noScoringImpact: true,
      noGradingImpact: true,
      purelyAnalytical: true,
      fullTryCatch: true,
    },
  };
}

/**
 * Main Structural Consistency Engine
 * Analyzes structural balance between TORP pillars
 * Pure analytical - zero impact on scoring or grading
 */
export async function runStructuralConsistencyEngine(
  executionContext: EngineExecutionContext
): Promise<StructuralConsistencyResult> {
  const startTime = new Date().toISOString();

  try {
    log('[StructuralConsistencyEngine] Starting structural analysis');

    // Extract scores from all pillars
    const complianceScore = getComplianceScore(executionContext);
    const enterpriseScore = getEnterpriseScore(executionContext);
    const pricingScore = getPricingScore(executionContext);
    const qualityScore = getQualityScore(executionContext);

    // Extract grade and lot information
    const finalGrade = getFinalProfessionalGrade(executionContext);
    const hasCritical = hasCriticalLots(executionContext);

    // Check all structural rules
    const structuralFlags: StructuralFlag = {
      complianceQualityMismatch: checkComplianceQualityMismatch(complianceScore, qualityScore),
      enterpriseRiskMismatch: checkEnterpriseRiskMismatch(enterpriseScore, finalGrade),
      pricingQualityMismatch: checkPricingQualityMismatch(pricingScore, qualityScore),
      criticalLotEnterpriseWeakness: checkCriticalLotEnterpriseWeakness(hasCritical, enterpriseScore),
    };

    // Calculate consistency score
    const consistencyScore = calculateConsistencyScore(structuralFlags);
    const imbalanceDetected = consistencyScore < 80;

    // Build risk patterns
    const riskPatterns = buildRiskPatterns(
      complianceScore,
      enterpriseScore,
      pricingScore,
      qualityScore,
      structuralFlags
    );

    const result: StructuralConsistencyResult = {
      imbalanceDetected,
      consistencyScore,
      riskPatterns,
      structuralFlags,
      metadata: {
        createdAt: startTime,
        version: '1.0',
      },
    };

    log('[StructuralConsistencyEngine] Analysis complete', {
      imbalanceDetected,
      consistencyScore,
      flagCount: Object.values(structuralFlags).filter((f) => f).length,
      riskPatternCount: riskPatterns.length,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[StructuralConsistencyEngine] Analysis failed', error);

    // Safe fallback: return balanced result indicating no imbalance detected
    return {
      imbalanceDetected: false,
      consistencyScore: 100,
      riskPatterns: [],
      structuralFlags: {
        complianceQualityMismatch: false,
        enterpriseRiskMismatch: false,
        pricingQualityMismatch: false,
        criticalLotEnterpriseWeakness: false,
      },
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0',
      },
    };
  }
}
