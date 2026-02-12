/**
 * RAG Service - Retrieval Augmented Generation
 * Utilise données enrichies pour recommandations contextualisées
 */

import type { EnrichedClientData } from '@/types/enrichment';
import type { CCFData } from '@/components/guided-ccf/GuidedCCF';

// ============================================================================
// TYPES
// ============================================================================

export interface RagContext {
  enrichedData: EnrichedClientData;
  ccfData: CCFData;
  query?: string;
}

export interface RagRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'regulatory' | 'energy' | 'budget' | 'timeline' | 'quality';
  impact?: string;
}

export interface RagAlert {
  type: 'warning' | 'info' | 'critical';
  message: string;
  severity: number; // 1-5
}

export interface RagAnalysis {
  conformity_score: number; // 0-100
  overall_score: number; // 0-100
  status: 'excellent' | 'good' | 'warning' | 'critical';
  alerts: RagAlert[];
  recommendations: RagRecommendation[];
  context_summary: string;
}

// ============================================================================
// RAG CONTEXT BUILDING
// ============================================================================

export function buildRagContext(context: RagContext): string {
  const { enrichedData, ccfData } = context;

  const parts: string[] = [
    '# PROJECT CONTEXT',
    `Project: ${ccfData.projectName}`,
    `Type: ${ccfData.projectType}`,
    `Budget: €${ccfData.budget}`,
    `Timeline: ${ccfData.timeline}`,
    '',

    '# CLIENT LOCATION',
    `Address: ${enrichedData.addressText}`,
    `Coordinates: ${enrichedData.coordinates?.latitude}, ${enrichedData.coordinates?.longitude}`,
    '',

    '# BUILDING INFO',
    `Year Built: ${enrichedData.cadastre?.yearConstruction || 'Unknown'}`,
    `Type: ${enrichedData.cadastre?.buildingType || 'Unknown'}`,
    `Total Surface: ${enrichedData.cadastre?.totalSurface || 'Unknown'} m²`,
    `Habitable Surface: ${enrichedData.cadastre?.habitableSurface || 'Unknown'} m²`,
    `Floors: ${enrichedData.cadastre?.floors || 'Unknown'}`,
    '',

    '# ENERGY PERFORMANCE',
    `DPE Class: ${enrichedData.dpe?.class || 'Unknown'}`,
    `Consumption: ${enrichedData.dpe?.consumption || 'Unknown'} kWh/m²/an`,
    `Emissions: ${enrichedData.dpe?.emissions || 'Unknown'} kg CO2/m²/an`,
    '',

    '# REGULATORY CONTEXT',
    `ABF Zone: ${enrichedData.regulatory?.abfZone ? 'YES - Restricted' : 'No'}`,
    `Flood Risk: ${enrichedData.regulatory?.floodableZone ? 'YES - PPRI Zone' : 'No'}`,
    `Seismic Zone: ${enrichedData.regulatory?.seismicZone || 'Standard'}`,
    `Co-owned: ${enrichedData.regulatory?.coOwned ? 'YES' : 'No'}`,
    `Permit Required: ${enrichedData.regulatory?.permitRequired ? 'YES' : 'No'}`,
    '',

    '# PROJECT OBJECTIVES',
    enrichedData.dpe?.class ? `Improve DPE from ${enrichedData.dpe.class}` : 'Improve building',
    ccfData.objectives?.join(', ') || 'Unspecified',
    '',

    '# CONSTRAINTS',
    ccfData.constraints?.join(', ') || 'None specified',
  ];

  return parts.join('\n');
}

// ============================================================================
// REGULATORY ANALYSIS
// ============================================================================

