/**
 * Scoring Engine v1.0
 * Minimal scoring engine for project risk assessment
 * Pure calculation - no AI, no external APIs, no Supabase
 * Based on obligation count and complexity metrics
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';

/**
 * Scoring result structure
 */
export interface ScoringEngineResult {
  riskScore: number;
  complexityImpact: number;
  globalScore: number;
  scoreBreakdown: {
    obligationCount: number;
    complexityCount: number;
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
    console.log('[ScoringEngine] Starting project scoring');

    // Extract metrics from execution context
    const obligationCount = executionContext.rules?.obligationCount || 0;
    const complexityScore = executionContext.lots?.complexityScore || 0;

    // Calculate scoring components
    // Risk score: 5 points per obligation (higher obligations = higher risk)
    const riskScore = obligationCount * 5;

    // Complexity impact: 2 points per lot (more lots = more complexity)
    const complexityImpact = complexityScore * 2;

    // Global score: starts at 100, reduced by risk and complexity
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
        complexityCount: complexityScore,
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
        complexityCount: 0,
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
    version: '1.0',
    description: 'Calculate project risk score based on obligations and complexity',
    capabilities: [
      'Risk score calculation',
      'Complexity impact assessment',
      'Global score generation',
      'Risk level classification',
    ],
    inputs: [
      'obligationCount from ruleEngine',
      'complexityScore from lotEngine',
    ],
    outputs: ['riskScore', 'complexityImpact', 'globalScore', 'riskLevel'],
    dependencies: ['ruleEngine', 'lotEngine', 'contextEngine'],
    scoringAlgorithm: {
      baseScore: 100,
      riskFormula: 'obligationCount * 5',
      complexityFormula: 'complexityScore * 2',
      globalFormula: 'Math.max(0, 100 - riskScore - complexityImpact)',
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
