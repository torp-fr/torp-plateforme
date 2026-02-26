/**
 * Trust Transparency & Explainability Engine v1.0
 * Generates complete explanations of all scoring decisions
 * Pure read-only analysis layer - no modifications to any existing scores or logic
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Audit trail for decision tracking
 */
export interface AuditTrailData {
  baseScore?: number;
  adjustedScore?: number;
  finalGrade?: string;
  fraudScore?: number;
  consistencyScore?: number;
  cappingApplied?: boolean;
  originalGrade?: string;
}

/**
 * Complete transparency result
 */
export interface TrustTransparencyResult {
  scoreExplanation: string[];
  adaptiveExplanation: string[];
  gradeExplanation: string[];
  cappingExplanation: string[];
  consistencyExplanation: string[];
  fraudExplanation: string[];
  decisionSummary: string;
  auditTrail: AuditTrailData;
  metadata: {
    version: string;
    createdAt: string;
  };
}

/**
 * Generate score explanation
 */
function generateScoreExplanation(context: EngineExecutionContext): string[] {
  const explanations: string[] = [];

  try {
    const globalScore = (context as any)?.globalScore?.score;
    const auditScore = (context.audit as any)?.globalScore;

    if (globalScore !== undefined) {
      explanations.push(`Base Score: ${globalScore.toFixed(1)}/100`);
      explanations.push(
        'The base score is calculated from four evaluation pillars:'
      );

      const enterpriseScore = (context.enterprise as any)?.score;
      if (enterpriseScore !== undefined) {
        explanations.push(`• Enterprise Strength: ${enterpriseScore.toFixed(1)}/100`);
      }

      const pricingScore = (context.pricing as any)?.score;
      if (pricingScore !== undefined) {
        explanations.push(`• Pricing Assessment: ${pricingScore.toFixed(1)}/100`);
      }

      const qualityScore = (context.quality as any)?.score;
      if (qualityScore !== undefined) {
        explanations.push(`• Quality Evaluation: ${qualityScore.toFixed(1)}/100`);
      }

      explanations.push(
        `The global score of ${globalScore.toFixed(1)}/100 results from the weighted combination of these four pillars.`
      );
    } else if (auditScore !== undefined) {
      explanations.push(`Base Score: ${auditScore.toFixed(1)}/100`);
      explanations.push(
        'The score was calculated from audit analysis of project components.'
      );
    }

    return explanations;
  } catch (error) {
    warn('[TrustTransparency] Error generating score explanation:', error);
    return ['Score explanation could not be generated.'];
  }
}

/**
 * Generate adaptive scoring explanation
 */
function generateAdaptiveExplanation(context: EngineExecutionContext): string[] {
  const explanations: string[] = [];

  try {
    const adaptiveScore = (context as any)?.adaptiveScore;

    if (!adaptiveScore) {
      explanations.push('No adaptive adjustments were applied.');
      return explanations;
    }

    const baseScore = adaptiveScore.baseScore;
    const adjustedScore = adaptiveScore.adjustedScore;

    if (baseScore !== undefined && adjustedScore !== undefined) {
      explanations.push(
        `Adaptive Scoring: Base ${baseScore.toFixed(1)} → Adjusted ${adjustedScore.toFixed(1)}`
      );

      const breakdown = adaptiveScore.adjustmentBreakdown || {};

      if (breakdown.sectorMultiplier) {
        const sectorLabel =
          breakdown.sectorMultiplier > 1.0 ? 'increased' : 'unchanged';
        explanations.push(
          `• Sector Complexity: ${sectorLabel} by factor ${breakdown.sectorMultiplier.toFixed(2)}x`
        );
      }

      if (breakdown.riskMultiplier) {
        const riskLabel =
          breakdown.riskMultiplier < 1.0 ? 'reduced' : 'unchanged';
        explanations.push(
          `• Risk Assessment: ${riskLabel} by factor ${breakdown.riskMultiplier.toFixed(2)}x`
        );
      }

      if (breakdown.normativePenalty && breakdown.normativePenalty > 0) {
        explanations.push(
          `• Regulatory Penalties: -${breakdown.normativePenalty} points`
        );
      }

      if (breakdown.pricingPenalty && breakdown.pricingPenalty > 0) {
        explanations.push(
          `• Pricing Anomalies: -${breakdown.pricingPenalty} points`
        );
      }

      const change =
        ((adjustedScore - baseScore) / baseScore) * 100;
      if (Math.abs(change) > 0.1) {
        const direction = change > 0 ? 'increased' : 'decreased';
        explanations.push(
          `The adjusted score ${direction} by ${Math.abs(change).toFixed(1)}% due to contextual factors.`
        );
      }
    }

    return explanations;
  } catch (error) {
    warn('[TrustTransparency] Error generating adaptive explanation:', error);
    return ['Adaptive scoring explanation could not be generated.'];
  }
}

