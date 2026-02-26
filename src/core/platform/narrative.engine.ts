/**
 * Narrative Engine v1.0
 * Generate deterministic public narrative from internal audit data
 * Pure conditional logic - no AI, no external APIs
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { CertificationRecord } from '@/core/platform/certification.manager';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Public narrative for external communication
 */
export interface PublicNarrative {
  strengths: string[];
  vigilancePoints: string[];
  summaryText: string;
  transparencyLevel: 'very_high' | 'high' | 'moderate' | 'low' | 'critical';
}

/**
 * Narrative result with metadata
 */
export interface NarrativeEngineResult {
  narrative: PublicNarrative;
  metadata: {
    generatedAt: string;
    version: string;
    gradeUsed: string;
    riskLevelUsed: string;
    lotsCount: number;
    obligationsCount: number;
  };
}

/**
 * Extract strengths based on grade and obligation types
 */
function extractStrengths(
  grade: string,
  typeBreakdown: Record<string, number>,
  severityBreakdown: Record<string, number>
): string[] {
  const strengths: string[] = [];

  // Grade-based strengths
  if (grade === 'A') {
    strengths.push('Exceptional compliance standard with minimal identified risks');
    strengths.push('Comprehensive regulatory framework implementation');
    strengths.push('Proactive risk management across all obligation types');
  } else if (grade === 'B') {
    strengths.push('Strong compliance foundation with effective risk controls');
    strengths.push('Good adherence to regulatory requirements');
    strengths.push('Systematic approach to obligation management');
  } else if (grade === 'C') {
    strengths.push('Foundational compliance framework in place');
    strengths.push('Basic regulatory controls implemented');
  } else if (grade === 'D') {
    strengths.push('Partial compliance measures identified');
  } else if (grade === 'E') {
    strengths.push('Serious non-compliance conditions require immediate attention');
  }

  // Type-based strengths
  const regulatoryCount = typeBreakdown['regulatory'] || 0;
  const legalCount = typeBreakdown['legal'] || 0;
  const commercialCount = typeBreakdown['commercial'] || 0;

  if (regulatoryCount > 0) {
    if (regulatoryCount >= 5) {
      strengths.push('Comprehensive regulatory obligation tracking system');
    } else if (regulatoryCount >= 3) {
      strengths.push('Multiple regulatory frameworks addressed');
    }
  }

  if (legalCount > 0) {
    strengths.push('Legal compliance framework established');
  }

  if (commercialCount > 0) {
    strengths.push('Commercial agreement management in place');
  }

  // Severity-based strengths
  const severityHigh = severityBreakdown['high'] || 0;
  const severityCritical = severityBreakdown['critical'] || 0;

  if (severityCritical === 0 && severityHigh <= 2) {
    strengths.push('No critical compliance gaps identified');
  }

  return strengths.length > 0 ? strengths : ['Assessment framework documented'];
}

/**
 * Extract vigilance points based on risk level and breakdown
 */
function extractVigilancePoints(
  riskLevel: string,
  typeBreakdown: Record<string, number>,
  severityBreakdown: Record<string, number>,
  grade: string
): string[] {
  const vigilancePoints: string[] = [];

  // Risk level-based vigilance
  if (riskLevel === 'critical') {
    vigilancePoints.push('Critical risk assessment identifies urgent compliance gaps');
    vigilancePoints.push('Immediate remediation plan required for identified risks');
    vigilancePoints.push('Escalated monitoring and reporting essential');
  } else if (riskLevel === 'high') {
    vigilancePoints.push('High-risk areas require enhanced compliance focus');
    vigilancePoints.push('Structured remediation timeline recommended');
    vigilancePoints.push('Regular progress review and verification recommended');
  } else if (riskLevel === 'medium') {
    vigilancePoints.push('Moderate-risk areas identified requiring attention');
    vigilancePoints.push('Systematic risk mitigation approach recommended');
    vigilancePoints.push('Periodic compliance review suggested');
  } else if (riskLevel === 'low') {
    vigilancePoints.push('Low-risk profile with stable compliance baseline');
    vigilancePoints.push('Maintenance compliance activities recommended');
  }

  // Severity-based vigilance
  const severityCritical = severityBreakdown['critical'] || 0;
  const severityHigh = severityBreakdown['high'] || 0;

  if (severityCritical > 0) {
    vigilancePoints.push(
      `${severityCritical} critical obligation(s) identified requiring immediate action`
    );
  }

  if (severityHigh > 2) {
    vigilancePoints.push(`${severityHigh} high-severity obligations require structured attention`);
  }

  // Type-based vigilance
  const advisoryCount = typeBreakdown['advisory'] || 0;
  if (advisoryCount > 0) {
    vigilancePoints.push(`${advisoryCount} advisory guidance item(s) require review`);
  }

  // Grade-based vigilance
  if (grade === 'D' || grade === 'E') {
    vigilancePoints.push('Significant compliance gaps require comprehensive remediation');
    vigilancePoints.push('Professional compliance assessment and support recommended');
  }

  return vigilancePoints.length > 0 ? vigilancePoints : ['Standard compliance monitoring recommended'];
}

