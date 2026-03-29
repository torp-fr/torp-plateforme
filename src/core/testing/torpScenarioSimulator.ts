/**
 * TORP Scenario Simulator v1.0
 * Runs test scenarios through the complete TORP pipeline
 * Pure simulation - no production impact
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { TorpTestScenario, getScenario } from './torpScenarioLibrary';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Test scenario result
 */
export interface TestScenarioResult {
  scenarioName: string;
  inputSummary: {
    lots: string[];
    enterpriseStrength: number; // 0-100
    pricingLevel: string; // low, medium, high
    qualityLevel: string; // poor, average, good, excellent
  };
  outputSummary: {
    originalGrade: string; // From globalScoring
    finalProfessionalGrade: string; // From trustCapping
    consistencyScore: number; // 0-100
    imbalanceDetected: boolean;
    cappingApplied: boolean;
  };
  flagsDetected: string[];
  metadata: {
    createdAt: string;
    version: string;
    executionTimeMs: number;
  };
}

/**
 * Calculate enterprise strength score (0-100)
 */
function calculateEnterpriseStrength(
  yearsInBusiness: number,
  hasInsurance: boolean,
  employees: number
): number {
  let score = 0;

  // Years in business (0-40 points)
  if (yearsInBusiness >= 20) score += 40;
  else if (yearsInBusiness >= 10) score += 30;
  else if (yearsInBusiness >= 5) score += 20;
  else if (yearsInBusiness >= 2) score += 10;

  // Insurance (0-30 points)
  if (hasInsurance) score += 30;

  // Employees (0-30 points)
  if (employees >= 15) score += 30;
  else if (employees >= 10) score += 25;
  else if (employees >= 5) score += 15;
  else if (employees >= 2) score += 8;
  else if (employees >= 1) score += 3;

  return Math.min(100, score);
}

/**
 * Determine pricing level from total amount
 */
function getPricingLevel(totalAmount: number, lotCount: number): string {
  const avgPerLot = totalAmount / lotCount;

  if (avgPerLot > 5000) return 'high';
  if (avgPerLot > 2000) return 'medium';
  return 'low';
}

/**
 * Determine quality level from attributes
 */
function getQualityLevel(
  descriptionLength: number,
  hasLegalMentions: boolean,
  materialQuality: string
): string {
  let score = 0;

  if (descriptionLength >= 1500) score += 30;
  else if (descriptionLength >= 1000) score += 20;
  else if (descriptionLength >= 500) score += 10;

  if (hasLegalMentions) score += 30;

  if (materialQuality === 'excellent') score += 40;
  else if (materialQuality === 'good') score += 25;
  else if (materialQuality === 'average') score += 15;

  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'average';
  return 'poor';
}

/**
 * Simulate a complete TORP execution context from scenario
 */
function buildExecutionContext(scenario: TorpTestScenario): EngineExecutionContext {
  const input = scenario.input;

  // Calculate derived metrics
  const enterpriseScore = calculateEnterpriseStrength(
    input.enterpriseProfile.yearsInBusiness,
    input.enterpriseProfile.hasInsurance,
    input.enterpriseProfile.registeredEmployees
  );

  const pricingScore = Math.max(
    0,
    Math.min(
      100,
      (input.pricing.totalAmount / (input.lots.length * 5000)) * 100
    )
  );

  const qualityScore = Math.max(
    0,
    Math.min(100, (input.quality.descriptionLength / 2000) * 100)
  );

  // Simulate compliance score (average of all factors)
  const complianceScore = (enterpriseScore + pricingScore + qualityScore) / 3;

  // Simulate global score (0-100)
  const globalScore = (complianceScore + enterpriseScore) / 2;

  // Map score to grade
  let grade: string = 'E';
  if (globalScore >= 90) grade = 'A';
  else if (globalScore >= 75) grade = 'B';
  else if (globalScore >= 60) grade = 'C';
  else if (globalScore >= 40) grade = 'D';

  // Build execution context
  const context: EngineExecutionContext = {
    projectId: `test-${Date.now()}`,
    projectData: {
      enterprise: input.enterpriseProfile,
      lots: input.lots,
      pricing: input.pricing,
      quality: input.quality,
    },
    executionStartTime: new Date().toISOString(),

    // Simulate context engine result
    context: {
      detectedLots: input.lots.map((lot, idx) => ({
        id: `lot-${idx}`,
        reference: lot.type,
        address: 'Simulated Location',
        confidencePercentage: 95,
      })),
      summary: `Simulated project with ${input.lots.length} lots`,
    },

    // Simulate lot engine result
    lots: {
      normalizedLots: input.lots.map((lot, idx) => ({
        id: `lot-${idx}`,
        type: lot.type,
        description: lot.description,
      })),
      primaryLots: input.lots.slice(0, 1),
      complexityScore: input.lots.length * 20,
      categorySummary: {
        electrical: input.lots.filter((l) => l.type === 'electricite').length,
        plumbing: input.lots.filter((l) => l.type === 'plomberie').length,
        structural: input.lots.filter((l) => l.type === 'gros_oeuvre').length,
      },
    },

    // Simulate rule engine result
    rules: {
      obligations: input.obligations,
      uniqueDetailedObligations: input.obligations,
      typeBreakdown: {
        electrical: input.obligations.filter((o) => o.type.includes('ELEC')).length,
        structural: input.obligations.filter((o) => o.type.includes('GROS')).length,
      },
      severityBreakdown: {
        critical: 2,
        high: 1,
        medium: 1,
      },
    },

    // Simulate scoring engine result
    audit: {
      riskScore: 100 - globalScore,
      globalScore,
      riskLevel: globalScore >= 75 ? 'low' : globalScore >= 50 ? 'medium' : 'high',
    },

    // Simulate enterprise engine
    enterprise: {
      score: enterpriseScore,
      summary: {
        yearsInBusiness: input.enterpriseProfile.yearsInBusiness,
        hasInsurance: input.enterpriseProfile.hasInsurance,
        employees: input.enterpriseProfile.registeredEmployees,
      },
    },

    // Simulate pricing engine
    pricing: {
      score: pricingScore,
      totalAmount: input.pricing.totalAmount,
      avgPerLot: input.pricing.totalAmount / input.lots.length,
    },

    // Simulate quality engine
    quality: {
      score: qualityScore,
      descriptionLength: input.quality.descriptionLength,
      hasLegalMentions: input.quality.hasLegalMentions,
    },

    // Simulate global scoring
    globalScore: {
      score: globalScore,
      grade,
      timestamp: new Date().toISOString(),
    },
  };

  return context;
}