/**
 * Generate grade explanation
 */
function generateGradeExplanation(context: EngineExecutionContext): string[] {
  const explanations: string[] = [];

  try {
    const finalGrade = (context as any)?.finalProfessionalGrade;

    if (!finalGrade) {
      explanations.push('No final grade has been assigned.');
      return explanations;
    }

    explanations.push(`Final Professional Grade: ${finalGrade}`);
    explanations.push('Grade Mapping (from adjusted score):');

    const scoreDescriptions: Record<string, string> = {
      A: '90-100: Excellent quality and compliance',
      B: '75-89: Good quality with minor adjustments',
      C: '60-74: Satisfactory with some concerns',
      D: '40-59: Poor quality requiring oversight',
      E: '0-39: Critical issues requiring escalation',
    };

    explanations.push(`• ${scoreDescriptions[finalGrade] || 'Grade unknown'}`);

    explanations.push(
      `This grade represents the official assessment after all scoring mechanisms have been applied.`
    );

    return explanations;
  } catch (error) {
    warn('[TrustTransparency] Error generating grade explanation:', error);
    return ['Grade explanation could not be generated.'];
  }
}

/**
 * Generate capping explanation
 */
function generateCappingExplanation(context: EngineExecutionContext): string[] {
  const explanations: string[] = [];

  try {
    const cappingResult = (context as any)?.trustCappingResult;

    if (!cappingResult) {
      explanations.push('No trust capping information available.');
      explanations.push('No grade capping was applied to this quote.');
      return explanations;
    }

    const cappingApplied = cappingResult.cappingApplied || false;

    if (!cappingApplied) {
      explanations.push('Grade Capping: Not applied');
      explanations.push('The final grade was not capped by any trust mechanism.');
      return explanations;
    }

    explanations.push('Grade Capping: Applied');

    if (cappingResult.originalGrade) {
      explanations.push(`• Original Grade: ${cappingResult.originalGrade}`);
    }

    if (cappingResult.maxAllowedGrade) {
      explanations.push(`• Maximum Allowed: ${cappingResult.maxAllowedGrade}`);
    }

    if (cappingResult.finalGrade) {
      explanations.push(`• Final Grade After Capping: ${cappingResult.finalGrade}`);
    }

    // Check for blocking obligations
    const obligations = (context.rules as any)?.uniqueDetailedObligations || [];
    const blockingObligations = obligations.filter((o: any) =>
      ['ELEC_NFC15100', 'ELEC_DECLARATION', 'ASBESTOS'].includes(o.type)
    );

    if (blockingObligations.length > 0) {
      explanations.push(`• Blocking Obligations: ${blockingObligations.length} found`);
      blockingObligations.forEach((o: any) => {
        explanations.push(`  - ${o.type}: Restricts maximum grade`);
      });
    }

    explanations.push(
      'Trust capping ensures that grades match enterprise capabilities and regulatory compliance.'
    );

    return explanations;
  } catch (error) {
    warn('[TrustTransparency] Error generating capping explanation:', error);
    return ['Capping explanation could not be generated.'];
  }
}

/**
 * Generate structural consistency explanation
 */