/**
 * Generate transparency level based on data completeness and risk
 */
function calculateTransparencyLevel(
  grade: string,
  riskLevel: string,
  dataCompleteness: number
): 'very_high' | 'high' | 'moderate' | 'low' | 'critical' {
  // Critical transparency if critical risk
  if (riskLevel === 'critical') {
    return 'critical';
  }

  // High transparency for low risk and good data
  if (riskLevel === 'low' && dataCompleteness >= 90) {
    return 'very_high';
  }

  // Moderate-High for medium risk
  if (riskLevel === 'medium' && dataCompleteness >= 80) {
    return 'high';
  }

  if (riskLevel === 'medium') {
    return 'moderate';
  }

  // High risk but good data
  if (riskLevel === 'high' && dataCompleteness >= 85) {
    return 'high';
  }

  if (riskLevel === 'high') {
    return 'moderate';
  }

  // Grade-based fallback
  if (grade === 'A' || grade === 'B') {
    return 'high';
  }

  if (grade === 'C') {
    return 'moderate';
  }

  return 'low';
}

/**
 * Generate summary text based on grade and risk profile
 */
function generateSummaryText(
  grade: string,
  riskLevel: string,
  lotsCount: number,
  obligationsCount: number,
  typeBreakdown: Record<string, number>,
  severityBreakdown: Record<string, number>
): string {
  let summary = '';

  // Grade-based opening
  const gradeDescriptions: Record<string, string> = {
    A: 'exceptional',
    B: 'strong',
    C: 'satisfactory',
    D: 'concerning',
    E: 'critical',
  };

  const gradeDesc = gradeDescriptions[grade] || 'assessed';

  // Risk-based opening
  const riskDescriptions: Record<string, string> = {
    low: 'low-risk',
    medium: 'moderate-risk',
    high: 'high-risk',
    critical: 'critical-risk',
  };

  const riskDesc = riskDescriptions[riskLevel] || 'complex';

  // Build summary
  summary = `This project demonstrates a ${gradeDesc} compliance profile with ${riskDesc} characteristics.`;

  // Add lots information
  if (lotsCount > 0) {
    summary += ` The assessment covers ${lotsCount} distinct project lot${lotsCount !== 1 ? 's' : ''}.`;
  }

  // Add obligations information
  if (obligationsCount > 0) {
    summary += ` A total of ${obligationsCount} compliance obligation${obligationsCount !== 1 ? 's' : ''} have been identified and evaluated.`;
  }

  // Add type breakdown insight
  const regulatory = typeBreakdown['regulatory'] || 0;
  const legal = typeBreakdown['legal'] || 0;
  const commercial = typeBreakdown['commercial'] || 0;

  if (regulatory > 0 || legal > 0 || commercial > 0) {
    const types: string[] = [];
    if (legal > 0) types.push(`legal (${legal})`);
    if (regulatory > 0) types.push(`regulatory (${regulatory})`);
    if (commercial > 0) types.push(`commercial (${commercial})`);
    if (types.length > 0) {
      summary += ` Key obligation types include ${types.join(', ')}.`;
    }
  }

  // Add severity insight
  const critical = severityBreakdown['critical'] || 0;
  const high = severityBreakdown['high'] || 0;
  const medium = severityBreakdown['medium'] || 0;
  const low = severityBreakdown['low'] || 0;

  if (critical > 0) {
    summary += ` Critical attention is required for ${critical} critical obligation${critical !== 1 ? 's' : ''}.`;
  } else if (high > 0) {
    summary += ` Enhanced monitoring is needed for ${high} high-severity obligation${high !== 1 ? 's' : ''}.`;
  } else if (medium > 0) {
    summary += ` Standard oversight is recommended for ${medium} moderate-severity obligation${medium !== 1 ? 's' : ''}.`;
  }

  // Add risk mitigation guidance
  if (riskLevel === 'critical') {
    summary += ' Urgent remediation action is required to address identified gaps.';
  } else if (riskLevel === 'high') {
    summary += ' Structured remediation plan development is strongly recommended.';
  } else if (riskLevel === 'medium') {
    summary += ' Continued compliance efforts and periodic review are essential.';
  } else if (riskLevel === 'low') {
    summary += ' Maintenance of current compliance framework is recommended.';
  }

  return summary;
}

