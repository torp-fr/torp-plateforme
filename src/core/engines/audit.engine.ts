/**
 * Audit Engine v1.0
 * Transform execution context into structured audit report
 * Pure data transformation without external dependencies
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';

/**
 * Audit report structure - Final deliverable from pipeline
 */
export interface AuditReport {
  executiveSummary: string;
  projectProfile: {
    totalLots: number;
    categories: string[];
    obligationCount: number;
    uniqueRuleCount: number;
  };
  riskAssessment: {
    riskScore: number;
    complexityImpact: number;
    globalScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    scoreBreakdown: {
      obligationCount: number;
      totalWeight: number;
      complexityCount: number;
      severityBreakdown?: Record<string, number>;
      typeBreakdown?: Record<string, number>;
      typeWeightBreakdown?: Record<string, number>;
    };
  };
  complianceFindings: {
    obligations: Array<{
      id: string;
      obligation: string;
      category: string;
      type: 'legal' | 'regulatory' | 'advisory' | 'commercial';
      severity: 'low' | 'medium' | 'high' | 'critical';
      weight: number;
      source?: string;
    }>;
    obligationsByType: {
      legal: number;
      regulatory: number;
      advisory: number;
      commercial: number;
    };
    obligationsBySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  recommendedActions: Array<{
    action: string;
    category: 'compliance' | 'safety' | 'process' | 'expertise';
    priority: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
  }>;
  processingStrategy: 'standard' | 'enhanced' | 'detailed' | 'expert';
  confidenceLevel: 'standard confidence' | 'moderate confidence' | 'elevated attention' | 'high scrutiny required';
  timestamps: {
    generatedAt: string;
    reportId: string;
  };
  meta: {
    engineVersion: string;
    createdAt: string;
    processingTime: number;
  };
}

/**
 * Audit Engine result structure
 */
export interface AuditEngineResult {
  report: AuditReport;
  status: 'completed' | 'partial' | 'error';
  warnings: string[];
  meta: {
    engineVersion: string;
    createdAt: string;
    processingTime: number;
  };
}

/**
 * Generate executive summary from execution context
 */
function generateExecutiveSummary(context: EngineExecutionContext): string {
  const lotCount = context.lots?.normalizedLots?.length || 0;
  const ruleCount = context.rules?.ruleCount || 0;
  const riskLevel = context.audit?.riskLevel || 'unknown';

  const categoryList = (context.lots?.normalizedLots || [])
    .map((lot: any) => lot.category)
    .filter((cat: string, idx: number, arr: string[]) => arr.indexOf(cat) === idx)
    .join(', ');

  const categories =
    categoryList.length > 0
      ? ` dans les catégories: ${categoryList}`
      : '';

  return `Projet analysé avec ${lotCount} lot(s)${categories}, ${ruleCount} règle(s) détectée(s), niveau de risque ${riskLevel}.`;
}

/**
 * Calculate confidence level based on risk assessment
 */
function calculateConfidence(
  context: EngineExecutionContext
): 'standard confidence' | 'moderate confidence' | 'elevated attention' | 'high scrutiny required' {
  const riskLevel = context.audit?.riskLevel || 'low';

  switch (riskLevel) {
    case 'critical':
      return 'high scrutiny required';
    case 'high':
      return 'elevated attention';
    case 'medium':
      return 'moderate confidence';
    case 'low':
    default:
      return 'standard confidence';
  }
}

/**
 * Generate report ID based on timestamp and hash
 */
function generateReportId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `AUDIT-${timestamp}-${random}`.toUpperCase();
}

/**
 * Run Audit Engine - transform context into structured report
 * Input: Complete EngineExecutionContext from all prior engines
 * Output: Structured AuditReport ready for export/display
 */