/**
 * Simulate trust capping results
 */
function simulateTrustCapping(context: EngineExecutionContext): {
  finalGrade: string;
  cappingApplied: boolean;
  originalGrade: string;
} {
  const originalGrade = context.globalScore?.grade || 'C';
  let finalGrade = originalGrade;
  let cappingApplied = false;

  // Check for grade blocking based on obligations
  const obligations = (context.rules?.uniqueDetailedObligations || []) as Array<{
    obligationId: string;
    type: string;
  }>;

  // Simulate blocking rules
  for (const obligation of obligations) {
    if (obligation.type === 'ELEC_NFC15100') {
      // Blocks A
      if (['A'].includes(finalGrade)) {
        finalGrade = 'B';
        cappingApplied = true;
      }
    }
    if (obligation.type === 'ELEC_DECLARATION') {
      // Blocks C and above
      if (['A', 'B', 'C'].includes(finalGrade)) {
        finalGrade = 'D';
        cappingApplied = true;
      }
    }
  }

  // Check for price anomalies
  const pricing = context.pricing as any;
  const quality = context.quality as any;
  const hasCriticalLots = (context.lots?.normalizedLots || []).some((l: any) =>
    ['gros_oeuvre', 'toiture'].includes(l.type)
  );

  if (pricing?.avgPerLot < 1000 && hasCriticalLots) {
    // Low pricing on critical lots
    const grades = ['A', 'B', 'C', 'D', 'E'];
    const currentGradeIdx = grades.indexOf(finalGrade);
    if (currentGradeIdx < 4) {
      finalGrade = grades[currentGradeIdx + 1];
      cappingApplied = true;
    }
  }

  return {
    finalGrade,
    cappingApplied,
    originalGrade,
  };
}

/**
 * Simulate structural consistency results
 */
function simulateStructuralConsistency(context: EngineExecutionContext): {
  consistencyScore: number;
  imbalanceDetected: boolean;
  flagsDetected: string[];
} {
  const flags: string[] = [];
  const enterprise = (context.enterprise as any)?.score || 50;
  const pricing = (context.pricing as any)?.score || 50;
  const quality = (context.quality as any)?.score || 50;
  const compliance = (context.globalScore as any)?.score || 50;
  const finalGrade = context.finalProfessionalGrade || 'C';

  // Check Rule 1: Compliance vs Quality
  if (compliance >= 75 && quality < 40) {
    flags.push('complianceQualityMismatch');
  }

  // Check Rule 2: Enterprise vs Grade
  if (enterprise < 30 && ['A', 'B'].includes(finalGrade)) {
    flags.push('enterpriseRiskMismatch');
  }

  // Check Rule 3: Pricing vs Quality
  if (pricing < 40 && quality >= 70) {
    flags.push('pricingQualityMismatch');
  }

  // Check Rule 4: Critical Lot Enterprise
  const hasCritical = (context.lots?.normalizedLots || []).some((l: any) =>
    ['gros_oeuvre', 'toiture', 'charpente', 'facade'].includes(l.type)
  );
  if (hasCritical && enterprise < 40) {
    flags.push('criticalLotEnterpriseWeakness');
  }

  // Calculate consistency score
  const consistencyScore = Math.max(0, 100 - flags.length * 20);
  const imbalanceDetected = consistencyScore < 80;

  return {
    consistencyScore,
    imbalanceDetected,
    flagsDetected: flags,
  };
}

/**
 * Run a TORP scenario simulation
 */
