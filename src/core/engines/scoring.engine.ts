/**
 * Scoring Engine v1.2
 * Type-classified weighted scoring engine for project risk assessment
 * Pure calculation - no AI, no external APIs, no Supabase
 * Based on severity-weighted and type-classified obligations
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

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
    typeBreakdown?: {
      legal: number;
      regulatory: number;
      advisory: number;
      commercial: number;
    };
    typeWeightBreakdown?: {
      legal: number; // Full penalty
      regulatory: number; // Full penalty
      advisory: number; // 50% penalty
      commercial: number; // 30% bonus (negative)
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
    log('[ScoringEngine] Starting project scoring with type-classified rules');

    // Extract metrics from execution context
    const obligationCount = executionContext.rules?.obligationCount || 0;
    const totalWeight = executionContext.rules?.totalWeight || 0;
    const severityBreakdown = executionContext.rules?.severityBreakdown || {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const typeBreakdown = executionContext.rules?.typeBreakdown || {
      legal: 0,
      regulatory: 0,
      advisory: 0,
      commercial: 0,
    };
    const detailedObligations = executionContext.rules?.detailedObligations || [];
    const complexityScore = executionContext.lots?.complexityScore || 0;

    // Calculate scoring components with type-based penalty/bonus system
    // legal + regulatory → full penalty (weight)
    // advisory → reduced penalty (weight × 0.5)
    // commercial → bonus (weight × 0.3, subtracts from penalty)

    let legalWeight = 0;
    let regulatoryWeight = 0;
    let advisoryWeight = 0;
    let commercialWeight = 0;

    // Calculate weights by type from detailed obligations
    detailedObligations.forEach((oblig: any) => {
      switch (oblig.ruleType) {
        case 'legal':
          legalWeight += oblig.weight;
          break;
        case 'regulatory':
          regulatoryWeight += oblig.weight;
          break;
        case 'advisory':
          advisoryWeight += oblig.weight;
          break;
        case 'commercial':
          commercialWeight += oblig.weight;
          break;
      }
    });

    // Calculate type-weighted risk score
    // legal (100%) + regulatory (100%) + advisory (50%) - commercial (30% bonus)
    const typeWeightedRisk =
      legalWeight +
      regulatoryWeight +
      advisoryWeight * 0.5 -
      commercialWeight * 0.3;

    // Risk score: type-weighted calculation
    const riskScore = Math.max(0, typeWeightedRisk);

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
        typeBreakdown,
        typeWeightBreakdown: {
          legal: legalWeight,
          regulatory: regulatoryWeight,
          advisory: advisoryWeight * 0.5,
          commercial: commercialWeight * 0.3,
        },
        obligationWeight: riskScore,
        complexityWeight: complexityImpact,
        scoreReduction: totalReduction,
      },
      riskLevel,
      meta: {
        engineVersion: '1.2',
        createdAt: new Date().toISOString(),
        processingTime,
      },
    };

    log('[ScoringEngine] Project scoring completed', {
      globalScore: result.globalScore,
      riskLevel: result.riskLevel,
      obligationCount,
      totalWeight,
      severityBreakdown,
      typeBreakdown,
      typeWeightedRisk,
      riskScore,
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
        typeBreakdown: {
          legal: 0,
          regulatory: 0,
          advisory: 0,
          commercial: 0,
        },
        typeWeightBreakdown: {
          legal: 0,
          regulatory: 0,
          advisory: 0,
          commercial: 0,
        },
        obligationWeight: 0,
        complexityWeight: 0,
        scoreReduction: 0,
      },
      riskLevel: 'low',
      meta: {
        engineVersion: '1.2',
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
    version: '1.2',
    description: 'Type-classified weighted scoring for project risk assessment with penalty/bonus system',
    capabilities: [
      'Type-classified risk scoring',
      'Legal/Regulatory/Advisory/Commercial distinction',
      'Penalty/Bonus weighting system',
      'Severity-based obligation weighting',
      'Complexity impact assessment',
      'Global score generation',
      'Risk level classification',
      'Type and severity breakdown reporting',
    ],
    inputs: [
      'detailedObligations from ruleEngine (with ruleType: legal|regulatory|advisory|commercial)',
      'typeBreakdown from ruleEngine (count by type)',
      'severityBreakdown from ruleEngine (critical/high/medium/low)',
      'complexityScore from lotEngine',
    ],
    outputs: [
      'riskScore (type-weighted calculation)',
      'complexityImpact',
      'globalScore',
      'riskLevel',
      'scoreBreakdown with type and severity details',
    ],
    dependencies: ['ruleEngine', 'lotEngine', 'contextEngine'],
    severityWeightingStrategy: {
      critical: 15,
      high: 10,
      medium: 7,
      low: 3,
    },
    typeWeightingStrategy: {
      legal: '100% penalty (full weight)',
      regulatory: '100% penalty (full weight)',
      advisory: '50% penalty (weight × 0.5)',
      commercial: '30% bonus (weight × 0.3 subtracted from penalty)',
    },
    scoringAlgorithm: {
      baseScore: 100,
      riskFormula:
        'legalWeight + regulatoryWeight + (advisoryWeight × 0.5) - (commercialWeight × 0.3)',
      complexityFormula: 'complexityScore × 2',
      globalFormula:
        'Math.max(0, 100 - typeWeightedRisk - complexityImpact)',
      riskLevels: {
        low: '75-100',
        medium: '50-74',
        high: '25-49',
        critical: '0-24',
      },
      examples: {
        simple:
          'legal:15 → riskScore=15, final score depends on complexity',
        complex:
          'legal:15 + regulatory:20 + advisory:10 → 15 + 20 + (10×0.5) = 40',
        withCommercial:
          'legal:20 + commercial:10 → 20 - (10×0.3) = 16.7',
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