function generateConsistencyExplanation(context: EngineExecutionContext): string[] {
  const explanations: string[] = [];

  try {
    const consistency = (context as any)?.structuralConsistency;

    if (!consistency) {
      explanations.push('No structural consistency analysis available.');
      return explanations;
    }

    const consistencyScore = consistency.consistencyScore;
    const imbalanceDetected = consistency.imbalanceDetected || false;
    const flagsDetected = consistency.flagsDetected || [];

    if (consistencyScore !== undefined) {
      explanations.push(`Structural Consistency Score: ${consistencyScore.toFixed(1)}/100`);

      if (consistencyScore >= 80) {
        explanations.push('Status: Excellent - All pillars are well-balanced');
      } else if (consistencyScore >= 60) {
        explanations.push('Status: Good - Minor imbalances detected');
      } else if (consistencyScore >= 40) {
        explanations.push('Status: Fair - Significant imbalances present');
      } else {
        explanations.push('Status: Poor - Critical imbalances detected');
      }
    }

    if (imbalanceDetected) {
      explanations.push('Imbalance Detected: Yes');

      if (flagsDetected.length > 0) {
        explanations.push(`Detected Anomalies (${flagsDetected.length}):`);
        flagsDetected.forEach((flag) => {
          explanations.push(`• ${flag}`);
        });
      }
    } else {
      explanations.push('Imbalance Detected: No');
    }

    return explanations;
  } catch (error) {
    warn('[TrustTransparency] Error generating consistency explanation:', error);
    return ['Consistency explanation could not be generated.'];
  }
}

/**
 * Generate fraud explanation
 */
function generateFraudExplanation(context: EngineExecutionContext): string[] {
  const explanations: string[] = [];

  try {
    const fraudDetection = (context as any)?.fraudDetection;

    if (!fraudDetection) {
      explanations.push('No fraud analysis performed.');
      return explanations;
    }

    const fraudScore = fraudDetection.fraudScore;
    const fraudLevel = fraudDetection.fraudLevel;
    const detectedPatterns = fraudDetection.detectedPatterns || [];

    if (fraudScore !== undefined) {
      explanations.push(`Fraud Risk Score: ${fraudScore}/100`);
      explanations.push(`Fraud Level: ${fraudLevel.toUpperCase()}`);

      switch (fraudLevel) {
        case 'low':
          explanations.push(
            'Assessment: Low fraud risk - Standard processing recommended'
          );
          break;
        case 'moderate':
          explanations.push(
            'Assessment: Moderate fraud risk - Review before processing'
          );
          break;
        case 'high':
          explanations.push(
            'Assessment: High fraud risk - Escalate for investigation'
          );
          break;
        case 'critical':
          explanations.push(
            'Assessment: Critical fraud risk - Block until resolved'
          );
          break;
      }
    }

    if (detectedPatterns.length > 0) {
      explanations.push(`Detected Patterns (${detectedPatterns.length}):`);
      detectedPatterns.forEach((pattern) => {
        explanations.push(`• ${pattern}`);
      });
    }

    const riskIndicators = fraudDetection.riskIndicators || {};
    const activeRisks = [];

    if (riskIndicators.pricingRisk) activeRisks.push('Pricing anomalies');
    if (riskIndicators.complianceRisk) activeRisks.push('Compliance issues');
    if (riskIndicators.enterpriseRisk) activeRisks.push('Enterprise weakness');
    if (riskIndicators.structuralRisk) activeRisks.push('Structural conflicts');

    if (activeRisks.length > 0) {
      explanations.push(`Risk Indicators: ${activeRisks.join(', ')}`);
    }

    return explanations;
  } catch (error) {
    warn('[TrustTransparency] Error generating fraud explanation:', error);
    return ['Fraud analysis explanation could not be generated.'];
  }
}

/**
 * Generate decision summary
 */
