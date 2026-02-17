/**
 * Doctrine Activation Engine v1.0
 * Enriches ExecutionContext with knowledge-driven insights
 * Bridges Knowledge Core (Phase 25) with ExecutionContext
 */

import { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import { TORP_KNOWLEDGE_CORE } from '@/core/knowledge/knowledgeRegistry';

/**
 * Doctrine insights
 */
export interface DoctrineInsights {
  matchedNorms: {
    ruleId: string;
    label: string;
    severity: string;
    applicable: boolean;
  }[];
  pricingReferences: {
    lotType: string;
    minPrice?: number;
    maxPrice?: number;
    region?: string;
  }[];
  jurisprudenceNotes: {
    caseId: string;
    title: string;
    relevance: string;
  }[];
  knowledgeConfidenceScore: number;
  activationRationale: string[];
}

/**
 * Activate doctrine for execution context
 */
export async function runDoctrineActivationEngine(
  executionContext: EngineExecutionContext
): Promise<DoctrineInsights> {
  try {
    console.log('[DoctrineActivation] Starting doctrine activation');

    const insights: DoctrineInsights = {
      matchedNorms: [],
      pricingReferences: [],
      jurisprudenceNotes: [],
      knowledgeConfidenceScore: 0,
      activationRationale: [],
    };

    // Extract context details
    const lots = (executionContext.lots as any)?.normalizedLots || [];
    const totalAmount = (executionContext.pricing as any)?.totalAmount || 0;
    const region = (executionContext as any)?.geography?.region;

    // Step 1: Match applicable normative rules
    const matchedNorms = matchNormativeRules(lots);
    insights.matchedNorms = matchedNorms;
    insights.activationRationale.push(
      `Matched ${matchedNorms.length} normative rules based on lot types`
    );

    // Step 2: Find pricing references
    const pricingRefs = findPricingReferences(lots, region);
    insights.pricingReferences = pricingRefs;
    insights.activationRationale.push(
      `Found ${pricingRefs.length} pricing references for validation`
    );

    // Step 3: Find relevant jurisprudence
    const jurisprudence = findRelevantJurisprudence(lots);
    insights.jurisprudenceNotes = jurisprudence;
    insights.activationRationale.push(
      `Found ${jurisprudence.length} relevant legal references`
    );

    // Step 4: Calculate confidence score
    insights.knowledgeConfidenceScore = calculateConfidenceScore(
      matchedNorms.length,
      pricingRefs.length,
      jurisprudence.length
    );

    // Step 5: Enrich context
    (executionContext as any).doctrineInsights = insights;

    console.log('[DoctrineActivation] Doctrine activation complete', {
      normsMatched: matchedNorms.length,
      pricingRefsFound: pricingRefs.length,
      jurisprudenceFound: jurisprudence.length,
      confidenceScore: insights.knowledgeConfidenceScore,
    });

    return insights;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DoctrineActivation] Activation failed:', errorMessage);

    // Return safe default
    return {
      matchedNorms: [],
      pricingReferences: [],
      jurisprudenceNotes: [],
      knowledgeConfidenceScore: 0,
      activationRationale: ['Doctrine activation failed - using fallback'],
    };
  }
}

/**
 * Match normative rules to project lots
 */
function matchNormativeRules(lots: any[]): DoctrineInsights['matchedNorms'] {
  try {
    const matches: DoctrineInsights['matchedNorms'] = [];
    const lotTypes = new Set(lots.map((lot) => lot.type));

    for (const rule of TORP_KNOWLEDGE_CORE.normativeRules) {
      const applicable = rule.relatedLots.some((ruleLot) => lotTypes.has(ruleLot));

      if (applicable) {
        matches.push({
          ruleId: rule.id,
          label: rule.label,
          severity: rule.severity,
          applicable: true,
        });
      }
    }

    console.log('[DoctrineActivation] Matched', matches.length, 'normative rules');
    return matches;
  } catch (error) {
    console.warn('[DoctrineActivation] Error matching norms:', error);
    return [];
  }
}

