/**
 * Scoring Engine v1.0
 * Weighted scoring engine for project risk assessment
 * Pure calculation - no AI, no external APIs, no Supabase
 * Based on severity-weighted obligations and complexity metrics
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';

/**
 * Scoring result structure with weighted scoring
 */
export interface ScoringEngineResult {
  riskScore: number;
  complexityImpact: number;
  globalScore: number;
  scoreBreakdown: {
    obligationCount: number;
    totalWeight: number; // Sum of all rule weights
    complexityCount: number;
    severityBreakdown?: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    obligationWeight: number; // riskScore
    complexityWeight: number; // complexityImpact
    scoreReduction: number; // total reduction from 100
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  meta: {
    engineVersion: string;
    createdAt: string;
    processingTime: number;
  };
}

/**
 * Run Scoring Engine - calculate project risk score
 * Input: EngineExecutionContext with obligations and complexity from prior engines
 * Output: Risk scoring metrics based on simple algorithms
 */
export async function runScoringEngine(
  executionContext: EngineExecutionContext
): Promise<ScoringEngineResult> {
  const startTime = Date.now();

  try {
    console.log('[ScoringEngine] Starting project scoring with weighted rules');

    // Extract metrics from execution context
    const obligationCount = executionContext.rules?.obligationCount || 0;
    const totalWeight = executionContext.rules?.totalWeight || 0;
    const severityBreakdown = executionContext.rules?.severityBreakdown || {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const complexityScore = executionContext.lots?.complexityScore || 0;

    // Calculate scoring components
    // Risk score: weighted sum of all rule obligations (based on severity)
    // Instead of simple count * 5, we use actual weights assigned by severity
    const riskScore = totalWeight;

    // Complexity impact: 2 points per lot (more lots = more complexity)
    const complexityImpact = complexityScore * 2;

    // Global score: starts at 100, reduced by weighted risk and complexity
    // Clamped to 0 minimum (no negative scores)
    const totalReduction = riskScore + complexityImpact;
    const globalScore = Math.max(0, 100 - totalReduction);

    // Determine risk level based on global score
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (globalScore >= 75) {
      riskLevel = 'low';
    } else if (globalScore >= 50) {
      riskLevel = 'medium';
    } else if (globalScore >= 25) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    const processingTime = Date.now() - startTime;

    const result: ScoringEngineResult = {
      riskScore,
      complexityImpact,
      globalScore,
      scoreBreakdown: {
        obligationCount,
        totalWeight,
        complexityCount: complexityScore,
        severityBreakdown,
        obligationWeight: riskScore,
        complexityWeight: complexityImpact,
        scoreReduction: totalReduction,
      },
      riskLevel,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime,
      },
    };

    console.log('[ScoringEngine] Project scoring completed', {
      globalScore: result.globalScore,
      riskLevel: result.riskLevel,
      obligationCount,
      totalWeight,
      severityBreakdown,
      complexityScore,
      processingTime,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ScoringEngine] Error during project scoring', error);

    // Return graceful error result with neutral scoring
    return {
      riskScore: 0,
      complexityImpact: 0,
      globalScore: 100,
      scoreBreakdown: {
        obligationCount: 0,
        totalWeight: 0,
        complexityCount: 0,
        severityBreakdown: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
        obligationWeight: 0,
        complexityWeight: 0,
        scoreReduction: 0,
      },
      riskLevel: 'low',
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
    };
  }
}

/**
 * Get Scoring Engine metadata
 * Describes engine capabilities and scoring algorithm
 */
export function getScoringEngineMetadata() {
  return {
    id: 'scoringEngine',
    name: 'Scoring Engine',
    version: '1.1',
    description: 'Calculate project risk score with severity-weighted obligations and complexity',
    capabilities: [
      'Weighted risk score calculation',
      'Severity-based obligation weighting',
      'Complexity impact assessment',
      'Global score generation',
      'Risk level classification',
      'Severity breakdown reporting',
    ],
    inputs: [
      'totalWeight from ruleEngine (sum of all rule weights)',
      'severityBreakdown from ruleEngine (critical/high/medium/low counts)',
      'detailedObligations from ruleEngine (weighted obligations)',
      'complexityScore from lotEngine',
    ],
    outputs: [
      'riskScore (totalWeight)',
      'complexityImpact',
      'globalScore',
      'riskLevel',
      'scoreBreakdown with severity details',
    ],
    dependencies: ['ruleEngine', 'lotEngine', 'contextEngine'],
    weightingStrategy: {
      critical: 15,
      high: 10,
      medium: 7,
      low: 3,
    },
    scoringAlgorithm: {
      baseScore: 100,
      riskFormula: 'totalWeight (sum of weighted rules)',
      complexityFormula: 'complexityScore * 2',
      globalFormula: 'Math.max(0, 100 - totalWeight - complexityImpact)',
      riskLevels: {
        low: '75-100',
        medium: '50-74',
        high: '25-49',
        critical: '0-24',
      },
    },
  };
}

/**
 * Interpret a score and provide descriptive feedback
 */
export function interpretScore(score: number): {
  level: string;
  description: string;
  recommendation: string;
} {
  if (score >= 75) {
    return {
      level: 'low',
      description: 'Project has minimal risk and complexity',
      recommendation: 'Standard process sufficient',
    };
  }
  if (score >= 50) {
    return {
      level: 'medium',
      description: 'Project has moderate risk and complexity',
      recommendation: 'Enhanced review recommended',
    };
  }
  if (score >= 25) {
    return {
      level: 'high',
      description: 'Project has significant risk and complexity',
      recommendation: 'Detailed analysis and expert review required',
    };
  }
  return {
    level: 'critical',
    description: 'Project has critical risk and complexity',
    recommendation: 'Immediate escalation to senior management required',
  };
}