function generateDecisionSummary(context: EngineExecutionContext): string {
  try {
    const finalGrade = (context as any)?.finalProfessionalGrade || 'Unassigned';
    const adjustedScore = (context as any)?.adaptiveScore?.adjustedScore;
    const fraudLevel = (context as any)?.fraudDetection?.fraudLevel || 'not analyzed';
    const consistencyScore = (context as any)?.structuralConsistency?.consistencyScore;

    const scoreText =
      adjustedScore !== undefined ? `${adjustedScore.toFixed(1)}/100` : 'N/A';

    const consistencyText =
      consistencyScore !== undefined
        ? `Consistency: ${consistencyScore.toFixed(1)}/100`
        : '';

    const fraudText =
      fraudLevel !== 'not analyzed'
        ? `Fraud Level: ${fraudLevel.toUpperCase()}`
        : '';

    return (
      `Project receives final grade ${finalGrade} with adjusted score ${scoreText}. ` +
      `${fraudLevel === 'low' || fraudLevel === 'moderate' ? 'No critical fraud indicators detected. ' : 'Fraud risk identified - escalation recommended. '}` +
      `${consistencyText ? `${consistencyText}. ` : ''}` +
      `This assessment is based on comprehensive analysis of pricing, compliance, enterprise capabilities, and structural coherence.`
    );
  } catch (error) {
    warn('[TrustTransparency] Error generating decision summary:', error);
    return 'An error occurred during summary generation.';
  }
}

/**
 * Build audit trail
 */
function buildAuditTrail(context: EngineExecutionContext): AuditTrailData {
  const trail: AuditTrailData = {};

  try {
    // Base score
    if ((context as any)?.globalScore?.score !== undefined) {
      trail.baseScore = (context as any).globalScore.score;
    }

    // Adjusted score
    if ((context as any)?.adaptiveScore?.adjustedScore !== undefined) {
      trail.adjustedScore = (context as any).adaptiveScore.adjustedScore;
    }

    // Final grade
    if ((context as any)?.finalProfessionalGrade) {
      trail.finalGrade = (context as any).finalProfessionalGrade;
    }

    // Fraud score
    if ((context as any)?.fraudDetection?.fraudScore !== undefined) {
      trail.fraudScore = (context as any).fraudDetection.fraudScore;
    }

    // Consistency score
    if ((context as any)?.structuralConsistency?.consistencyScore !== undefined) {
      trail.consistencyScore = (context as any).structuralConsistency.consistencyScore;
    }

    // Capping info
    if ((context as any)?.trustCappingResult) {
      trail.cappingApplied = (context as any).trustCappingResult.cappingApplied;
      trail.originalGrade = (context as any).trustCappingResult.originalGrade;
    }
  } catch (error) {
    warn('[TrustTransparency] Error building audit trail:', error);
  }

  return trail;
}

/**
 * Main trust transparency engine function
 */