/**
 * Calculate data completeness percentage
 */
function calculateDataCompleteness(
  typeBreakdown: Record<string, number>,
  severityBreakdown: Record<string, number>,
  lotsCount: number,
  obligationsCount: number
): number {
  let completeness = 50; // Base score

  // Check type breakdown
  if (Object.keys(typeBreakdown).length >= 2) {
    completeness += 10;
  }
  if (Object.keys(typeBreakdown).length >= 3) {
    completeness += 5;
  }

  // Check severity breakdown
  if (Object.keys(severityBreakdown).length >= 2) {
    completeness += 10;
  }
  if (Object.keys(severityBreakdown).length >= 3) {
    completeness += 5;
  }

  // Check lots data
  if (lotsCount > 0) {
    completeness += 5;
  }
  if (lotsCount >= 2) {
    completeness += 5;
  }

  // Check obligations data
  if (obligationsCount > 0) {
    completeness += 5;
  }
  if (obligationsCount >= 5) {
    completeness += 5;
  }

  return Math.min(completeness, 100);
}

/**
 * Run Narrative Engine
 * Generate deterministic public narrative from certification and context
 */
export function runNarrativeEngine(
  executionContext: EngineExecutionContext,
  certification: CertificationRecord
): NarrativeEngineResult {
  const startTime = Date.now();

  try {
    log('[NarrativeEngine] Generating public narrative');

    // Extract data from context
    // Official grade source: finalProfessionalGrade (from trust capping), fall back to certification.grade
    const grade = executionContext.finalProfessionalGrade || certification.grade || 'C';
    const riskLevel = certification.riskLevel || 'medium';
    const typeBreakdown = executionContext.rules?.typeBreakdown || {};
    const severityBreakdown = executionContext.rules?.severityBreakdown || {};
    const lotsCount = executionContext.lots?.normalizedLots?.length || 0;
    const obligationsCount = executionContext.rules?.uniqueDetailedObligations?.length || 0;

    // Calculate data completeness
    const dataCompleteness = calculateDataCompleteness(
      typeBreakdown,
      severityBreakdown,
      lotsCount,
      obligationsCount
    );

    // Generate narrative components
    const strengths = extractStrengths(grade, typeBreakdown, severityBreakdown);
    const vigilancePoints = extractVigilancePoints(
      riskLevel,
      typeBreakdown,
      severityBreakdown,
      grade
    );
    const summaryText = generateSummaryText(
      grade,
      riskLevel,
      lotsCount,
      obligationsCount,
      typeBreakdown,
      severityBreakdown
    );
    const transparencyLevel = calculateTransparencyLevel(grade, riskLevel, dataCompleteness);

    // Build narrative
    const narrative: PublicNarrative = {
      strengths,
      vigilancePoints,
      summaryText,
      transparencyLevel,
    };

    const result: NarrativeEngineResult = {
      narrative,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0',
        gradeUsed: grade,
        riskLevelUsed: riskLevel,
        lotsCount,
        obligationsCount,
      },
    };

    log('[NarrativeEngine] Narrative generated successfully', {
      grade,
      riskLevel,
      transparencyLevel,
      strengthsCount: strengths.length,
      vigilancePointsCount: vigilancePoints.length,
      processingTime: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NarrativeEngine] Error generating narrative', error);

    // Return fallback narrative
    return {
      narrative: {
        strengths: ['Assessment framework in place'],
        vigilancePoints: ['Manual review and professional assessment recommended'],
        summaryText: 'A compliance assessment has been conducted. Professional review is recommended to determine specific compliance status.',
        transparencyLevel: 'low',
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0',
        gradeUsed: 'Unknown',
        riskLevelUsed: 'Unknown',
        lotsCount: 0,
        obligationsCount: 0,
      },
    };
  }
}

/**
 * Format narrative for public display
 */