export async function runAuditEngine(
  executionContext: EngineExecutionContext
): Promise<AuditEngineResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    console.log('[AuditEngine] Starting audit report generation');

    // Extract and validate context data
    const audit = executionContext.audit || {};
    const rules = executionContext.rules || {};
    const enrichments = executionContext.enrichments || {};
    const lots = executionContext.lots?.normalizedLots || [];
    const detailedObligations = rules.uniqueDetailedObligations || [];

    // Validate completeness
    if (!audit.riskLevel) {
      warnings.push('Risk assessment data incomplete - using defaults');
    }
    if (!rules.uniqueDetailedObligations || detailedObligations.length === 0) {
      warnings.push('No obligations found - check rule engine results');
    }
    if (!enrichments.recommendations || enrichments.recommendations.length === 0) {
      warnings.push('No enrichment recommendations - check enrichment engine');
    }

    // Build obligations by type and severity
    const obligationsByType = {
      legal: 0,
      regulatory: 0,
      advisory: 0,
      commercial: 0,
    };

    const obligationsBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    detailedObligations.forEach((oblig: any) => {
      obligationsByType[oblig.ruleType as keyof typeof obligationsByType]++;
      obligationsBySeverity[oblig.severity as keyof typeof obligationsBySeverity]++;
    });

    // Extract unique categories
    const categories = Array.from(new Set(lots.map((lot: any) => lot.category))).filter(
      (cat: any) => cat !== 'unknown'
    ) as string[];

    // Build the audit report
    const report: AuditReport = {
      executiveSummary: generateExecutiveSummary(executionContext),
      projectProfile: {
        totalLots: lots.length,
        categories,
        obligationCount: rules.obligationCount || 0,
        uniqueRuleCount: rules.ruleCount || 0,
      },
      riskAssessment: {
        riskScore: audit.riskScore || 0,
        complexityImpact: audit.complexityImpact || 0,
        globalScore: audit.globalScore || 100,
        riskLevel: audit.riskLevel || 'low',
        scoreBreakdown: audit.scoreBreakdown || {
          obligationCount: 0,
          totalWeight: 0,
          complexityCount: 0,
        },
      },
      complianceFindings: {
        obligations: detailedObligations.map((oblig: any) => ({
          id: oblig.id,
          obligation: oblig.obligation,
          category: oblig.category,
          type: oblig.ruleType,
          severity: oblig.severity,
          weight: oblig.weight,
          source: oblig.source,
        })),
        obligationsByType,
        obligationsBySeverity,
      },
      recommendedActions: (enrichments.recommendations || []).map((rec: any) => ({
        action: rec.action,
        category: rec.category,
        priority: rec.priority,
        reason: rec.reason,
      })),
      processingStrategy: enrichments.processingStrategy || 'standard',
      confidenceLevel: calculateConfidence(executionContext),
      timestamps: {
        generatedAt: new Date().toISOString(),
        reportId: generateReportId(),
      },
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
    };

    console.log('[AuditEngine] Audit report generated successfully', {
      projectProfile: report.projectProfile,
      riskLevel: report.riskAssessment.riskLevel,
      obligationCount: report.complianceFindings.obligations.length,
      recommendationCount: report.recommendedActions.length,
      processingStrategy: report.processingStrategy,
      processingTime: report.meta.processingTime,
    });

    const result: AuditEngineResult = {
      report,
      status: warnings.length === 0 ? 'completed' : 'partial',
      warnings,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
    };

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AuditEngine] Error during audit report generation', error);

    warnings.push(`Critical error: ${errorMessage}`);

    // Return minimal viable report on error
    const emergencyReport: AuditReport = {
      executiveSummary: 'Error generating audit report - manual review required',
      projectProfile: {
        totalLots: 0,
        categories: [],
        obligationCount: 0,
        uniqueRuleCount: 0,
      },
      riskAssessment: {
        riskScore: 0,
        complexityImpact: 0,
        globalScore: 0,
        riskLevel: 'critical',
        scoreBreakdown: {
          obligationCount: 0,
          totalWeight: 0,
          complexityCount: 0,
        },
      },
      complianceFindings: {
        obligations: [],
        obligationsByType: { legal: 0, regulatory: 0, advisory: 0, commercial: 0 },
        obligationsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      recommendedActions: [
        {
          action: 'high_risk_review_required',
          category: 'expertise',
          priority: 'critical',
          reason: 'Error during audit generation - expert review mandatory',
        },
      ],
      processingStrategy: 'expert',
      confidenceLevel: 'high scrutiny required',
      timestamps: {
        generatedAt: new Date().toISOString(),
        reportId: generateReportId(),
      },
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
    };

    return {
      report: emergencyReport,
      status: 'error',
      warnings,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
    };
  }
}

/**
 * Get Audit Engine metadata
 */