export async function runTrustTransparencyEngine(
  executionContext: EngineExecutionContext
): Promise<TrustTransparencyResult> {
  try {
    log('[TrustTransparency] Starting transparency analysis');

    const result: TrustTransparencyResult = {
      scoreExplanation: generateScoreExplanation(executionContext),
      adaptiveExplanation: generateAdaptiveExplanation(executionContext),
      gradeExplanation: generateGradeExplanation(executionContext),
      cappingExplanation: generateCappingExplanation(executionContext),
      consistencyExplanation: generateConsistencyExplanation(executionContext),
      fraudExplanation: generateFraudExplanation(executionContext),
      decisionSummary: generateDecisionSummary(executionContext),
      auditTrail: buildAuditTrail(executionContext),
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
      },
    };

    // Enrich context (non-destructive)
    (executionContext as any).trustTransparency = result;

    log('[TrustTransparency] Transparency analysis complete');

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TrustTransparency] Engine execution failed:', errorMessage);

    // Return safe fallback result
    return {
      scoreExplanation: ['An error occurred during score explanation.'],
      adaptiveExplanation: ['An error occurred during adaptive explanation.'],
      gradeExplanation: ['An error occurred during grade explanation.'],
      cappingExplanation: ['An error occurred during capping explanation.'],
      consistencyExplanation: ['An error occurred during consistency explanation.'],
      fraudExplanation: ['An error occurred during fraud explanation.'],
      decisionSummary: 'An error occurred during transparency analysis.',
      auditTrail: {},
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Format transparency result as readable report
 */
export function formatTrustTransparencyAsText(result: TrustTransparencyResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    'TORP TRANSPARENCY & EXPLAINABILITY REPORT',
    '═══════════════════════════════════════════════════════════════',
    '',
  ];

  // Score Explanation
  lines.push('── SCORE EXPLANATION ──');
  result.scoreExplanation.forEach((line) => {
    lines.push(line);
  });
  lines.push('');

  // Adaptive Explanation
  lines.push('── ADAPTIVE SCORING ──');
  result.adaptiveExplanation.forEach((line) => {
    lines.push(line);
  });
  lines.push('');

  // Grade Explanation
  lines.push('── GRADE ASSIGNMENT ──');
  result.gradeExplanation.forEach((line) => {
    lines.push(line);
  });
  lines.push('');

  // Capping Explanation
  lines.push('── TRUST CAPPING ──');
  result.cappingExplanation.forEach((line) => {
    lines.push(line);
  });
  lines.push('');

  // Consistency Explanation
  lines.push('── STRUCTURAL CONSISTENCY ──');
  result.consistencyExplanation.forEach((line) => {
    lines.push(line);
  });
  lines.push('');

  // Fraud Explanation
  lines.push('── FRAUD ANALYSIS ──');
  result.fraudExplanation.forEach((line) => {
    lines.push(line);
  });
  lines.push('');

  // Decision Summary
  lines.push('── DECISION SUMMARY ──');
  lines.push(result.decisionSummary);
  lines.push('');

  // Audit Trail
  lines.push('── AUDIT TRAIL ──');
  if (result.auditTrail.baseScore !== undefined) {
    lines.push(`Base Score: ${result.auditTrail.baseScore.toFixed(1)}`);
  }
  if (result.auditTrail.adjustedScore !== undefined) {
    lines.push(`Adjusted Score: ${result.auditTrail.adjustedScore.toFixed(1)}`);
  }
  if (result.auditTrail.finalGrade) {
    lines.push(`Final Grade: ${result.auditTrail.finalGrade}`);
  }
  if (result.auditTrail.fraudScore !== undefined) {
    lines.push(`Fraud Score: ${result.auditTrail.fraudScore}`);
  }
  if (result.auditTrail.consistencyScore !== undefined) {
    lines.push(`Consistency Score: ${result.auditTrail.consistencyScore.toFixed(1)}`);
  }
  lines.push('');

  lines.push('─────────────────────────────────────────────────────────────');
  lines.push(`Generated: ${result.metadata.createdAt}`);
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Get engine metadata
 */
export function getTrustTransparencyMetadata(): Record<string, any> {
  return {
    name: 'Trust Transparency & Explainability Engine',
    version: '1.0',
    purpose: 'Generate complete explainable audit trail of all scoring decisions',
    executionOrder: 'After FraudDetectionEngine (final analysis layer)',
    characteristics: {
      readOnly: true,
      noModification: true,
      fullyExplainable: true,
      auditTrailComplete: true,
      legallyDefendable: true,
      commerciallyViable: true,
    },
    explanations: {
      scoreExplanation: 'Explains base scoring from four pillars',
      adaptiveExplanation: 'Explains contextual adjustments',
      gradeExplanation: 'Explains score-to-grade mapping',
      cappingExplanation: 'Explains trust capping mechanisms',
      consistencyExplanation: 'Explains structural balance',
      fraudExplanation: 'Explains fraud risk assessment',
      decisionSummary: 'Executive summary of decision',
      auditTrail: 'Complete decision trail',
    },
    constraints: {
      noEngineModification: true,
      noScoringChange: true,
      readOnlyAnalysis: true,
      noDataModification: true,
      purelyExplanatory: true,
    },
  };
}