export function formatNarrativeAsMarkdown(narrative: PublicNarrative): string {
  let markdown = '';

  markdown += '# Compliance Assessment Summary\n\n';

  markdown += '## Overview\n\n';
  markdown += `${narrative.summaryText}\n\n`;

  markdown += '## Strengths\n\n';
  narrative.strengths.forEach((strength) => {
    markdown += `- ${strength}\n`;
  });
  markdown += '\n';

  markdown += '## Areas Requiring Attention\n\n';
  narrative.vigilancePoints.forEach((point) => {
    markdown += `- ${point}\n`;
  });
  markdown += '\n';

  markdown += '## Transparency Level\n\n';
  const levelDescriptions: Record<string, string> = {
    very_high: 'Very High - Comprehensive data with minimal uncertainty',
    high: 'High - Complete assessment with good data coverage',
    moderate: 'Moderate - Standard assessment with acceptable data coverage',
    low: 'Low - Limited data availability affecting confidence',
    critical: 'Critical - Urgent issues requiring immediate attention',
  };
  markdown += `**${narrative.transparencyLevel.toUpperCase()}**: ${levelDescriptions[narrative.transparencyLevel] || 'Assessment transparency'}\n\n`;

  return markdown;
}

/**
 * Export narrative as JSON
 */
export function exportNarrativeAsJSON(narrative: PublicNarrative): string {
  return JSON.stringify(narrative, null, 2);
}

/**
 * Get Narrative Engine metadata
 */
export function getNarrativeEngineMetadata() {
  return {
    id: 'narrativeEngine',
    name: 'Narrative Engine',
    version: '1.0',
    description: 'Generate deterministic public narrative from internal audit data',
    type: 'narrative-generator',
    characteristics: [
      'Purely deterministic - no randomization',
      'No external APIs - no AI calls',
      'Conditional logic based on data signals',
      'Public-facing narrative generation',
      'Transparency level calculation',
    ],
    inputSources: [
      'certification.grade',
      'certification.riskLevel',
      'executionContext.rules.typeBreakdown',
      'executionContext.rules.severityBreakdown',
      'executionContext.lots.normalizedLots',
      'executionContext.rules.uniqueDetailedObligations',
    ],
    outputStructure: {
      strengths: 'Array of positive findings',
      vigilancePoints: 'Array of areas requiring attention',
      summaryText: 'Comprehensive narrative summary',
      transparencyLevel: 'Confidence assessment level',
    },
    transparencyLevels: {
      very_high: 'Excellent data coverage, minimal uncertainty',
      high: 'Good data coverage, standard confidence',
      moderate: 'Acceptable data coverage, reasonable confidence',
      low: 'Limited data, reduced confidence',
      critical: 'Critical issues present, urgency required',
    },
    gradeMapping: {
      A: 'exceptional',
      B: 'strong',
      C: 'satisfactory',
      D: 'concerning',
      E: 'critical',
    },
    riskMapping: {
      low: 'low-risk profile',
      medium: 'moderate-risk profile',
      high: 'high-risk profile',
      critical: 'critical-risk profile',
    },
  };
}

/**
 * Validate narrative output
 */
export function validateNarrative(narrative: PublicNarrative): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!narrative.strengths || !Array.isArray(narrative.strengths) || narrative.strengths.length === 0) {
    errors.push('Strengths array is missing or empty');
  }

  if (!narrative.vigilancePoints || !Array.isArray(narrative.vigilancePoints) || narrative.vigilancePoints.length === 0) {
    errors.push('Vigilance points array is missing or empty');
  }

  if (!narrative.summaryText || narrative.summaryText.length === 0) {
    errors.push('Summary text is missing or empty');
  }

  const validLevels = ['very_high', 'high', 'moderate', 'low', 'critical'];
  if (!validLevels.includes(narrative.transparencyLevel)) {
    errors.push(`Invalid transparency level: ${narrative.transparencyLevel}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get narrative statistics
 */
export function getNarrativeStatistics(narrative: PublicNarrative): {
  strengthCount: number;
  vigilancePointCount: number;
  summaryLength: number;
  transparencyScore: Record<string, number>;
} {
  const transparencyScores: Record<string, number> = {
    very_high: 5,
    high: 4,
    moderate: 3,
    low: 2,
    critical: 1,
  };

  return {
    strengthCount: narrative.strengths.length,
    vigilancePointCount: narrative.vigilancePoints.length,
    summaryLength: narrative.summaryText.length,
    transparencyScore: {
      level: transparencyScores[narrative.transparencyLevel] || 0,
      levelName: narrative.transparencyLevel,
    },
  };
}