export function analyzeRegulatory(enrichedData: EnrichedClientData, ccfData: CCFData): {
  alerts: RagAlert[];
  recommendations: RagRecommendation[];
} {
  const alerts: RagAlert[] = [];
  const recommendations: RagRecommendation[] = [];

  // ABF Zone
  if (enrichedData.regulatory?.abfZone) {
    alerts.push({
      type: 'critical',
      message:
        '🏛️ Architectes Bâtiments de France Zone: Architectural design approval required for exterior modifications',
      severity: 4,
    });
    recommendations.push({
      title: 'ABF Pre-approval Required',
      description:
        'Obtain approval from ABF before finalizing architectural design. Factor in 6-8 weeks for review.',
      priority: 'high',
      category: 'regulatory',
      impact: 'Timeline extension',
    });
  }

  // Flood Risk
  if (enrichedData.regulatory?.floodableZone) {
    alerts.push({
      type: 'warning',
      message: '🌊 Flood Risk Zone: PPRI regulations apply - Building protection measures required',
      severity: 3,
    });
    recommendations.push({
      title: 'Flood Risk Assessment',
      description:
        'Commission flood risk analysis. May require elevated installations or reinforced basement',
      priority: 'high',
      category: 'regulatory',
      impact: 'Potential cost increase',
    });
  }

  // Seismic Zone
  if (enrichedData.regulatory?.seismicZone && enrichedData.regulatory.seismicZone !== 'zone1') {
    alerts.push({
      type: 'info',
      message: `⚠️ Seismic Zone ${enrichedData.regulatory.seismicZone}: Structural reinforcement may be required`,
      severity: 2,
    });
    recommendations.push({
      title: 'Seismic Compliance',
      description:
        'Verify structural modifications comply with seismic standards for this zone. May require engineer approval.',
      priority: 'medium',
      category: 'regulatory',
    });
  }

  // Co-ownership Rules
  if (enrichedData.regulatory?.coOwned && enrichedData.regulatory?.coOwnershipRulesConstraining) {
    alerts.push({
      type: 'warning',
      message: '🏢 Restrictive Co-ownership Rules: Significant work restrictions apply',
      severity: 3,
    });
    recommendations.push({
      title: 'Co-ownership Approval Process',
      description:
        'Obtain co-ownership assembly approval. Budget for mandatory insurance and legal review (€1,500-3,000)',
      priority: 'high',
      category: 'regulatory',
      impact: 'Additional cost & timeline',
    });
  }

  return { alerts, recommendations };
}

// ============================================================================
// ENERGY ANALYSIS
// ============================================================================

export function analyzeEnergy(enrichedData: EnrichedClientData, ccfData: CCFData): {
  alerts: RagAlert[];
  recommendations: RagRecommendation[];
} {
  const alerts: RagAlert[] = [];
  const recommendations: RagRecommendation[] = [];

  if (!enrichedData.dpe?.available) {
    recommendations.push({
      title: 'DPE Diagnostic Missing',
      description: 'Obtain current DPE diagnosis (€200-400). Required by law for property transactions.',
      priority: 'high',
      category: 'energy',
    });
    return { alerts, recommendations };
  }

  const dpeClass = enrichedData.dpe?.class;
  const consumption = enrichedData.dpe?.consumption || 0;

  // Poor DPE
  if (dpeClass && ['E', 'F', 'G'].includes(dpeClass)) {
    alerts.push({
      type: 'critical',
      message: `🔴 DPE Class ${dpeClass}: Very low energy efficiency (${consumption} kWh/m²/an)`,
      severity: 5,
    });

    recommendations.push({
      title: 'Major Energy Retrofit',
      description:
        'Comprehensive renovation (insulation, heating, windows) needed. Budget: €200-500/m² habitables',
      priority: 'high',
      category: 'energy',
      impact: 'Significant budget impact',
    });
  }

  // Moderate DPE
  if (dpeClass && ['C', 'D'].includes(dpeClass)) {
    alerts.push({
      type: 'info',
      message: `⚠️ DPE Class ${dpeClass}: Moderate efficiency (${consumption} kWh/m²/an)`,
      severity: 2,
    });

    recommendations.push({
      title: 'Targeted Energy Improvements',
      description: 'Focus on heating system and insulation. Budget: €50-150/m² habitables',
      priority: 'medium',
      category: 'energy',
    });
  }

  // Check if project includes energy improvements
  if (
    ccfData.objectives?.includes('Améliorer l\'efficacité énergétique') &&
    consumption > 150
  ) {
    recommendations.push({
      title: 'RE2020 Compliance',
      description:
        'Major renovations must meet RE2020 standards. Factor in 15-20% cost increase for compliance',
      priority: 'high',
      category: 'energy',
    });
  }

  return { alerts, recommendations };
}

// ============================================================================
// BUDGET ANALYSIS
// ============================================================================

export function analyzeBudget(enrichedData: EnrichedClientData, ccfData: CCFData): {
  alerts: RagAlert[];
  recommendations: RagRecommendation[];
  marketRatio: number;
} {
  const alerts: RagAlert[] = [];
  const recommendations: RagRecommendation[] = [];

  const surface = enrichedData.cadastre?.habitableSurface || enrichedData.cadastre?.totalSurface || 100;
  const budgetPerM2 = ccfData.budget / surface;

  // Budget benchmarks by project type (France 2024)
  const benchmarks: Record<string, number> = {
    renovation: 300, // €/m²
    neuf: 2500, // €/m²
    extension: 2000, // €/m²
    maintenance: 150, // €/m²
  };

  const benchmark = benchmarks[ccfData.projectType] || 300;
  const ratio = budgetPerM2 / benchmark;

  // Very low budget
  if (ratio < 0.7) {
    alerts.push({
      type: 'critical',
      message: `💰 Budget Under-provisioned: €${budgetPerM2.toFixed(0)}/m² vs market €${benchmark}/m²`,
      severity: 4,
    });
    recommendations.push({
      title: 'Budget Review Required',
      description:
        `Budget is ${((1 - ratio) * 100).toFixed(0)}% below market. Risk: incomplete work, quality issues. Recommend increase by €${((benchmark - budgetPerM2) * surface).toFixed(0)}`,
      priority: 'high',
      category: 'budget',
      impact: 'Project feasibility risk',
    });
  }

  // Slightly low budget
  if (ratio >= 0.7 && ratio < 1.0) {
    alerts.push({
      type: 'warning',
      message: `⚠️ Budget Tight: €${budgetPerM2.toFixed(0)}/m² (market avg: €${benchmark}/m²)`,
      severity: 2,
    });
    recommendations.push({
      title: 'Budget Contingency',
      description: 'Add 10-15% contingency (€ ' +
        ((ccfData.budget * 0.15) / 1000).toFixed(0) +
        'k) for unforeseen issues',
      priority: 'medium',
      category: 'budget',
    });
  }

  return { alerts, recommendations, marketRatio: ratio };
}

