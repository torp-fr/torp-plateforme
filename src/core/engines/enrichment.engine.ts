/**
 * Enrichment Engine v1.0
 * Conditional logic-based enrichment without external APIs
 * Pure internal decision-making based on execution context
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Enrichment action types
 */
export type EnrichmentAction =
  | 'verify_legal_compliance'
  | 'check_urban_planning'
  | 'high_risk_review_required'
  | 'inspect_electrical_safety'
  | 'inspect_plumbing_safety'
  | 'check_roof_structure'
  | 'advisory_rules_only'
  | 'commercial_rules_present'
  | 'multi_category_project'
  | 'single_lot_project'
  | 'low_complexity_standard_process'
  | 'medium_complexity_enhanced_review'
  | 'high_complexity_detailed_analysis'
  | 'critical_complexity_expert_required';

/**
 * Enrichment recommendation structure
 */
export interface EnrichmentRecommendation {
  action: EnrichmentAction;
  category: 'compliance' | 'safety' | 'process' | 'expertise';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

/**
 * Enrichment Engine result
 */
export interface EnrichmentEngineResult {
  actions: EnrichmentAction[];
  recommendations: EnrichmentRecommendation[];
  actionCount: number;
  recommendationCount: number;
  riskProfile: {
    hasLegalObligations: boolean;
    hasRegulatoryObligations: boolean;
    hasAdvisoryObligations: boolean;
    hasCommercialRules: boolean;
    projectComplexity: 'simple' | 'moderate' | 'complex' | 'critical';
  };
  processingStrategy: 'standard' | 'enhanced' | 'detailed' | 'expert';
  meta: {
    engineVersion: string;
    createdAt: string;
    processingTime: number;
  };
}

/**
 * Run Enrichment Engine - determine enrichment actions based on context
 * Input: EngineExecutionContext with complete pipeline results
 * Output: Enrichment actions and recommendations
 */
export async function runEnrichmentEngine(
  executionContext: EngineExecutionContext
): Promise<EnrichmentEngineResult> {
  const startTime = Date.now();

  try {
    log('[EnrichmentEngine] Starting enrichment analysis');

    // Extract data from execution context
    const typeBreakdown = executionContext.rules?.typeBreakdown || {
      legal: 0,
      regulatory: 0,
      advisory: 0,
      commercial: 0,
    };
    const severityBreakdown = executionContext.rules?.severityBreakdown || {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const normalizedLots = executionContext.lots?.normalizedLots || [];
    const riskLevel = executionContext.audit?.riskLevel || 'low';
    const globalScore = executionContext.audit?.globalScore || 100;
    const obligationCount = executionContext.rules?.obligationCount || 0;

    // Initialize action and recommendation arrays
    const actions: EnrichmentAction[] = [];
    const recommendations: EnrichmentRecommendation[] = [];

    // ===== COMPLIANCE RULES =====
    // Check for legal obligations
    if (typeBreakdown.legal > 0) {
      actions.push('verify_legal_compliance');
      recommendations.push({
        action: 'verify_legal_compliance',
        category: 'compliance',
        priority: 'critical',
        reason: `Project has ${typeBreakdown.legal} legal obligation(s) requiring compliance verification`,
      });
    }

    // Check for regulatory obligations
    if (typeBreakdown.regulatory > 0) {
      const regCount = typeBreakdown.regulatory;
      recommendations.push({
        action: 'verify_legal_compliance', // Related action
        category: 'compliance',
        priority: 'high',
        reason: `Project has ${regCount} regulatory obligation(s) requiring verification`,
      });
    }

    // ===== CATEGORY-SPECIFIC ACTIONS =====
    // Check for electrical work
    const hasElectrical = normalizedLots.some(
      (lot: any) => lot.category === 'electricite'
    );
    if (hasElectrical) {
      actions.push('inspect_electrical_safety');
      recommendations.push({
        action: 'inspect_electrical_safety',
        category: 'safety',
        priority: severityBreakdown.critical > 0 ? 'critical' : 'high',
        reason: 'Electrical work requires safety inspection per NFC 15-100',
      });
    }

    // Check for plumbing work
    const hasPlumbing = normalizedLots.some(
      (lot: any) => lot.category === 'plomberie'
    );
    if (hasPlumbing) {
      actions.push('inspect_plumbing_safety');
      recommendations.push({
        action: 'inspect_plumbing_safety',
        category: 'safety',
        priority: 'high',
        reason: 'Plumbing work requires water safety and health code compliance',
      });
    }

    // Check for roofing work
    const hasRoofing = normalizedLots.some(
      (lot: any) => lot.category === 'toiture'
    );
    if (hasRoofing) {
      actions.push('check_roof_structure');
      recommendations.push({
        action: 'check_roof_structure',
        category: 'safety',
        priority: 'high',
        reason: 'Roof work requires urban planning and structural compliance',
      });

      // Additional check for urban planning
      actions.push('check_urban_planning');
      recommendations.push({
        action: 'check_urban_planning',
        category: 'compliance',
        priority: 'medium',
        reason: 'Roof modifications may require prior urban planning declaration',
      });
    }

    // ===== RULE TYPE ANALYSIS =====
    // Check for advisory-only rules
    if (
      typeBreakdown.advisory > 0 &&
      typeBreakdown.legal === 0 &&
      typeBreakdown.regulatory === 0
    ) {
      actions.push('advisory_rules_only');
      recommendations.push({
        action: 'advisory_rules_only',
        category: 'process',
        priority: 'low',
        reason: 'Project contains only advisory recommendations (best practices)',
      });
    }

    // Check for commercial rules
    if (typeBreakdown.commercial > 0) {
      actions.push('commercial_rules_present');
      recommendations.push({
        action: 'commercial_rules_present',
        category: 'process',
        priority: 'low',
        reason: 'Project includes commercial best practices for customer satisfaction',
      });
    }

    // ===== COMPLEXITY ANALYSIS =====
    const lotCount = normalizedLots.length;

    // Single lot vs multiple lots
    if (lotCount === 1) {
      actions.push('single_lot_project');
    } else if (lotCount > 1) {
      actions.push('multi_category_project');
      recommendations.push({
        action: 'multi_category_project',
        category: 'process',
        priority: 'medium',
        reason: `Project spans ${lotCount} categories requiring coordinated approach`,
      });
    }

    // ===== RISK LEVEL ACTIONS =====
    // Critical risk projects
    if (riskLevel === 'critical') {
      actions.push('high_risk_review_required');
      recommendations.push({
        action: 'high_risk_review_required',
        category: 'expertise',
        priority: 'critical',
        reason: `Project classified as CRITICAL risk (score: ${globalScore}). Expert review required.`,
      });
    }

    // ===== PROCESSING STRATEGY DETERMINATION =====
    let processingStrategy: 'standard' | 'enhanced' | 'detailed' | 'expert';
    let projectComplexity: 'simple' | 'moderate' | 'complex' | 'critical';

    if (riskLevel === 'critical') {
      processingStrategy = 'expert';
      projectComplexity = 'critical';
      recommendations.push({
        action: 'critical_complexity_expert_required',
        category: 'expertise',
        priority: 'critical',
        reason: `Critical project: ${obligationCount} obligations, severity breakdown: ${JSON.stringify(severityBreakdown)}`,
      });
    } else if (riskLevel === 'high') {
      processingStrategy = 'detailed';
      projectComplexity = 'complex';
      recommendations.push({
        action: 'high_complexity_detailed_analysis',
        category: 'process',
        priority: 'high',
        reason: `Complex project: ${obligationCount} obligations requiring detailed analysis`,
      });
    } else if (riskLevel === 'medium') {
      processingStrategy = 'enhanced';
      projectComplexity = 'moderate';
      recommendations.push({
        action: 'medium_complexity_enhanced_review',
        category: 'process',
        priority: 'medium',
        reason: `Moderate complexity: ${obligationCount} obligations requiring enhanced review`,
      });
    } else {
      processingStrategy = 'standard';
      projectComplexity = 'simple';
      recommendations.push({
        action: 'low_complexity_standard_process',
        category: 'process',
        priority: 'low',
        reason: 'Simple project: Standard processing sufficient',
      });
    }

    // Deduplicate actions (keep order, remove duplicates)
    const uniqueActions = Array.from(new Set(actions));

    // Deduplicate recommendations by action
    const seenActions = new Set<EnrichmentAction>();
    const uniqueRecommendations: EnrichmentRecommendation[] = [];
    recommendations.forEach((rec) => {
      if (!seenActions.has(rec.action)) {
        seenActions.add(rec.action);
        uniqueRecommendations.push(rec);
      }
    });

    const processingTime = Date.now() - startTime;

    const result: EnrichmentEngineResult = {
      actions: uniqueActions,
      recommendations: uniqueRecommendations,
      actionCount: uniqueActions.length,
      recommendationCount: uniqueRecommendations.length,
      riskProfile: {
        hasLegalObligations: typeBreakdown.legal > 0,
        hasRegulatoryObligations: typeBreakdown.regulatory > 0,
        hasAdvisoryObligations: typeBreakdown.advisory > 0,
        hasCommercialRules: typeBreakdown.commercial > 0,
        projectComplexity,
      },
      processingStrategy,
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime,
      },
    };

    log('[EnrichmentEngine] Enrichment analysis completed', {
      actionCount: result.actionCount,
      recommendationCount: result.recommendationCount,
      processingStrategy: result.processingStrategy,
      projectComplexity: result.riskProfile.projectComplexity,
      processingTime,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[EnrichmentEngine] Error during enrichment analysis', error);

    // Return graceful error result
    return {
      actions: ['high_risk_review_required'],
      recommendations: [
        {
          action: 'high_risk_review_required',
          category: 'expertise',
          priority: 'critical',
          reason: 'Error during enrichment analysis - expert review required',
        },
      ],
      actionCount: 1,
      recommendationCount: 1,
      riskProfile: {
        hasLegalObligations: false,
        hasRegulatoryObligations: false,
        hasAdvisoryObligations: false,
        hasCommercialRules: false,
        projectComplexity: 'critical',
      },
      processingStrategy: 'expert',
      meta: {
        engineVersion: '1.0',
        createdAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      },
    };
  }
}

/**
 * Get Enrichment Engine metadata
 */
export function getEnrichmentEngineMetadata() {
  return {
    id: 'enrichmentEngine',
    name: 'Enrichment Engine',
    version: '1.0',
    description:
      'Determine enrichment actions based on project context and risk profile',
    capabilities: [
      'Risk-based action determination',
      'Category-specific recommendations',
      'Processing strategy selection',
      'Compliance-driven enrichment',
      'Safety-focused recommendations',
    ],
    inputs: [
      'typeBreakdown from ruleEngine',
      'severityBreakdown from ruleEngine',
      'normalizedLots from lotEngine',
      'riskLevel from scoringEngine',
      'globalScore from scoringEngine',
      'obligationCount from ruleEngine',
    ],
    outputs: [
      'actions: list of enrichment actions needed',
      'recommendations: detailed action recommendations with priority',
      'riskProfile: summary of obligations and complexity',
      'processingStrategy: standard|enhanced|detailed|expert',
    ],
    dependencies: [
      'ruleEngine',
      'lotEngine',
      'scoringEngine',
      'contextEngine',
    ],
    actionCategories: {
      compliance: 'Legal and regulatory compliance verification',
      safety: 'Safety inspection and verification',
      process: 'Process and workflow determination',
      expertise: 'Level of expertise required',
    },
    processingStrategies: {
      standard: 'Simple project, standard verification sufficient',
      enhanced: 'Moderate complexity, enhanced review needed',
      detailed: 'Complex project, detailed analysis required',
      expert: 'Critical project, expert review mandatory',
    },
  };
}

/**
 * Get action description
 */
export function getActionDescription(
  action: EnrichmentAction
): { title: string; description: string } {
  const descriptions: Record<EnrichmentAction, { title: string; description: string }> = {
    verify_legal_compliance: {
      title: 'Verify Legal Compliance',
      description: 'Ensure project meets all legal and regulatory requirements',
    },
    check_urban_planning: {
      title: 'Check Urban Planning',
      description: 'Verify urban planning compliance and declarations',
    },
    high_risk_review_required: {
      title: 'High-Risk Review Required',
      description: 'Critical project requires expert review',
    },
    inspect_electrical_safety: {
      title: 'Inspect Electrical Safety',
      description: 'Conduct electrical safety inspection per NFC 15-100',
    },
    inspect_plumbing_safety: {
      title: 'Inspect Plumbing Safety',
      description: 'Verify plumbing and water safety compliance',
    },
    check_roof_structure: {
      title: 'Check Roof Structure',
      description: 'Verify roof structural integrity and compliance',
    },
    advisory_rules_only: {
      title: 'Advisory Rules Only',
      description: 'Project contains only advisory recommendations',
    },
    commercial_rules_present: {
      title: 'Commercial Rules Present',
      description: 'Project includes commercial best practices',
    },
    multi_category_project: {
      title: 'Multi-Category Project',
      description: 'Project spans multiple work categories',
    },
    single_lot_project: {
      title: 'Single Lot Project',
      description: 'Project involves single work category',
    },
    low_complexity_standard_process: {
      title: 'Standard Process',
      description: 'Simple project suitable for standard workflow',
    },
    medium_complexity_enhanced_review: {
      title: 'Enhanced Review',
      description: 'Moderate complexity requires enhanced review',
    },
    high_complexity_detailed_analysis: {
      title: 'Detailed Analysis',
      description: 'Complex project requires detailed analysis',
    },
    critical_complexity_expert_required: {
      title: 'Expert Required',
      description: 'Critical project requires expert involvement',
    },
  };

  return descriptions[action] || {
    title: action,
    description: 'Unknown action',
  };
}