/**
 * Find applicable pricing references
 */
function findPricingReferences(
  lots: any[],
  region?: string
): DoctrineInsights['pricingReferences'] {
  try {
    const references: DoctrineInsights['pricingReferences'] = [];
    const lotTypes = new Set(lots.map((lot) => lot.type));

    for (const pricing of TORP_KNOWLEDGE_CORE.pricingReferences) {
      if (lotTypes.has(pricing.lotType)) {
        // Match by lot type and optionally by region
        if (!region || !pricing.region || pricing.region === region) {
          references.push({
            lotType: pricing.lotType,
            minPrice: pricing.minPricePerUnit || pricing.minTotalPrice,
            maxPrice: pricing.maxPricePerUnit || pricing.maxTotalPrice,
            region: pricing.region,
          });
        }
      }
    }

    console.log('[DoctrineActivation] Found', references.length, 'pricing references');
    return references;
  } catch (error) {
    console.warn('[DoctrineActivation] Error finding pricing refs:', error);
    return [];
  }
}

/**
 * Find relevant jurisprudence
 */
function findRelevantJurisprudence(lots: any[]): DoctrineInsights['jurisprudenceNotes'] {
  try {
    const references: DoctrineInsights['jurisprudenceNotes'] = [];
    const lotTypes = new Set(lots.map((lot) => lot.type));

    for (const juris of TORP_KNOWLEDGE_CORE.jurisprudence) {
      if (!juris.relevantLots) {
        // General jurisprudence applicable to all
        references.push({
          caseId: juris.id,
          title: juris.title,
          relevance: 'General - applies to all construction projects',
        });
      } else {
        // Check if any lot matches
        const isRelevant = juris.relevantLots.some((lot) => lotTypes.has(lot));
        if (isRelevant) {
          references.push({
            caseId: juris.id,
            title: juris.title,
            relevance: `Relevant for: ${juris.relevantLots.join(', ')}`,
          });
        }
      }
    }

    console.log('[DoctrineActivation] Found', references.length, 'jurisprudence references');
    return references;
  } catch (error) {
    console.warn('[DoctrineActivation] Error finding jurisprudence:', error);
    return [];
  }
}

/**
 * Calculate doctrine confidence score
 */
function calculateConfidenceScore(normsCount: number, pricingCount: number, jurisCount: number): number {
  try {
    // Confidence increases with coverage of all three areas
    let score = 0;

    // Norms coverage (max 40)
    if (normsCount >= 3) score += 40;
    else if (normsCount >= 1) score += normsCount * 13;

    // Pricing coverage (max 35)
    if (pricingCount >= 3) score += 35;
    else if (pricingCount >= 1) score += pricingCount * 12;

    // Jurisprudence coverage (max 25)
    if (jurisCount >= 3) score += 25;
    else if (jurisCount >= 1) score += jurisCount * 8;

    return Math.min(100, score);
  } catch (error) {
    console.warn('[DoctrineActivation] Error calculating confidence:', error);
    return 0;
  }
}

/**
 * Get doctrine activation metadata
 */
export function getDoctrineActivationMetadata(): Record<string, any> {
  return {
    name: 'Doctrine Activation Engine',
    version: '1.0',
    purpose: 'Enrich execution context with knowledge-driven insights',
    executionOrder: 'Optional - can run after FraudDetectionEngine',
    characteristics: {
      readOnly: true,
      noModification: true,
      knowledgeEnrichment: true,
      optional: true,
    },
    insights: {
      normativeMatching: 'Rules matched to lot types',
      pricingReferences: 'Market benchmarks for validation',
      jurisprudence: 'Legal guidance for decision support',
      confidenceScore: 'Coverage of all three areas',
    },
    constraints: {
      noEngineModification: true,
      noScoringChange: true,
      readOnlyAnalysis: true,
      fullyOptional: true,
    },
  };
}