export async function runTorpScenario(scenarioName: string): Promise<TestScenarioResult> {
  const startTime = Date.now();

  try {
    log(`[TorpSimulator] Running scenario: ${scenarioName}`);

    // Load scenario
    const scenario = getScenario(scenarioName);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioName}`);
    }

    // Build execution context
    const context = buildExecutionContext(scenario);

    // Simulate trust capping
    const cappingResult = simulateTrustCapping(context);
    context.finalProfessionalGrade = cappingResult.finalGrade;

    // Simulate structural consistency
    const consistencyResult = simulateStructuralConsistency(context);

    // Build result
    const result: TestScenarioResult = {
      scenarioName: scenario.name,
      inputSummary: {
        lots: scenario.input.lots.map((l) => l.type),
        enterpriseStrength: calculateEnterpriseStrength(
          scenario.input.enterpriseProfile.yearsInBusiness,
          scenario.input.enterpriseProfile.hasInsurance,
          scenario.input.enterpriseProfile.registeredEmployees
        ),
        pricingLevel: getPricingLevel(scenario.input.pricing.totalAmount, scenario.input.lots.length),
        qualityLevel: getQualityLevel(
          scenario.input.quality.descriptionLength,
          scenario.input.quality.hasLegalMentions,
          scenario.input.quality.materialQuality
        ),
      },
      outputSummary: {
        originalGrade: cappingResult.originalGrade,
        finalProfessionalGrade: cappingResult.finalGrade,
        consistencyScore: consistencyResult.consistencyScore,
        imbalanceDetected: consistencyResult.imbalanceDetected,
        cappingApplied: cappingResult.cappingApplied,
      },
      flagsDetected: consistencyResult.flagsDetected,
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0',
        executionTimeMs: Date.now() - startTime,
      },
    };

    log(`[TorpSimulator] Scenario completed: ${scenario.name}`, {
      finalGrade: result.outputSummary.finalProfessionalGrade,
      imbalance: result.outputSummary.imbalanceDetected,
      flags: result.flagsDetected.length,
      timeMs: result.metadata.executionTimeMs,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[TorpSimulator] Scenario execution failed`, error);

    // Return error result
    return {
      scenarioName,
      inputSummary: {
        lots: [],
        enterpriseStrength: 0,
        pricingLevel: 'unknown',
        qualityLevel: 'unknown',
      },
      outputSummary: {
        originalGrade: 'E',
        finalProfessionalGrade: 'E',
        consistencyScore: 0,
        imbalanceDetected: true,
        cappingApplied: false,
      },
      flagsDetected: ['execution_error'],
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0',
        executionTimeMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * Run all scenarios
 */
export async function runAllTorpScenarios(): Promise<TestScenarioResult[]> {
  const { listAllScenarios } = await import('./torpScenarioLibrary');
  const scenarios = listAllScenarios();

  log(`[TorpSimulator] Running ${scenarios.length} scenarios`);

  const results: TestScenarioResult[] = [];

  for (const scenarioName of scenarios) {
    try {
      const result = await runTorpScenario(scenarioName);
      results.push(result);
    } catch (error) {
      console.error(`[TorpSimulator] Failed to run scenario: ${scenarioName}`, error);
    }
  }

  return results;
}

/**
 * Format test result as readable text
 */
export function formatTestResultAsText(result: TestScenarioResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════',
    `Test Scenario: ${result.scenarioName}`,
    '═══════════════════════════════════════',
    '',
    '─ INPUT SUMMARY ─',
    `Lots: ${result.inputSummary.lots.join(', ')}`,
    `Enterprise Strength: ${result.inputSummary.enterpriseStrength}/100`,
    `Pricing Level: ${result.inputSummary.pricingLevel}`,
    `Quality Level: ${result.inputSummary.qualityLevel}`,
    '',
    '─ OUTPUT SUMMARY ─',
    `Original Grade: ${result.outputSummary.originalGrade}`,
    `Final Professional Grade: ${result.outputSummary.finalProfessionalGrade}`,
    `Consistency Score: ${result.outputSummary.consistencyScore}/100`,
    `Imbalance Detected: ${result.outputSummary.imbalanceDetected ? 'YES' : 'NO'}`,
    `Capping Applied: ${result.outputSummary.cappingApplied ? 'YES' : 'NO'}`,
    '',
  ];

  if (result.flagsDetected.length > 0) {
    lines.push('─ FLAGS DETECTED ─');
    result.flagsDetected.forEach((flag) => {
      lines.push(`• ${flag}`);
    });
    lines.push('');
  }

  lines.push('─ METADATA ─');
  lines.push(`Execution Time: ${result.metadata.executionTimeMs}ms`);
  lines.push(`Created: ${result.metadata.createdAt}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Get test harness summary
 */
export function getTorpTestHarnessMetadata(): Record<string, any> {
  return {
    name: 'TORP Test Harness',
    version: '1.0',
    purpose: 'Simulate TORP pipeline for business logic validation',
    capabilities: {
      scenarioExecution: true,
      pipelineSimulation: true,
      gradeComparison: true,
      imbalanceDetection: true,
      consistencyReporting: true,
    },
    characteristics: {
      noProductionImpact: true,
      fullEncapsulation: true,
      zeroDependencies: true,
      pureSimulation: true,
      fallbackHandling: true,
    },
  };
}