export function getAuditEngineMetadata() {
  return {
    id: 'auditEngine',
    name: 'Audit Engine',
    version: '1.0',
    description: 'Transform execution context into structured audit report',
    capabilities: [
      'Executive summary generation',
      'Risk assessment reporting',
      'Compliance findings compilation',
      'Action recommendations aggregation',
      'Report generation and validation',
    ],
    inputs: [
      'executionContext with complete pipeline results',
      'audit results from scoringEngine',
      'compliance findings from ruleEngine',
      'recommendations from enrichmentEngine',
      'project profile from contextEngine and lotEngine',
    ],
    outputs: ['Structured AuditReport with all assessment data'],
    dependencies: [
      'contextEngine',
      'lotEngine',
      'ruleEngine',
      'scoringEngine',
      'enrichmentEngine',
    ],
    reportStructure: {
      sections: [
        'executiveSummary',
        'projectProfile',
        'riskAssessment',
        'complianceFindings',
        'recommendedActions',
        'processingStrategy',
        'confidenceLevel',
      ],
    },
  };
}

/**
 * Format report as markdown for display
 */
export function formatReportAsMarkdown(report: AuditReport): string {
  let markdown = '';

  markdown += `# Audit Report ${report.timestamps.reportId}\n\n`;
  markdown += `**Generated:** ${new Date(report.timestamps.generatedAt).toLocaleString()}\n\n`;

  markdown += `## Executive Summary\n\n`;
  markdown += `${report.executiveSummary}\n\n`;

  markdown += `## Project Profile\n\n`;
  markdown += `- **Total Lots:** ${report.projectProfile.totalLots}\n`;
  markdown += `- **Categories:** ${report.projectProfile.categories.join(', ') || 'None'}\n`;
  markdown += `- **Obligations:** ${report.projectProfile.obligationCount}\n`;
  markdown += `- **Unique Rules:** ${report.projectProfile.uniqueRuleCount}\n\n`;

  markdown += `## Risk Assessment\n\n`;
  markdown += `- **Risk Level:** ${report.riskAssessment.riskLevel.toUpperCase()}\n`;
  markdown += `- **Global Score:** ${report.riskAssessment.globalScore}/100\n`;
  markdown += `- **Risk Score:** ${report.riskAssessment.riskScore}\n`;
  markdown += `- **Complexity Impact:** ${report.riskAssessment.complexityImpact}\n\n`;

  markdown += `## Compliance Findings\n\n`;
  markdown += `### By Type\n`;
  const byType = report.complianceFindings.obligationsByType;
  markdown += `- **Legal:** ${byType.legal}\n`;
  markdown += `- **Regulatory:** ${byType.regulatory}\n`;
  markdown += `- **Advisory:** ${byType.advisory}\n`;
  markdown += `- **Commercial:** ${byType.commercial}\n\n`;

  markdown += `### By Severity\n`;
  const bySeverity = report.complianceFindings.obligationsBySeverity;
  markdown += `- **Critical:** ${bySeverity.critical}\n`;
  markdown += `- **High:** ${bySeverity.high}\n`;
  markdown += `- **Medium:** ${bySeverity.medium}\n`;
  markdown += `- **Low:** ${bySeverity.low}\n\n`;

  if (report.complianceFindings.obligations.length > 0) {
    markdown += `### Obligations List\n\n`;
    report.complianceFindings.obligations.forEach((oblig) => {
      markdown += `- **${oblig.id}** (${oblig.type}/${oblig.severity}): ${oblig.obligation}\n`;
    });
    markdown += '\n';
  }

  markdown += `## Recommended Actions\n\n`;
  if (report.recommendedActions.length > 0) {
    report.recommendedActions.forEach((action) => {
      markdown += `- **[${action.priority.toUpperCase()}]** ${action.action}: ${action.reason}\n`;
    });
  } else {
    markdown += 'No recommendations at this time.\n';
  }
  markdown += '\n';

  markdown += `## Processing Strategy\n\n`;
  markdown += `- **Strategy:** ${report.processingStrategy}\n`;
  markdown += `- **Confidence Level:** ${report.confidenceLevel}\n\n`;

  return markdown;
}

/**
 * Export report as JSON
 */
export function exportReportAsJSON(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}