// ============================================================================
// TIMELINE ANALYSIS
// ============================================================================

export function analyzeTimeline(enrichedData: EnrichedClientData, ccfData: CCFData): {
  alerts: RagAlert[];
  recommendations: RagRecommendation[];
  estimatedMonths: number;
} {
  const alerts: RagAlert[] = [];
  const recommendations: RagRecommendation[] = [];

  let baseMonths = 3; // Default

  // Adjust by type
  if (ccfData.projectType === 'neuf') baseMonths = 12;
  if (ccfData.projectType === 'extension') baseMonths = 6;
  if (ccfData.projectType === 'maintenance') baseMonths = 1;

  // Add for constraints
  if (ccfData.constraints?.includes('Continuité d\'activité requise')) baseMonths += 2;
  if (ccfData.constraints?.includes('Accès restreint au site')) baseMonths += 1;
  if (ccfData.constraints?.includes('Amiante possible')) baseMonths += 1;

  // Add for ABF
  if (enrichedData.regulatory?.abfZone) baseMonths += 2;

  // Parse requested timeline
  const timelineMonths: Record<string, number> = {
    '1-3-months': 3,
    '3-6-months': 6,
    '6-12-months': 12,
    '12-plus-months': 24,
  };

  const requested = timelineMonths[ccfData.timeline] || 6;
  const feasible = requested >= baseMonths;

  if (!feasible) {
    alerts.push({
      type: 'warning',
      message: `⏱️ Timeline Unrealistic: Requested ${requested}m vs estimated ${baseMonths}m minimum`,
      severity: 3,
    });
    recommendations.push({
      title: 'Timeline Extension',
      description: `Add ${baseMonths - requested} months for realistic schedule. Include contingency for permits.`,
      priority: 'high',
      category: 'timeline',
      impact: 'Project delay risk',
    });
  }

  return { alerts, recommendations, estimatedMonths: baseMonths };
}

// ============================================================================
// COMPREHENSIVE RAG ANALYSIS
// ============================================================================

export function performRagAnalysis(context: RagContext): RagAnalysis {
  const { enrichedData, ccfData } = context;

  // Run all analyses
  const regAnalysis = analyzeRegulatory(enrichedData, ccfData);
  const energyAnalysis = analyzeEnergy(enrichedData, ccfData);
  const budgetAnalysis = analyzeBudget(enrichedData, ccfData);
  const timelineAnalysis = analyzeTimeline(enrichedData, ccfData);

  // Combine all alerts and recommendations
  const allAlerts = [
    ...regAnalysis.alerts,
    ...energyAnalysis.alerts,
    ...budgetAnalysis.alerts,
    ...timelineAnalysis.alerts,
  ];

  const allRecommendations = [
    ...regAnalysis.recommendations,
    ...energyAnalysis.recommendations,
    ...budgetAnalysis.recommendations,
    ...timelineAnalysis.recommendations,
  ];

  // Calculate overall score
  const criticalCount = allAlerts.filter(a => a.type === 'critical').length;
  const warningCount = allAlerts.filter(a => a.type === 'warning').length;

  let overallScore = 100;
  overallScore -= criticalCount * 20;
  overallScore -= warningCount * 10;
  overallScore = Math.max(0, overallScore);

  let status: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent';
  if (overallScore >= 80) status = 'excellent';
  else if (overallScore >= 60) status = 'good';
  else if (overallScore >= 40) status = 'warning';
  else status = 'critical';

  const conformityScore = Math.min(
    100,
    (budgetAnalysis.marketRatio * 100 + timelineAnalysis.estimatedMonths * 5) / 2
  );

  return {
    conformity_score: conformityScore,
    overall_score: overallScore,
    status,
    alerts: allAlerts,
    recommendations: allRecommendations,
    context_summary: buildRagContext(context),
  };
}

export default performRagAnalysis;
