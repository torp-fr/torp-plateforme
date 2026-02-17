/**
 * TORP Knowledge Metadata v1.0
 * Statistics, analysis, and export utilities
 */

import {
  KnowledgeRegistry,
  KnowledgeStatistics,
  KnowledgeExport,
  KnowledgeSeverity,
} from './knowledgeTypes';
import { TORP_KNOWLEDGE_CORE } from './knowledgeRegistry';

/**
 * Get comprehensive knowledge statistics
 */
export function getKnowledgeStatistics(registry: KnowledgeRegistry = TORP_KNOWLEDGE_CORE): KnowledgeStatistics {
  try {
    // Count items
    const totalNorms = registry.normativeRules?.length || 0;
    const totalPricingRefs = registry.pricingReferences?.length || 0;
    const totalFraudPatterns = registry.fraudPatterns?.length || 0;
    const totalSectorCoefficients = registry.sectorCoefficients?.length || 0;
    const totalRiskFactors = registry.riskFactors?.length || 0;
    const totalJurisprudence = registry.jurisprudence?.length || 0;

    // Calculate severity distribution
    const severityDistribution: Record<KnowledgeSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    // Count norms by severity
    registry.normativeRules?.forEach((rule) => {
      if (rule.severity && severityDistribution[rule.severity] !== undefined) {
        severityDistribution[rule.severity]++;
      }
    });

    // Count fraud patterns by severity
    registry.fraudPatterns?.forEach((pattern) => {
      if (pattern.riskLevel && severityDistribution[pattern.riskLevel] !== undefined) {
        severityDistribution[pattern.riskLevel]++;
      }
    });

    // Count risk factors by severity
    registry.riskFactors?.forEach((factor) => {
      if (factor.impactLevel && severityDistribution[factor.impactLevel] !== undefined) {
        severityDistribution[factor.impactLevel]++;
      }
    });

    // Calculate category distribution
    const categoryDistribution: Record<string, number> = {};

    registry.normativeRules?.forEach((rule) => {
      const cat = rule.category || 'unknown';
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    });

    registry.fraudPatterns?.forEach((pattern) => {
      const cat = pattern.category || 'unknown';
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    });

    registry.riskFactors?.forEach((factor) => {
      const cat = factor.category || 'unknown';
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    });

    return {
      totalNorms,
      totalPricingRefs,
      totalFraudPatterns,
      totalSectorCoefficients,
      totalRiskFactors,
      totalJurisprudence,
      severityDistribution,
      categoryDistribution,
      lastUpdated: registry.metadata?.lastUpdated || new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KnowledgeMetadata] Failed to calculate statistics:', errorMessage);

    // Return minimal stats on error
    return {
      totalNorms: 0,
      totalPricingRefs: 0,
      totalFraudPatterns: 0,
      totalSectorCoefficients: 0,
      totalRiskFactors: 0,
      totalJurisprudence: 0,
      severityDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      categoryDistribution: {},
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Export knowledge registry as JSON
 */
export function exportKnowledgeAsJSON(
  registry: KnowledgeRegistry = TORP_KNOWLEDGE_CORE,
  exportedBy: string = 'system'
): string {
  try {
    const statistics = getKnowledgeStatistics(registry);

    const exportData: KnowledgeExport = {
      registry,
      statistics,
      exportedAt: new Date().toISOString(),
      exportedBy,
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KnowledgeMetadata] Failed to export as JSON:', errorMessage);
    throw error;
  }
}

/**
 * Export knowledge registry as formatted text
 */
export function exportKnowledgeAsText(
  registry: KnowledgeRegistry = TORP_KNOWLEDGE_CORE
): string {
  try {
    const stats = getKnowledgeStatistics(registry);
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════');
    lines.push('TORP KNOWLEDGE CORE EXPORT');
    lines.push('═══════════════════════════════════════════════');
    lines.push('');

    // Metadata
    lines.push('─ METADATA ─');
    lines.push(`Version: ${registry.metadata?.version || 'unknown'}`);
    lines.push(`Authority: ${registry.metadata?.authority || 'unknown'}`);
    lines.push(`Last Updated: ${registry.metadata?.lastUpdated || 'unknown'}`);
    lines.push('');

    // Statistics
    lines.push('─ STATISTICS ─');
    lines.push(`Normative Rules: ${stats.totalNorms}`);
    lines.push(`Pricing References: ${stats.totalPricingRefs}`);
    lines.push(`Fraud Patterns: ${stats.totalFraudPatterns}`);
    lines.push(`Sector Coefficients: ${stats.totalSectorCoefficients}`);
    lines.push(`Risk Factors: ${stats.totalRiskFactors}`);
    lines.push(`Jurisprudence References: ${stats.totalJurisprudence}`);
    lines.push('');

    // Severity Distribution
    lines.push('─ SEVERITY DISTRIBUTION ─');
    Object.entries(stats.severityDistribution).forEach(([severity, count]) => {
      lines.push(`${severity.padEnd(12)}: ${count}`);
    });
    lines.push('');

    // Category Distribution
    lines.push('─ CATEGORY DISTRIBUTION ─');
    Object.entries(stats.categoryDistribution).forEach(([category, count]) => {
      lines.push(`${category.padEnd(30)}: ${count}`);
    });
    lines.push('');

    // Normative Rules Summary
    lines.push('─ NORMATIVE RULES ─');
    registry.normativeRules?.slice(0, 5).forEach((rule) => {
      lines.push(`• ${rule.label} (${rule.severity})`);
    });
    if (registry.normativeRules?.length || 0 > 5) {
      lines.push(`... and ${(registry.normativeRules?.length || 0) - 5} more`);
    }
    lines.push('');

    // Pricing References Summary
    lines.push('─ PRICING REFERENCES ─');
    const lotTypes = new Set(registry.pricingReferences?.map((p) => p.lotType) || []);
    Array.from(lotTypes).slice(0, 5).forEach((lotType) => {
      const count = registry.pricingReferences?.filter((p) => p.lotType === lotType).length || 0;
      lines.push(`• ${lotType}: ${count} reference(s)`);
    });
    if (lotTypes.size > 5) {
      lines.push(`... and ${lotTypes.size - 5} more lot types`);
    }
    lines.push('');

    // Fraud Patterns Summary
    lines.push('─ FRAUD PATTERNS ─');
    registry.fraudPatterns?.slice(0, 5).forEach((pattern) => {
      lines.push(`• ${pattern.description.substring(0, 50)}... (${pattern.riskLevel})`);
    });
    if (registry.fraudPatterns?.length || 0 > 5) {
      lines.push(`... and ${(registry.fraudPatterns?.length || 0) - 5} more`);
    }
    lines.push('');

    // Sector Coefficients
    lines.push('─ SECTOR COEFFICIENTS ─');
    registry.sectorCoefficients?.forEach((coef) => {
      lines.push(
        `• ${coef.sector}: complexity=${coef.complexityMultiplier.toFixed(2)}, risk=${coef.riskMultiplier.toFixed(2)}`
      );
    });
    lines.push('');

    lines.push('═══════════════════════════════════════════════');

    return lines.join('\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KnowledgeMetadata] Failed to export as text:', errorMessage);
    throw error;
  }
}

/**
 * Get knowledge registry summary
 */
export function getKnowledgeSummary(
  registry: KnowledgeRegistry = TORP_KNOWLEDGE_CORE
): Record<string, any> {
  try {
    const stats = getKnowledgeStatistics(registry);

    return {
      metadata: registry.metadata,
      statistics: stats,
      hasNorms: stats.totalNorms > 0,
      hasPricing: stats.totalPricingRefs > 0,
      hasFraud: stats.totalFraudPatterns > 0,
      hasSectors: stats.totalSectorCoefficients > 0,
      hasRisks: stats.totalRiskFactors > 0,
      hasJurisprudence: stats.totalJurisprudence > 0,
      completeness: calculateCompleteness(stats),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KnowledgeMetadata] Failed to get summary:', errorMessage);
    throw error;
  }
}

/**
 * Calculate knowledge base completeness score
 */
function calculateCompleteness(stats: KnowledgeStatistics): number {
  const requiredMinimums = {
    norms: 5,
    pricing: 5,
    fraud: 3,
    sectors: 3,
    risks: 3,
  };

  let score = 0;
  let maxScore = 0;

  // Norms
  if (stats.totalNorms >= requiredMinimums.norms) {
    score += 20;
  } else if (stats.totalNorms > 0) {
    score += (stats.totalNorms / requiredMinimums.norms) * 20;
  }
  maxScore += 20;

  // Pricing
  if (stats.totalPricingRefs >= requiredMinimums.pricing) {
    score += 20;
  } else if (stats.totalPricingRefs > 0) {
    score += (stats.totalPricingRefs / requiredMinimums.pricing) * 20;
  }
  maxScore += 20;

  // Fraud
  if (stats.totalFraudPatterns >= requiredMinimums.fraud) {
    score += 20;
  } else if (stats.totalFraudPatterns > 0) {
    score += (stats.totalFraudPatterns / requiredMinimums.fraud) * 20;
  }
  maxScore += 20;

  // Sectors
  if (stats.totalSectorCoefficients >= requiredMinimums.sectors) {
    score += 20;
  } else if (stats.totalSectorCoefficients > 0) {
    score += (stats.totalSectorCoefficients / requiredMinimums.sectors) * 20;
  }
  maxScore += 20;

  // Risks
  if (stats.totalRiskFactors >= requiredMinimums.risks) {
    score += 20;
  } else if (stats.totalRiskFactors > 0) {
    score += (stats.totalRiskFactors / requiredMinimums.risks) * 20;
  }
  maxScore += 20;

  return Math.round((score / maxScore) * 100);
}

/**
 * Get knowledge health report
 */
export function getKnowledgeHealthReport(
  registry: KnowledgeRegistry = TORP_KNOWLEDGE_CORE
): { status: 'healthy' | 'degraded' | 'critical'; issues: string[] } {
  const issues: string[] = [];
  const stats = getKnowledgeStatistics(registry);

  if (stats.totalNorms === 0) {
    issues.push('No normative rules defined');
  }

  if (stats.totalPricingRefs === 0) {
    issues.push('No pricing references defined');
  }

  if (stats.totalFraudPatterns === 0) {
    issues.push('No fraud patterns defined');
  }

  if (stats.totalSectorCoefficients === 0) {
    issues.push('No sector coefficients defined');
  }

  if (stats.severityDistribution.critical === 0 && stats.totalNorms > 0) {
    issues.push('No critical-level norms defined');
  }

  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (issues.length > 3) {
    status = 'critical';
  } else if (issues.length > 0) {
    status = 'degraded';
  }

  return { status, issues };
}
